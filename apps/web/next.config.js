/** @type {import('next').NextConfig} */
const nextConfig = {
  // v2.2 本地开发：把 /api/* 代理到生产后端，规避浏览器 CORS
  // 生产环境（EdgeOne 部署）不走这条 rewrite，因为生产 CORS 已经允许 edgeone 域名
  async rewrites() {
    const apiTarget =
      process.env.NEXT_PUBLIC_API_URL_PROXY ||
      "http://82.156.128.150:3001"
    return [
      {
        source: "/api/:path*",
        destination: `${apiTarget}/api/:path*`,
      },
    ]
  },
}

module.exports = nextConfig
