'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Clock, Zap, Lightbulb, CheckCircle2, Loader2, AlertCircle, Circle, RefreshCw, Map, Plus, Check, Brain, ExternalLink, Trash2, LogOut, ChevronDown, ChevronRight, RotateCcw } from 'lucide-react'
import { signOut } from 'next-auth/react'

type Task = {
  id: string
  name: string
  status: 'backlog' | 'in-progress' | 'waiting' | 'completed'
  model: string
  startedAt: string | null
  completedAt: string | null
  notes: string
}

type Activity = {
  id: string
  timestamp: string
  entry: string
}

type Idea = {
  id: string
  title: string
  pitch: string
  effort: string
  impact: string
  status: string
  createdAt: string
}

type PhaseItem = {
  id: string
  text: string
  completed: boolean
}

type Phase = {
  phase: number
  label: string
  dateRange: string
  goal: string
  items: PhaseItem[]
}

type ContentIntelRow = {
  id: string
  brand: 'TTH' | 'EBB'
  week: string
  source: string
  sourceDetail: string
  type: string
  rawFinding: string
  link: string
  hookSuggestion: string
  angle: string
  format: string
  addedAt: string
  deleted?: boolean | null
}

const SOURCE_COLORS: Record<string, string> = {
  'Reddit': 'bg-orange-900/60 text-orange-300',
  'YouTube': 'bg-red-900/60 text-red-300',
  'Trends': 'bg-blue-900/60 text-blue-300',
  'X': 'bg-zinc-700 text-zinc-200',
  'Influencer Watch': 'bg-purple-900/60 text-purple-300',
}

const TYPE_COLORS: Record<string, string> = {
  'Raw Question': 'bg-yellow-900/50 text-yellow-300',
  'Breakout': 'bg-orange-900/50 text-orange-300',
  'Trend': 'bg-blue-900/50 text-blue-300',
  'Monday Intel': 'bg-purple-900/50 text-purple-300',
  'Scout': 'bg-purple-900/50 text-purple-300',
  'Cultural Moment': 'bg-pink-900/50 text-pink-300',
}

function normalizeType(type: string): string {
  if (type === 'Scout') return 'Monday Intel'
  return type
}

function fmt(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true, timeZone: 'America/Chicago'
  })
}

function parseWeekLabel(weekStr: string): string {
  const match = weekStr.match(/^(\d{4})-W(\d+)$/)
  if (!match) return weekStr
  const year = parseInt(match[1])
  const week = parseInt(match[2])
  const jan4 = new Date(year, 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const startDate = new Date(startOfWeek1)
  startDate.setDate(startOfWeek1.getDate() + (week - 1) * 7)
  const endDate = new Date(startDate)
  endDate.setDate(startDate.getDate() + 6)
  const startStr = startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const endStr = endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  return `Week ${week} — ${startStr}–${endStr}`
}

function getCurrentWeek(): string {
  const now = new Date()
  const jan4 = new Date(now.getFullYear(), 0, 4)
  const startOfWeek1 = new Date(jan4)
  startOfWeek1.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const diff = now.getTime() - startOfWeek1.getTime()
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1
  return `${now.getFullYear()}-W${week}`
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'completed') return <CheckCircle2 className="w-4 h-4 text-green-400" />
  if (status === 'in-progress') return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
  if (status === 'waiting') return <AlertCircle className="w-4 h-4 text-yellow-400" />
  return <Circle className="w-4 h-4 text-zinc-500" />
}

function ModelBadge({ model }: { model: string }) {
  return (
    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-300 font-mono">
      {model}
    </span>
  )
}

function ImpactBadge({ label, value }: { label: string; value: string }) {
  const color = value === 'High' ? 'text-green-400' : value === 'Medium' ? 'text-yellow-400' : 'text-zinc-400'
  return (
    <span className={`text-xs font-medium ${color}`}>{label}: {value}</span>
  )
}

