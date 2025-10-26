import { NextRequest, NextResponse } from 'next/server'

// 轻量级转发器：将来自前端的社区请求转发到公网服务器
// 服务器地址固定为用户提供的 IP（可改为环境变量）
const REMOTE_BASE = process.env.COMMUNITY_REMOTE_BASE || 'http://47.95.220.140:8080';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { path, method = 'POST', headers, payload } = body as {
      path: string; method?: string; headers?: Record<string,string>; payload?: any
    };
    if (!path) {
      return NextResponse.json({ error: 'missing path' }, { status: 400 });
    }
    const res = await fetch(`${REMOTE_BASE}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(headers || {}) },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const text = await res.text();
    try {
      return new NextResponse(text, { status: res.status, headers: { 'Content-Type': 'application/json' } });
    } catch {
      return new NextResponse(text, { status: res.status });
    }
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 500 });
  }
}


