/** @type {import('next').NextConfig} */
const nextConfig = {
  // /api/* 请求由 app/api/[...slug]/route.ts 代理到后端，无需 rewrite
  // BACKEND_URL 环境变量控制目标地址，默认 http://82.156.128.150:3001
}

module.exports = nextConfig
