/** @type {import('next').NextConfig} */
const nextConfig = {
  // v2.4：前端直连后端 HTTPS 子域名 https://api.studyhere.com.cn（见 lib/api.ts BASE_URL）。
  // 已删除原 app/api/[...slug]/route.ts 边缘代理（EdgeOne 边缘函数无法 fetch 纯 HTTP:3001）。

  // 本地 dev 兜底（不影响生产）：
  //   生产 CORS 白名单只允许 studyhere.com.cn 与 localhost:3000/3001，
  //   web dev 跑在 localhost:3100 → 浏览器直接打 api.studyhere.com.cn 触发 CORS 拒绝 → axios Network Error。
  //
  //   解法：本地 dev 时让前端走 next.js rewrites 同源代理（/api/* → 生产后端），
  //   浏览器看到的是同源请求，无跨域。
  //   rewrites 只在 next dev / next start 生效；EdgeOne 静态导出不走这段，所以不影响线上。
  //
  //   想直连本地 api dev 的同学：在 .env.local 设 NEXT_PUBLIC_API_URL=http://localhost:3001，
  //   下面 if 会跳过 rewrites。
  async rewrites() {
    if (process.env.NEXT_PUBLIC_API_URL) return []
    return [
      {
        source: "/api/:path*",
        destination: "https://api.studyhere.com.cn/api/:path*",
      },
    ]
  },
}

module.exports = nextConfig
