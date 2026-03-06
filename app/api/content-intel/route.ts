import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const dataPath = path.join(process.cwd(), 'data', 'content-intel.json')

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const brand = searchParams.get('brand')
  const week = searchParams.get('week')
  let data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  if (brand) data = data.filter((r: any) => r.brand === brand)
  if (week) data = data.filter((r: any) => r.week === week)
  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  const newRow = {
    id: `ci-${Date.now()}`,
    addedAt: new Date().toISOString(),
    ...body
  }
  data.unshift(newRow)
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
  return NextResponse.json(newRow)
}

export async function DELETE(req: Request) {
  const { id } = await req.json()
  let data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'))
  data = data.filter((r: any) => r.id !== id)
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2))
  return NextResponse.json({ ok: true })
}
