import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'data', 'phases.json')

export async function GET() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  return NextResponse.json(data)
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const phase = data.find((p: any) => p.phase === body.phase)
  if (!phase) return NextResponse.json({ error: 'Phase not found' }, { status: 404 })
  const item = phase.items.find((i: any) => i.id === body.id)
  if (!item) return NextResponse.json({ error: 'Item not found' }, { status: 404 })
  item.completed = body.completed
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
  return NextResponse.json(item)
}

export async function POST(req: Request) {
  const body = await req.json()
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const phase = data.find((p: any) => p.phase === body.phase)
  if (!phase) return NextResponse.json({ error: 'Phase not found' }, { status: 404 })
  const newItem = { id: `p${body.phase}-${Date.now()}`, text: body.text, completed: false }
  phase.items.push(newItem)
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
  return NextResponse.json(newItem)
}
