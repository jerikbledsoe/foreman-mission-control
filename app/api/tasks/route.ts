import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'data', 'tasks.json')

export async function GET() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const newTask = { id: `task-${Date.now()}`, ...body }
  data.push(newTask)
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
  return NextResponse.json(newTask)
}

export async function PATCH(req: Request) {
  const body = await req.json()
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const idx = data.findIndex((t: any) => t.id === body.id)
  if (idx === -1) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  data[idx] = { ...data[idx], ...body }
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
  return NextResponse.json(data[idx])
}
