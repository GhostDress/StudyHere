/** @type {import('next').NextConfig} */
const nextConfig = {
  // v2.4：前端直连后端 HTTPS 子域名 https://api.studyhere.com.cn（见 lib/api.ts BASE_URL）。
  // 已删除原 app/api/[...slug]/route.ts 边缘代理（EdgeOne 边缘函数无法 fetch 纯 HTTP:3001）。
}

module.exports = nextConfig
