"use client"

import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/addons/controls/OrbitControls.js"
import { geoMercator } from "d3-geo"
import chinaJson from "@/data/china.json"

// 定义颜色数组用于随机为省份分配颜色
const PROVINCE_COLORS = [
  "#d13a34", // 红色
  "#ff7e00", // 橙色
  "#fbbe00", // 黄色
  "#6eaa5e", // 绿色
  "#5555aa", // 蓝色
  "#8e67d4", // 紫色
  "#e371b2", // 粉色
  "#e67c7c", // 浅红
  "#6dcff6", // 天蓝
  "#ffe74c", // 明黄
];

export default function MapVisualization() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const nameCanvasRef = useRef<HTMLCanvasElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null)

  useEffect(() => {
    if (!canvasRef.current) return

    // Scene setup
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0xf0f0f0)

    // Camera setup
    const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 10000)
    camera.position.set(0, -50, 70)
    camera.lookAt(0, 0, 0)

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      alpha: true,
    })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(window.innerWidth, window.innerHeight)
    renderer.shadowMap.enabled = true

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.25
    controls.rotateSpeed = 0.35

    // Lighting
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.1)
    directionalLight.position.set(300, 1000, 500)
    directionalLight.target.position.set(0, 0, 0)
    directionalLight.castShadow = true

    directionalLight.shadow.camera.far = 1000
    directionalLight.shadow.bias = 0.0001
    directionalLight.shadow.mapSize.width = 1024
    directionalLight.shadow.mapSize.height = 1024
    scene.add(directionalLight)

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    // Helper systems
    const axisHelper = new THREE.AxesHelper(2000)
    scene.add(axisHelper)

    const gridHelper = new THREE.GridHelper(600, 60)
    scene.add(gridHelper)

    // Map container
    const map = new THREE.Object3D()
    
    // 存储省份网格对象，用于悬停交互
    const provinceMeshes: { [key: string]: THREE.Mesh } = {}

    // Create map from GeoJSON
    const projection = geoMercator().center([104.0, 37.5]).scale(70).translate([0, 0])

    // Process each province
    chinaJson.features.forEach((feature, featureIndex) => {
      const province = new THREE.Object3D()
      const coordinates = feature.geometry.coordinates
      
      // 为每个省份分配一个随机颜色
      const colorIndex = featureIndex % PROVINCE_COLORS.length
      const provinceColor = PROVINCE_COLORS[colorIndex]

      coordinates.forEach((multiPolygon) => {
        multiPolygon.forEach((polygon) => {
          // Create shape for extrusion
          const shape = new THREE.Shape()

          // Create line geometry for borders
          const lineGeometry = new THREE.BufferGeometry()
          const linePoints: THREE.Vector3[] = []

          let isFirstValidPoint = true;
          
          for (let i = 0; i < polygon.length; i++) {
            const coord = polygon[i];
            // 确保坐标是有效的经纬度数组
            if (!Array.isArray(coord) || coord.length < 2) {
              continue;
            }
            
            const projectedPoint = projection(coord as [number, number]);
            
            // 检查投影点是否有效
            if (!projectedPoint || 
                Number.isNaN(projectedPoint[0]) || 
                Number.isNaN(projectedPoint[1])) {
              continue; // 跳过无效点
            }
            
            const [x, y] = projectedPoint;

            if (isFirstValidPoint) {
              shape.moveTo(x, -y);
              isFirstValidPoint = false;
            } else {
              shape.lineTo(x, -y);
            }

            linePoints.push(new THREE.Vector3(x, -y, 4.01));
          }
          
          // 确保有足够的点来创建形状
          if (linePoints.length < 3) {
            return; // 跳过无效多边形
          }

          // Create extrusion
          const extrudeSettings = {
            depth: 4,
            bevelEnabled: true,
            bevelThickness: 0.2,
            bevelSize: 0.2,
            bevelSegments: 3
          }

          const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings)
          
          // 更改材质设置，提高不透明度并使颜色更鲜明
          const material = new THREE.MeshPhongMaterial({
            color: provinceColor,
            transparent: true,
            opacity: 0.8,
            specular: 0x333333,
            shininess: 30,
          })

          const mesh = new THREE.Mesh(geometry, material)
          mesh.castShadow = true
          mesh.receiveShadow = true
          
          // 存储省份名称用于悬停交互
          if (feature.properties.name) {
            mesh.userData.provinceName = feature.properties.name
            provinceMeshes[feature.properties.name] = mesh
          }

          // Create border lines
          lineGeometry.setFromPoints(linePoints)
          const lineMaterial = new THREE.LineBasicMaterial({ 
            color: 0xffffff,
            linewidth: 2 
          })
          const line = new THREE.Line(lineGeometry, lineMaterial)

          province.add(mesh)
          province.add(line)
        })
      })

      // Store properties for later use
      province.userData = feature.properties

      // 确保centroid数据正确存储
      if (feature.properties.centroid) {
        const centroid = feature.properties.centroid;
        if (Array.isArray(centroid) && centroid.length >= 2) {
          const projectedCentroid = projection(centroid as [number, number]);
          if (projectedCentroid && !Number.isNaN(projectedCentroid[0]) && !Number.isNaN(projectedCentroid[1])) {
            const [x, y] = projectedCentroid;
            province.userData._centroid = [x, y];
          }
        }
      }

      map.add(province)
    })

    scene.add(map)
    setIsLoading(false)

    // 鼠标交互
    const raycaster = new THREE.Raycaster()
    const mouse = new THREE.Vector2()

    const onMouseMove = (event: MouseEvent) => {
      // 计算鼠标位置的归一化设备坐标
      mouse.x = (event.clientX / window.innerWidth) * 2 - 1
      mouse.y = -(event.clientY / window.innerHeight) * 2 + 1
      
      // 射线检测与地图对象的交点
      raycaster.setFromCamera(mouse, camera)
      const intersects = raycaster.intersectObjects(map.children, true)
      
      if (intersects.length > 0) {
        // 查找第一个有provinceName的交点
        for (let i = 0; i < intersects.length; i++) {
          const object = intersects[i].object as THREE.Mesh
          if (object.userData && object.userData.provinceName) {
            // 高亮显示省份
            const provinceName = object.userData.provinceName
            setHoveredProvince(provinceName)
            
            // 将所有省份恢复正常颜色
            Object.keys(provinceMeshes).forEach(name => {
              const mesh = provinceMeshes[name]
              const material = mesh.material as THREE.MeshPhongMaterial
              material.emissive.set(0x000000)
              material.opacity = 0.8
            })
            
            // 高亮当前省份
            if (provinceMeshes[provinceName]) {
              const material = provinceMeshes[provinceName].material as THREE.MeshPhongMaterial
              material.emissive.set(0x333333)
              material.opacity = 1.0
            }
            
            return
          }
        }
      }
      
      // 如果没有交点，清除高亮
      if (hoveredProvince) {
        // 恢复所有省份颜色
        Object.keys(provinceMeshes).forEach(name => {
          const mesh = provinceMeshes[name]
          const material = mesh.material as THREE.MeshPhongMaterial
          material.emissive.set(0x000000)
          material.opacity = 0.8
        })
        setHoveredProvince(null)
      }
    }

    window.addEventListener('mousemove', onMouseMove)

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(window.innerWidth, window.innerHeight)
      showProvinceNames()
    }

    window.addEventListener("resize", handleResize)

    // 省份名称直接添加到3D场景中作为标签
    const createProvinceLabels = () => {
      // 先清除旧的标签
      map.children.forEach(province => {
        const labels = province.children.filter(child => child.userData.isLabel);
        labels.forEach(label => province.remove(label));
      });
      
      map.children.forEach(province => {
        const userData = province.userData;
        if (!userData._centroid || !userData.name) return;
        
        // 创建文本精灵
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) return;
        
        const name = userData.name;
        
        // 设置画布大小
        canvas.width = 256;
        canvas.height = 64;
        
        // 绘制文本
        context.fillStyle = 'rgba(255, 255, 255, 0.8)';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.font = 'bold 32px Arial';
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        context.fillStyle = '#000000';
        context.fillText(name, canvas.width / 2, canvas.height / 2);
        
        // 创建纹理和精灵
        const texture = new THREE.CanvasTexture(canvas);
        const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(spriteMaterial);
        
        const x = userData._centroid[0];
        const y = -userData._centroid[1];
        
        // 设置精灵位置和大小
        sprite.position.set(x, y, 5); // 放在地图上方
        sprite.scale.set(8, 2, 1);
        sprite.userData.isLabel = true;
        
        province.add(sprite);
      });
    };

    // 修改原来的showProvinceNames函数，继续保留2D渲染作为备份
    const showProvinceNames = () => {
      if (!nameCanvasRef.current) return

      const width = window.innerWidth
      const height = window.innerHeight
      const canvas = nameCanvasRef.current

      canvas.width = width
      canvas.height = height

      const ctx = canvas.getContext("2d")
      if (!ctx) return

      // Clear canvas
      ctx.clearRect(0, 0, width, height)

      // 设置更清晰的文本样式
      ctx.font = "bold 18px Arial"
      ctx.lineWidth = 4
      ctx.strokeStyle = "#FFFFFF"
      ctx.fillStyle = "#000000"

      // Store displayed texts to check for overlaps
      const texts: {
        name: string
        left: number
        top: number
        width: number
        height: number
      }[] = []

      // Process each province
      map.children.forEach((province) => {
        const userData = province.userData
        if (!userData._centroid) return
        
        // 确保省份有名称
        if (!userData.name) return

        // Get center point
        const x = userData._centroid[0]
        const y = -userData._centroid[1]
        const z = 4

        // Convert 3D position to 2D screen coordinates
        const vector = new THREE.Vector3(x, y, z)
        vector.project(camera)

        // 确保向量在视野范围内
        if (Math.abs(vector.x) > 1 || Math.abs(vector.y) > 1) return

        const left = ((vector.x + 1) / 2) * width
        const top = (-(vector.y - 1) / 2) * height

        const name = userData.name
        const textWidth = ctx.measureText(name).width

        const text = {
          name,
          left,
          top,
          width: textWidth,
          height: 18,
        }

        // Check for overlaps
        let show = true
        for (let i = 0; i < texts.length; i++) {
          if (
            text.left + text.width < texts[i].left ||
            text.top + text.height < texts[i].top ||
            texts[i].left + texts[i].width < text.left ||
            texts[i].top + texts[i].height < text.top
          ) {
            // No overlap
          } else {
            show = false
            break
          }
        }

        // 高亮悬停的省份名称
        if (show) {
          texts.push(text)
          
          if (hoveredProvince === name) {
            // 悬停状态的省份名称加粗显示
            ctx.lineWidth = 6
            ctx.font = "bold 22px Arial"
            ctx.strokeText(name, left, top)
            ctx.fillText(name, left, top)
            ctx.lineWidth = 4
            ctx.font = "bold 18px Arial"
          } else {
            ctx.strokeText(name, left, top)
            ctx.fillText(name, left, top)
          }
        }
      })
    }

    // 初始渲染省份标签
    createProvinceLabels();

    // 在相机或控制器更改时更新标签
    controls.addEventListener('change', createProvinceLabels);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
      showProvinceNames() // 保持2D文本渲染作为备份
    }

    animate()

    // Cleanup
    return () => {
      window.removeEventListener("resize", handleResize)
      window.removeEventListener('mousemove', onMouseMove)
      controls.removeEventListener('change', createProvinceLabels)
      renderer.dispose()
      controls.dispose()
    }
  }, [hoveredProvince])

  return (
    <>
      <canvas ref={canvasRef} className="w-full h-full" />
      <canvas
        ref={nameCanvasRef}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{ pointerEvents: "none" }}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-70">
          <div className="text-xl font-semibold">加载中...</div>
        </div>
      )}
      {hoveredProvince && (
        <div className="absolute bottom-5 left-5 bg-white bg-opacity-80 p-2 rounded-md shadow-md">
          <p className="text-lg font-semibold">{hoveredProvince}</p>
        </div>
      )}
    </>
  )
}
