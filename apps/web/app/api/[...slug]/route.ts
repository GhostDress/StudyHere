/**
 * 生产环境 API 代理
 * 将所有 /api/* 请求转发到后端服务器，避免浏览器跨域/混合内容问题
 * 在 EdgeOne Edge Function 中运行（服务端 → 服务端，无 CORS 限制）
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND_URL =
  process.env.BACKEND_URL || 'http://82.156.128.150:3001'

async function proxyHandler(
  req: NextRequest,
  context: { params: Promise<{ slug: string[] }> }
) {
  const { slug } = await context.params
  const path = slug.join('/')
  const search = req.nextUrl.searchParams.toString()
  const targetUrl = `${BACKEND_URL}/api/${path}${search ? `?${search}` : ''}`

  // 转发关键请求头（不转发 host，避免后端混淆）
  const forwardHeaders = new Headers()
  for (const key of ['content-type', 'authorization', 'cookie', 'x-request-id']) {
    const val = req.headers.get(key)
    if (val) forwardHeaders.set(key, val)
  }

  let body: string | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    body = await req.text()
  }

  let response: Response
  try {
    response = await fetch(targetUrl, {
      method: req.method,
      headers: forwardHeaders,
      body,
    })
  } catch (err) {
    console.error('[proxy] Backend unreachable:', err)
    return NextResponse.json(
      { error: 'Backend service unavailable', target: targetUrl },
      { status: 503 }
    )
  }

  // 构造响应，转发 content-type 和 set-cookie
  const resHeaders = new Headers()
  const ct = response.headers.get('content-type')
  if (ct) resHeaders.set('content-type', ct)
  const sc = response.headers.get('set-cookie')
  if (sc) resHeaders.set('set-cookie', sc)

  const resBody = await response.text()
  return new NextResponse(resBody, {
    status: response.status,
    headers: resHeaders,
  })
}

export const GET     = proxyHandler
export const POST    = proxyHandler
export const PUT     = proxyHandler
export const DELETE  = proxyHandler
export const PATCH   = proxyHandler
export const OPTIONS = proxyHandler
