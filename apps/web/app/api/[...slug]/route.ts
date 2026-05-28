/**
 * 生产环境 API 代理 (Next.js 14 App Router)
 * 将所有 /api/* 请求转发到后端，在 EdgeOne Edge Function 中服务端对服务端代理
 */

import { NextRequest, NextResponse } from 'next/server'

const BACKEND = process.env.BACKEND_URL ?? 'http://82.156.128.150:3001'

type Context = { params: { slug: string[] } }

async function handle(req: NextRequest, ctx: Context): Promise<NextResponse> {
  try {
    const slug: string[] = ctx?.params?.slug ?? []
    const path = slug.join('/')
    const search = req.nextUrl.searchParams.toString()
    const url = `${BACKEND}/api/${path}${search ? `?${search}` : ''}`

    // 转发关键请求头
    const fwdHeaders: Record<string, string> = {}
    for (const k of ['content-type', 'authorization', 'cookie']) {
      const v = req.headers.get(k)
      if (v) fwdHeaders[k] = v
    }

    const body = req.method !== 'GET' && req.method !== 'HEAD'
      ? await req.text()
      : undefined

    const upstream = await fetch(url, {
      method: req.method,
      headers: fwdHeaders,
      body,
    })

    const text = await upstream.text()
    const resHeaders: Record<string, string> = {}
    const ct = upstream.headers.get('content-type')
    if (ct) resHeaders['content-type'] = ct
    const sc = upstream.headers.get('set-cookie')
    if (sc) resHeaders['set-cookie'] = sc

    return new NextResponse(text, { status: upstream.status, headers: resHeaders })

  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[proxy]', msg)
    return NextResponse.json({ error: 'proxy_error', detail: msg }, { status: 502 })
  }
}

export async function GET(req: NextRequest, ctx: Context)     { return handle(req, ctx) }
export async function POST(req: NextRequest, ctx: Context)    { return handle(req, ctx) }
export async function PUT(req: NextRequest, ctx: Context)     { return handle(req, ctx) }
export async function DELETE(req: NextRequest, ctx: Context)  { return handle(req, ctx) }
export async function PATCH(req: NextRequest, ctx: Context)   { return handle(req, ctx) }
export async function OPTIONS(req: NextRequest, ctx: Context) { return handle(req, ctx) }
