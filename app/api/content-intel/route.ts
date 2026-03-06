import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET(req: Request) {
  const sb = getSupabase()
  const { searchParams } = new URL(req.url)
  const brand = searchParams.get('brand')
  const week = searchParams.get('week')

  let query = sb.from('content_intel').select('*').order('addedAt', { ascending: false })
  if (brand) query = query.eq('brand', brand)
  if (week && week !== 'all') query = query.eq('week', week)

  const { data, error } = await query
  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const sb = getSupabase()
  const body = await req.json()
  const row = { ...body, id: body.id || crypto.randomUUID(), addedAt: new Date().toISOString() }
  const { error } = await sb.from('content_intel').insert(row)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true, id: row.id })
}

export async function DELETE(req: Request) {
  const sb = getSupabase()
  const body = await req.json()
  const { error } = await sb.from('content_intel').delete().eq('id', body.id)
  if (error) return NextResponse.json({ error }, { status: 500 })
  return NextResponse.json({ ok: true })
}
