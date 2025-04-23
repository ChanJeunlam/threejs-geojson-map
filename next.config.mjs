/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: '/threejs-geojson-map',
  assetPrefix: '/threejs-geojson-map/',  // 添加此行
  images: {
    unoptimized: true,
  },
  trailingSlash: true,  // 添加此行以确保URL末尾有斜杠
};

export default nextConfig;