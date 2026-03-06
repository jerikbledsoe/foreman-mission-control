import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'data', 'ideas.json')

export async function GET() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const newIdea = { id: `idea-${Date.now()}`, createdAt: new Date().toISOString(), status: 'queued', ...body }
  data.push(newIdea)
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
  return NextResponse.json(newIdea)
}
