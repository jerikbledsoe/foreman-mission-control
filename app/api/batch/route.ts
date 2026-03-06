import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const batchPath = path.join(process.cwd(), 'data', 'batch-queue.json')
const intelPath = path.join(process.cwd(), 'data', 'content-intel.json')
const triggerPath = path.join(process.cwd(), 'data', 'batch-trigger.json')

export async function GET() {
  const data = JSON.parse(fs.readFileSync(batchPath, 'utf-8'))
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf-8'))
  const intel = JSON.parse(fs.readFileSync(intelPath, 'utf-8'))

  if (body.action === 'add') {
    const row = intel.find((r: any) => r.id === body.id)
    if (!row) return NextResponse.json({ error: 'Row not found' }, { status: 404 })
    const already = batch.find((b: any) => b.id === body.id)
    if (!already) {
      batch.push({ ...row, erikNote: '', queuedAt: new Date().toISOString() })
      fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2))
    }
    return NextResponse.json({ ok: true, count: batch.length })
  }

  if (body.action === 'remove') {
    const updated = batch.filter((b: any) => b.id !== body.id)
    fs.writeFileSync(batchPath, JSON.stringify(updated, null, 2))
    return NextResponse.json({ ok: true, count: updated.length })
  }

  if (body.action === 'note') {
    const item = batch.find((b: any) => b.id === body.id)
    if (item) item.erikNote = body.note
    fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2))
    return NextResponse.json({ ok: true })
  }

  if (body.action === 'send') {
    const sent = JSON.parse(fs.readFileSync(batchPath, 'utf-8'))
    if (sent.length === 0) return NextResponse.json({ error: 'Batch is empty' }, { status: 400 })

    // Write trigger file
    fs.writeFileSync(triggerPath, JSON.stringify({
      sentAt: new Date().toISOString(),
      items: sent
    }, null, 2))

    // Clear queue immediately
    fs.writeFileSync(batchPath, JSON.stringify([], null, 2))

    // Fire the processor directly — no cron needed
    try {
      execSync('python3 /Users/OpenClaw/workspace/scripts/process-batch.py', {
        timeout: 30000,
        stdio: 'pipe'
      })
    } catch (e) {
      // Log but don't fail — rows are written to trigger file regardless
      console.error('Batch processor error:', e)
    }

    return NextResponse.json({ ok: true, sent: sent.length })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
