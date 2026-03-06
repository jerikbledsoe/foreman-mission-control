import { NextResponse } from 'next/server'
import { getSupabase } from '@/lib/supabase'

export async function GET() {
  const sb = getSupabase()
  const { data, error } = await sb.from('phases').select('*').order('startDate', { ascending: true })
  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data)
}
