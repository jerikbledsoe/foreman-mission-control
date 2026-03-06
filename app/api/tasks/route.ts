import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const sb = getSupabase()
  const { data, error } = await sb.from('tasks').select('*').order('startedAt', { ascending: false })
  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const sb = getSupabase()
  const body = await req.json()
  const { error } = await sb.from('tasks').upsert(body)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
