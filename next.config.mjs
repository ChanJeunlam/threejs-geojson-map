/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export", // 使用静态导出
  basePath: process.env.NODE_ENV === "production" ? "/threejs-geojson-map" : "", // 仅在生产环境启用 basePath
}

export default nextConfig