import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'data', 'activity.json')

export async function GET() {
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  return NextResponse.json(data.reverse())
}

export async function POST(req: Request) {
  const body = await req.json()
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const newEntry = { id: `act-${Date.now()}`, timestamp: new Date().toISOString(), ...body }
  data.push(newEntry)
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
  return NextResponse.json(newEntry)
}
