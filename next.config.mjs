/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // 使用静态导出
  basePath: process.env.NODE_ENV === "production" ? "/threejs-geojson-map" : "", // 仅在生产环境启用 basePath
  assetPrefix: '/threejs-geojson-map/',  // 添加此行
  trailingSlash: true,  // 添加此行以确保URL末尾有斜杠

}

export default nextConfig