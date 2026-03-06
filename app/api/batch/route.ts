import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const triggerPath = path.join(process.cwd(), 'data', 'batch-trigger.json')

export async function GET() {
  const { data, error } = await supabase.from('batch_queue').select('*').order('queuedAt', { ascending: true })
  if (error) return NextResponse.json([], { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()

  if (body.action === 'add') {
    const { data: row } = await supabase.from('content_intel').select('*').eq('id', body.id).single()
    if (!row) return NextResponse.json({ error: 'Row not found' }, { status: 404 })
    const { data: existing } = await supabase.from('batch_queue').select('id').eq('id', body.id).single()
    if (!existing) {
      await supabase.from('batch_queue').insert({ ...row, erikNote: '', queuedAt: new Date().toISOString() })
    }
    const { count } = await supabase.from('batch_queue').select('*', { count: 'exact', head: true })
    return NextResponse.json({ ok: true, count })
  }

  if (body.action === 'remove') {
    await supabase.from('batch_queue').delete().eq('id', body.id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'note') {
    await supabase.from('batch_queue').update({ erikNote: body.note }).eq('id', body.id)
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'send') {
    const { data: sent } = await supabase.from('batch_queue').select('*')
    if (!sent || sent.length === 0) return NextResponse.json({ error: 'Batch is empty' }, { status: 400 })

    fs.writeFileSync(triggerPath, JSON.stringify({ sentAt: new Date().toISOString(), items: sent }, null, 2))
    await supabase.from('batch_queue').delete().neq('id', '')

    try {
      execSync('python3 /Users/OpenClaw/workspace/scripts/process-batch.py', { timeout: 30000, stdio: 'pipe' })
    } catch (e) {
      console.error('Batch processor error:', e)
    }

    return NextResponse.json({ ok: true, sent: sent.length })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