function Column({ title, tasks, color }: { title: string; tasks: Task[]; color: string }) {
  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 mb-3 pb-2 border-b border-zinc-700">
        <span className={`w-2 h-2 rounded-full ${color}`} />
        <h3 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider">{title}</h3>
        <span className="ml-auto text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="space-y-3">
        {tasks.length === 0 && (
          <p className="text-xs text-zinc-600 italic text-center py-6">Nothing here</p>
        )}
        {tasks.map(task => (
          <div key={task.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-3 space-y-2">
            <div className="flex items-start gap-2">
              <StatusIcon status={task.status} />
              <p className="text-sm font-medium text-zinc-100 leading-snug flex-1">{task.name}</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ModelBadge model={task.model} />
              {task.startedAt && (
                <span className="text-xs text-zinc-500">{fmt(task.startedAt)}</span>
              )}
            </div>
            {task.notes && (
              <p className="text-xs text-zinc-500 leading-relaxed">{task.notes}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

const PHASE_COLORS = [
  { bg: 'bg-blue-900/40', border: 'border-blue-700', badge: 'bg-blue-800 text-blue-200', dot: 'bg-blue-500', header: 'text-blue-300' },
  { bg: 'bg-yellow-900/30', border: 'border-yellow-700', badge: 'bg-yellow-800 text-yellow-200', dot: 'bg-yellow-500', header: 'text-yellow-300' },
  { bg: 'bg-purple-900/30', border: 'border-purple-700', badge: 'bg-purple-800 text-purple-200', dot: 'bg-purple-500', header: 'text-purple-300' },
  { bg: 'bg-green-900/30', border: 'border-green-700', badge: 'bg-green-800 text-green-200', dot: 'bg-green-500', header: 'text-green-300' },
  { bg: 'bg-orange-900/30', border: 'border-orange-700', badge: 'bg-orange-800 text-orange-200', dot: 'bg-orange-500', header: 'text-orange-300' },
]

function PhaseColumn({ phase, colors, onToggle, onAdd }: {
  phase: Phase
  colors: typeof PHASE_COLORS[0]
  onToggle: (phaseNum: number, itemId: string, completed: boolean) => void
  onAdd: (phaseNum: number, text: string) => void
}) {
  const [adding, setAdding] = useState(false)
  const [newText, setNewText] = useState('')
  const done = phase.items.filter(i => i.completed).length
  const total = phase.items.length
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  function handleAdd() {
    if (!newText.trim()) return
    onAdd(phase.phase, newText.trim())
    setNewText('')
    setAdding(false)
  }

  return (
    <div className={`flex flex-col rounded-xl border ${colors.border} ${colors.bg} min-w-[240px] max-w-[280px] flex-shrink-0`}>
      <div className="p-4 border-b border-zinc-700/50">
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${colors.header}`}>Phase {phase.phase}</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>{pct}%</span>
        </div>
        <h3 className="text-base font-bold text-zinc-100">{phase.label}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{phase.dateRange}</p>
        <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{phase.goal}</p>
        <div className="mt-3 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.dot}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-1">{done} of {total} complete</p>
      </div>

      <div className="flex-1 p-3 space-y-1.5 overflow-y-auto max-h-[500px]">
        {phase.items.map(item => (
          <button
            key={item.id}
            onClick={() => onToggle(phase.phase, item.id, !item.completed)}
            className={`w-full text-left flex items-start gap-2.5 p-2 rounded-lg transition-colors group
              ${item.completed ? 'opacity-60 hover:opacity-80' : 'hover:bg-zinc-700/50'}`}
          >
            <div className={`mt-0.5 w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border transition-colors
              ${item.completed ? 'bg-green-600 border-green-500' : 'border-zinc-600 group-hover:border-zinc-400'}`}>
              {item.completed && <Check className="w-2.5 h-2.5 text-white" />}
            </div>
            <span className={`text-xs leading-relaxed ${item.completed ? 'line-through text-zinc-500' : 'text-zinc-300'}`}>
              {item.text}
            </span>
          </button>
        ))}

        {adding ? (
          <div className="pt-1">
            <input
              autoFocus
              value={newText}
              onChange={e => setNewText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false) }}
              placeholder="New item..."
              className="w-full text-xs bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
            />
            <div className="flex gap-1 mt-1">
              <button onClick={handleAdd} className="text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-200 rounded">Add</button>
              <button onClick={() => setAdding(false)} className="text-xs px-2 py-1 text-zinc-500 hover:text-zinc-300">Cancel</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="w-full flex items-center gap-2 p-2 text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add item
          </button>
        )}
      </div>
    </div>
  )
}

type BatchItem = ContentIntelRow & { erikNote: string; queuedAt: string }

function FilterBubble({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color?: string }) {
  const activeClass = color || 'bg-zinc-500 text-white'
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors border
        ${active
          ? `${activeClass} border-transparent`
          : 'bg-transparent border-zinc-600 text-zinc-400 hover:border-zinc-400 hover:text-zinc-200'
        }`}
    >
      {label}
    </button>
  )
}

function WeekGroup({
  weekKey,
  rows,
  defaultExpanded,
  children,
}: {
  weekKey: string
  rows: ContentIntelRow[]
  defaultExpanded: boolean
  children: React.ReactNode
}) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const label = parseWeekLabel(weekKey)

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-2 py-2 px-3 bg-zinc-800/60 hover:bg-zinc-800 rounded-lg border border-zinc-700 transition-colors text-left"
      >
        {expanded
          ? <ChevronDown className="w-4 h-4 text-zinc-500 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-zinc-500 shrink-0" />
        }
        <span className="text-sm font-semibold text-zinc-200">{label}</span>
        <span className="ml-auto text-xs text-zinc-500 bg-zinc-700 px-2 py-0.5 rounded-full">{rows.length} items</span>
      </button>
      {expanded && (
        <div className="mt-1 border border-zinc-800 rounded-lg overflow-hidden">
          {children}
        </div>
      )}
    </div>
  )
}

export default function MissionControl() {
  const [tab, setTab] = useState<'tasks' | 'phases' | 'intel'>('tasks')
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [intel, setIntel] = useState<ContentIntelRow[]>([])
  const [trashRows, setTrashRows] = useState<ContentIntelRow[]>([])
  const [batch, setBatch] = useState<BatchItem[]>([])

  const [filterTypes, setFilterTypes] = useState<string[]>([])
  const [filterBrands, setFilterBrands] = useState<string[]>([])
  const [filterSources, setFilterSources] = useState<string[]>([])

  const [showBatch, setShowBatch] = useState(false)
  const [sendingBatch, setSendingBatch] = useState(false)
  const [batchSent, setBatchSent] = useState(false)
  const [showTrash, setShowTrash] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [confirmEmptyTrash, setConfirmEmptyTrash] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [loading, setLoading] = useState(true)

  const sbRef = useRef<SupabaseClient | null>(null)
  function getSb() {
    if (!sbRef.current) {
      sbRef.current = createClient(
        'https://cjcvtkcqbaubyqlijssj.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqY3Z0a2NxYmF1YnlxbGlqc3NqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxMTg3NDMsImV4cCI6MjA4NzY5NDc0M30.kBZifO9Unx6kLvQ9Lqb-VKA3LDVQ-V9ROd-tLj2L-Jk'
      )
    }
    return sbRef.current
  }

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 4000)
  }

  async function fetchAll() {
    try {
      const results = await Promise.all([
        getSb().from('tasks').select('*').order('completedAt', { ascending: false, nullsFirst: false }),
        getSb().from('activity').select('*').order('timestamp', { ascending: false }).limit(50),
        getSb().from('ideas').select('*'),
        getSb().from('phases').select('*'),
        getSb().from('content_intel').select('*').or('deleted.is.null,deleted.eq.false').order('addedAt', { ascending: false }),
        getSb().from('content_intel').select('*').eq('deleted', true),
        getSb().from('batch_queue').select('*'),
      ])
      const [t, a, i, p, ci, tr, bq] = results
      setTasks(t.data || [])
      setActivity(a.data || [])
      setIdeas((i.data || []).map((idea: any) => ({ ...idea, pitch: idea.description || idea.pitch || '', effort: idea.effort || 'medium', impact: idea.impact || 'medium' })))
      setPhases((p.data || []).map((ph: any) => ({ ...ph, items: ph.milestones || ph.items || [] })))
      setIntel(ci.data || [])
      setTrashRows(tr.data || [])
      setBatch(bq.data || [])
      setLastRefresh(new Date())
    } catch(e) {
      console.error('fetchAll error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function addToBatch(id: string) {
    const row = intel.find(r => r.id === id)
    if (!row) return
    const { data: existing } = await getSb().from('batch_queue').select('id').eq('id', id).single()
    if (!existing) {
      await getSb().from('batch_queue').insert({ ...row, erikNote: '', queuedAt: new Date().toISOString() })
    }
    const { data: bq } = await getSb().from('batch_queue').select('*').order('queuedAt', { ascending: true })
    setBatch(bq || [])
  }

  async function removeFromBatch(id: string) {
    await getSb().from('batch_queue').delete().eq('id', id)
    const { data: bq } = await getSb().from('batch_queue').select('*').order('queuedAt', { ascending: true })
    setBatch(bq || [])
  }

  async function updateNote(id: string, note: string) {
    await getSb().from('batch_queue').update({ erikNote: note }).eq('id', id)
  }

  async function sendBatch() {
    setSendingBatch(true)
    await fetch('/api/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'send' })
    })
    setBatch([])
    setSendingBatch(false)
    setBatchSent(true)
    setShowBatch(false)
    setTimeout(() => setBatchSent(false), 5000)
  }

  async function softDelete(id: string) {
    const { error } = await getSb().from('content_intel').update({ deleted: true }).eq('id', id)
    if (error) {
      showToast('Delete failed. Run in Supabase: alter table content_intel add column if not exists deleted boolean default false;')
      return
    }
    const row = intel.find(r => r.id === id)
    if (row) setTrashRows(prev => [{ ...row, deleted: true }, ...prev])
    setIntel(prev => prev.filter(r => r.id !== id))
    setConfirmDeleteId(null)
    showToast('Moved to trash')
  }

  async function restoreRow(id: string) {
    const { error } = await getSb().from('content_intel').update({ deleted: false }).eq('id', id)
    if (error) { showToast('Restore failed'); return }
    const row = trashRows.find(r => r.id === id)
    if (row) setIntel(prev => [{ ...row, deleted: false }, ...prev])
    setTrashRows(prev => prev.filter(r => r.id !== id))
    showToast('Row restored')
  }

  async function emptyTrash() {
    const ids = trashRows.map(r => r.id)
    if (ids.length === 0) return
    const { error } = await getSb().from('content_intel').delete().in('id', ids)
    if (error) { showToast('Empty trash failed'); return }
    setTrashRows([])
    setConfirmEmptyTrash(false)
    showToast('Trash emptied permanently')
  }

  useEffect(() => {
    fetchAll()
    const interval = setInterval(fetchAll, 60000)
    return () => clearInterval(interval)
  }, [])

  async function handleToggle(phaseNum: number, itemId: string, completed: boolean) {
    setPhases(prev => prev.map(p =>
      p.phase !== phaseNum ? p : {
        ...p,
        items: p.items.map(i => i.id === itemId ? { ...i, completed } : i)
      }
    ))
    await fetch('/api/phases', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: phaseNum, id: itemId, completed })
    })
  }

  async function handleAdd(phaseNum: number, text: string) {
    const res = await fetch('/api/phases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phase: phaseNum, text })
    })
    const newItem = await res.json()
    setPhases(prev => prev.map(p =>
      p.phase !== phaseNum ? p : { ...p, items: [...p.items, newItem] }
    ))
  }

  const byStatus = (s: string) => tasks
    .filter(t => t.status === s)
    .sort((a, b) => {
      const dateA = a.completedAt || a.startedAt || ''
      const dateB = b.completedAt || b.startedAt || ''
      return dateB.localeCompare(dateA)
    })

  function toggleFilter(current: string[], value: string, set: (v: string[]) => void) {
    if (value === 'all') { set([]); return }
    if (current.includes(value)) set(current.filter(v => v !== value))
    else set([...current, value])
  }

  const filteredIntel = intel.filter(r => {
    const typeMatch = filterTypes.length === 0 || filterTypes.includes(normalizeType(r.type))
    const brandMatch = filterBrands.length === 0 || filterBrands.includes(r.brand)
    const sourceMatch = filterSources.length === 0 || filterSources.includes(r.source)
    return typeMatch && brandMatch && sourceMatch
  })

  const allSources = Array.from(new Set(intel.map(r => r.source))).sort()

  const currentWeek = getCurrentWeek()
  const weekGroups = (() => {
    const groups: Record<string, ContentIntelRow[]> = {}
    for (const row of filteredIntel) {
      const w = row.week || 'Unknown'
      if (!groups[w]) groups[w] = []
      groups[w].push(row)
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a))
  })()

  if (loading) return (
    <div className="min-h-screen bg-zinc-900 flex items-center justify-center">
      <div className="flex items-center gap-3 text-zinc-400">
        <Loader2 className="animate-spin w-5 h-5" />
        <span>Loading Mission Control...</span>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-zinc-900 text-zinc-100 font-sans">
      {toastMsg && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-zinc-700 border border-zinc-600 text-zinc-100 text-sm px-5 py-3 rounded-xl shadow-xl max-w-lg text-center">
          {toastMsg}
        </div>
      )}

      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔑</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Mission Control</h1>
            <p className="text-xs text-zinc-500">Foreman — Erik Bledsoe Chief of Staff</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setTab('tasks')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${tab === 'tasks' ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Zap className="w-3.5 h-3.5" /> Task Board
            </button>
            <button
              onClick={() => setTab('phases')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${tab === 'phases' ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Map className="w-3.5 h-3.5" /> Phase Roadmap
            </button>
            <button
              onClick={() => setTab('intel')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors
                ${tab === 'intel' ? 'bg-zinc-600 text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <Brain className="w-3.5 h-3.5" /> Content Intel
              {batch.length > 0 && (
                <span className="bg-yellow-500 text-zinc-900 text-xs font-bold px-1.5 py-0.5 rounded-full ml-1">
                  {batch.length}
                </span>
              )}
            </button>
          </div>
          <span className="text-xs text-zinc-600">Refreshed {fmt(lastRefresh.toISOString())}</span>
          <button onClick={() => signOut()} className="text-zinc-600 hover:text-zinc-400 transition-colors ml-2" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
          <button onClick={fetchAll} className="text-zinc-500 hover:text-zinc-300 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {tab === 'tasks' && (
        <div className="max-w-screen-xl mx-auto px-6 py-8 space-y-10">
          <section>
            <div className="flex items-center gap-2 mb-5">
              <Zap className="w-5 h-5 text-yellow-400" />
              <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300">Task Board</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <Column title="Backlog" tasks={byStatus('backlog')} color="bg-zinc-500" />
              <Column title="In Progress" tasks={byStatus('in-progress')} color="bg-blue-500" />
              <Column title="Waiting on Erik" tasks={byStatus('waiting')} color="bg-yellow-500" />
              <Column title="Completed" tasks={byStatus('completed')} color="bg-green-500" />
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            <section>
              <div className="flex items-center gap-2 mb-5">
                <Clock className="w-5 h-5 text-blue-400" />
                <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300">Activity Log</h2>
              </div>
              <div className="bg-zinc-800 border border-zinc-700 rounded-lg divide-y divide-zinc-700 max-h-[480px] overflow-y-auto">
                {activity.map(a => (
                  <div key={a.id} className="px-4 py-3 flex gap-3">
                    <span className="text-xs text-zinc-500 font-mono whitespace-nowrap pt-0.5 min-w-[110px]">
                      {new Date(a.timestamp).toLocaleString('en-US', {
                        month: 'short', day: 'numeric',
                        hour: 'numeric', minute: '2-digit',
                        hour12: true, timeZone: 'America/Chicago'
                      })}
                    </span>
                    <p className="text-sm text-zinc-300 leading-relaxed">{a.entry}</p>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="flex items-center gap-2 mb-5">
                <Lightbulb className="w-5 h-5 text-yellow-400" />
                <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300">Idea Queue</h2>
              </div>
              <div className="space-y-3">
                {ideas.map(idea => (
                  <div key={idea.id} className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-zinc-100">{idea.title}</h4>
                      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${
                        idea.status === 'in-progress' ? 'bg-blue-900 text-blue-300' : 'bg-zinc-700 text-zinc-400'
                      }`}>
                        {idea.status}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 leading-relaxed">{idea.pitch}</p>
                    <div className="flex items-center gap-4">
                      <ImpactBadge label="Effort" value={idea.effort} />
                      <ImpactBadge label="Impact" value={idea.impact} />
                      <span className="text-xs text-zinc-600 ml-auto">{fmt(idea.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      )}

      {tab === 'phases' && (
        <div className="px-6 py-8">
          <div className="flex items-center gap-2 mb-6">
            <Map className="w-5 h-5 text-green-400" />
            <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300">Phase Roadmap — $1M by End of 2026</h2>
          </div>

          <div className="mb-8 bg-zinc-800 border border-zinc-700 rounded-xl p-4 flex items-center gap-6 flex-wrap">
            {phases.map((p, idx) => {
              const done = p.items.filter(i => i.completed).length
              const total = p.items.length
              const pct = total > 0 ? Math.round((done / total) * 100) : 0
              const colors = PHASE_COLORS[idx]
              return (
                <div key={p.phase} className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${colors.dot}`} />
                  <span className="text-xs text-zinc-400">Ph{p.phase}</span>
                  <span className={`text-xs font-bold ${colors.header}`}>{pct}%</span>
                </div>
              )
            })}
            <div className="ml-auto text-xs text-zinc-500">
              {phases.reduce((acc, p) => acc + p.items.filter(i => i.completed).length, 0)} of {phases.reduce((acc, p) => acc + p.items.length, 0)} total items complete
            </div>
          </div>

          <div className="flex gap-4 overflow-x-auto pb-6">
            {phases.map((phase, idx) => (
              <PhaseColumn
                key={phase.phase}
                phase={phase}
                colors={PHASE_COLORS[idx]}
                onToggle={handleToggle}
                onAdd={handleAdd}
              />
            ))}
          </div>
        </div>
      )}

      {tab === 'intel' && (
        <div className="px-6 py-8">

          {batchSent && (
            <div className="mb-4 bg-green-900/50 border border-green-600 rounded-xl px-4 py-3 flex items-center gap-2 text-green-300 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Batch sent to Foreman — drafts will be written to your Google Sheets shortly.
            </div>
          )}

          {showBatch && (
            <div className="mb-6 bg-zinc-800 border border-yellow-600/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-yellow-400 font-bold text-sm">📋 Batch Queue — {batch.length} item{batch.length !== 1 ? 's' : ''}</span>
                  <span className="text-zinc-500 text-xs">Add your angle note for each, then send when ready</span>
                </div>
                <button onClick={() => setShowBatch(false)} className="text-zinc-500 hover:text-zinc-300 text-xs">Hide</button>
              </div>
              <div className="space-y-3 mb-4">
                {batch.map(item => (
                  <div key={item.id} className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 flex gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.brand === 'TTH' ? 'bg-blue-800 text-blue-200' : 'bg-green-800 text-green-200'}`}>{item.brand}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLORS[item.source] || 'bg-zinc-700 text-zinc-300'}`}>{item.source}</span>
                        <span className="text-xs text-zinc-500">{item.format}</span>
                      </div>
                      <p className="text-xs text-zinc-200 italic mb-2">"{item.rawFinding}"</p>
                      <p className="text-xs text-zinc-400 mb-2">Hook: {item.hookSuggestion}</p>
                      <input
                        defaultValue={item.erikNote}
                        onBlur={e => updateNote(item.id, e.target.value)}
                        placeholder="Your angle note (optional)..."
                        className="w-full text-xs bg-zinc-800 border border-zinc-600 rounded px-2 py-1.5 text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-zinc-400"
                      />
                    </div>
                    <button onClick={() => removeFromBatch(item.id)} className="text-zinc-600 hover:text-red-400 transition-colors shrink-0 mt-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
                {batch.length === 0 && (
                  <p className="text-center text-zinc-600 text-xs py-4">No items in queue. Click "Add to Batch" on any row below.</p>
                )}
              </div>
              {batch.length > 0 && (
                <button
                  onClick={sendBatch}
                  disabled={sendingBatch}
                  className="w-full py-2.5 bg-yellow-500 hover:bg-yellow-400 text-zinc-900 font-bold text-sm rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {sendingBatch ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : `🚀 Send Batch to Foreman (${batch.length} item${batch.length !== 1 ? 's' : ''})`}
                </button>
              )}
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300">Content Intelligence</h2>
              <span className="text-xs text-zinc-500 ml-2">Updated daily 5AM (Breakouts + Trends) + Monday 6AM (Monday Intel)</span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBatch(!showBatch)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                  ${batch.length > 0 ? 'bg-yellow-500 text-zinc-900 hover:bg-yellow-400' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
              >
                📋 Batch Queue {batch.length > 0 && `(${batch.length})`}
              </button>
              <button
                onClick={() => setShowTrash(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border
                  ${showTrash ? 'bg-red-900/60 text-red-300 border-red-700' : 'text-zinc-500 hover:text-zinc-300 border-zinc-700'}`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Trash {trashRows.length > 0 && `(${trashRows.length})`}
              </button>
            </div>
          </div>

          {/* Trash view */}
          {showTrash && (
            <div className="mb-8 bg-zinc-900 border border-red-800/40 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-red-400 font-bold text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4" /> Trash — {trashRows.length} soft-deleted item{trashRows.length !== 1 ? 's' : ''}
                </span>
                {trashRows.length > 0 && (
                  confirmEmptyTrash ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-zinc-400">Permanently delete all?</span>
                      <button onClick={emptyTrash} className="text-xs px-3 py-1 bg-red-700 hover:bg-red-600 text-white rounded-lg font-bold">Yes, empty trash</button>
                      <button onClick={() => setConfirmEmptyTrash(false)} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setConfirmEmptyTrash(true)}
                      className="text-xs px-3 py-1.5 bg-zinc-800 hover:bg-red-900/40 text-zinc-400 hover:text-red-400 border border-zinc-700 rounded-lg transition-colors"
                    >
                      Empty Trash
                    </button>
                  )
                )}
              </div>
              {trashRows.length === 0 ? (
                <p className="text-center text-zinc-600 text-xs py-8">Trash is empty.</p>
              ) : (
                <div className="space-y-2">
                  {trashRows.map(row => (
                    <div key={row.id} className="bg-zinc-800/40 border border-zinc-700 rounded-lg p-3 flex items-start gap-3 opacity-70">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${row.brand === 'TTH' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'}`}>{row.brand}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLORS[row.source] || 'bg-zinc-700 text-zinc-300'}`}>{row.source}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[normalizeType(row.type)] || 'bg-zinc-700 text-zinc-300'}`}>{normalizeType(row.type)}</span>
                          <span className="text-xs text-zinc-600">{row.week}</span>
                        </div>
                        <p className="text-xs text-zinc-400 italic">"{row.rawFinding}"</p>
                      </div>
                      <button
                        onClick={() => restoreRow(row.id)}
                        className="shrink-0 flex items-center gap-1.5 text-xs px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-lg transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" /> Restore
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <p className="mt-4 text-xs text-zinc-600">
                💡 If trash is not working, run in Supabase SQL editor:{' '}
                <code className="bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">alter table content_intel add column if not exists deleted boolean default false;</code>
              </p>
            </div>
          )}

          {/* Filter bubbles */}
          <div className="mb-5 space-y-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-600 w-14 shrink-0">Type</span>
              <FilterBubble label="All" active={filterTypes.length === 0} onClick={() => setFilterTypes([])} color="bg-zinc-500 text-white" />
              {['Breakout', 'Trend', 'Monday Intel', 'Raw Question', 'Cultural Moment'].map(t => (
                <FilterBubble
                  key={t} label={t}
                  active={filterTypes.includes(t)}
                  onClick={() => toggleFilter(filterTypes, t, setFilterTypes)}
                  color={
                    t === 'Breakout' ? 'bg-orange-700 text-orange-100' :
                    t === 'Trend' ? 'bg-blue-700 text-blue-100' :
                    t === 'Monday Intel' ? 'bg-purple-700 text-purple-100' :
                    t === 'Raw Question' ? 'bg-yellow-700 text-yellow-100' :
                    'bg-pink-800 text-pink-100'
                  }
                />
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-zinc-600 w-14 shrink-0">Brand</span>
              <FilterBubble label="All" active={filterBrands.length === 0} onClick={() => setFilterBrands([])} color="bg-zinc-500 text-white" />
              <FilterBubble label="TTH" active={filterBrands.includes('TTH')} onClick={() => toggleFilter(filterBrands, 'TTH', setFilterBrands)} color="bg-blue-700 text-blue-100" />
              <FilterBubble label="EBB" active={filterBrands.includes('EBB')} onClick={() => toggleFilter(filterBrands, 'EBB', setFilterBrands)} color="bg-green-700 text-green-100" />
            </div>
            {allSources.length > 0 && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-zinc-600 w-14 shrink-0">Source</span>
                <FilterBubble label="All" active={filterSources.length === 0} onClick={() => setFilterSources([])} color="bg-zinc-500 text-white" />
                {allSources.map(src => (
                  <FilterBubble
                    key={src} label={src}
                    active={filterSources.includes(src)}
                    onClick={() => toggleFilter(filterSources, src, setFilterSources)}
                    color={
                      src === 'Reddit' ? 'bg-orange-800 text-orange-200' :
                      src === 'YouTube' ? 'bg-red-800 text-red-200' :
                      src === 'Trends' ? 'bg-blue-800 text-blue-200' :
                      src === 'X' ? 'bg-zinc-600 text-zinc-200' :
                      'bg-purple-800 text-purple-200'
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Stats */}
          <div className="mb-4 text-xs text-zinc-500 flex gap-3 flex-wrap">
            <span>{filteredIntel.length} rows</span>
            {filterTypes.length > 0 && <span>· type: {filterTypes.join(', ')}</span>}
            {filterBrands.length > 0 && <span>· brand: {filterBrands.join(', ')}</span>}
            {filterSources.length > 0 && <span>· source: {filterSources.join(', ')}</span>}
          </div>

          {/* Week-grouped rows */}
          {weekGroups.length === 0 ? (
            <div className="text-center py-16 text-zinc-600">
              <Brain className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">No intel matches your filters.</p>
              <p className="text-xs mt-1">Monday Intel runs every Monday at 6AM.</p>
            </div>
          ) : (
            weekGroups.map(([weekKey, rows]) => (
              <WeekGroup key={weekKey} weekKey={weekKey} rows={rows} defaultExpanded={weekKey === currentWeek}>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-zinc-700 bg-zinc-900/40">
                      <th className="text-left text-zinc-500 uppercase tracking-wider py-2 px-3 font-medium w-36">Source</th>
                      <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-3 font-medium w-28">Type</th>
                      <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-3 font-medium w-14">Brand</th>
                      <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-3 font-medium">Raw Finding</th>
                      <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-3 font-medium">Hook</th>
                      <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-3 font-medium w-28">Format</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80">
                    {rows.map(row => (
                      <tr key={row.id} className="hover:bg-zinc-800/40 transition-colors group">
                        <td className="py-3 px-3 min-w-[140px]">
                          <div className="space-y-1">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[row.source] || 'bg-zinc-700 text-zinc-300'}`}>
                              {row.source}
                            </span>
                            {row.link ? (
                              <a href={row.link} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 text-blue-400 hover:text-blue-300 text-xs transition-colors mt-0.5">
                                <ExternalLink className="w-3 h-3 shrink-0" />
                                <span className="truncate max-w-[120px]">{row.sourceDetail || row.link}</span>
                              </a>
                            ) : (
                              <div className="text-zinc-500 text-xs mt-0.5">{row.sourceDetail}</div>
                            )}
                          </div>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[normalizeType(row.type)] || 'bg-zinc-700 text-zinc-300'}`}>
                            {normalizeType(row.type) || 'Monday Intel'}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full ${row.brand === 'TTH' ? 'bg-blue-900/60 text-blue-300' : 'bg-green-900/60 text-green-300'}`}>
                            {row.brand}
                          </span>
                        </td>
                        <td className="py-3 pr-3 max-w-xs">
                          <p className="text-zinc-200 leading-relaxed italic">"{row.rawFinding}"</p>
                        </td>
                        <td className="py-3 pr-3 max-w-xs">
                          <p className="text-zinc-300 font-medium leading-snug">{row.hookSuggestion}</p>
                          <p className="text-zinc-500 mt-1">{row.angle}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="text-zinc-400 bg-zinc-800 px-2 py-1 rounded text-xs">{row.format}</span>
                        </td>
                        <td className="py-3 pr-3">
                          <div className="flex items-center gap-1.5">
                            <div className="opacity-0 group-hover:opacity-100 transition-all">
                              {batch.find(b => b.id === row.id) ? (
                                <button
                                  onClick={() => removeFromBatch(row.id)}
                                  className="text-xs px-2 py-1 bg-yellow-600 hover:bg-yellow-500 text-zinc-900 font-bold rounded transition-colors whitespace-nowrap"
                                >
                                  ✓ Queued
                                </button>
                              ) : (
                                <button
                                  onClick={() => addToBatch(row.id)}
                                  className="text-xs px-2 py-1 bg-zinc-700 hover:bg-yellow-500 hover:text-zinc-900 text-zinc-300 font-medium rounded transition-colors whitespace-nowrap"
                                >
                                  + Batch
                                </button>
                              )}
                            </div>
                            {confirmDeleteId === row.id ? (
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <span className="text-xs text-zinc-400">Delete?</span>
                                <button onClick={() => softDelete(row.id)} className="text-xs px-1.5 py-0.5 bg-red-700 hover:bg-red-600 text-white rounded font-bold">Yes</button>
                                <button onClick={() => setConfirmDeleteId(null)} className="text-xs text-zinc-500 hover:text-zinc-300">No</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(row.id)}
                                className="text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                                title="Move to trash"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </WeekGroup>
            ))
          )}
        </div>
      )}
    </div>
  )
}
