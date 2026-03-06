'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { Clock, Zap, Lightbulb, CheckCircle2, Loader2, AlertCircle, Circle, RefreshCw, Map, Plus, Check, Brain, ExternalLink, Trash2, LogOut } from 'lucide-react'
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
  'Outlier Content': 'bg-green-900/50 text-green-300',
  'Trend': 'bg-blue-900/50 text-blue-300',
  'Cultural Moment': 'bg-pink-900/50 text-pink-300',
}

function fmt(ts: string | null) {
  if (!ts) return '—'
  return new Date(ts).toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
    hour12: true, timeZone: 'America/Chicago'
  })
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
      <div className={`flex items-center gap-2 mb-3 pb-2 border-b border-zinc-700`}>
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
      {/* Phase Header */}
      <div className="p-4 border-b border-zinc-700/50">
        <div className="flex items-center gap-2 mb-1">
          <span className={`w-2.5 h-2.5 rounded-full ${colors.dot}`} />
          <span className={`text-xs font-bold uppercase tracking-widest ${colors.header}`}>Phase {phase.phase}</span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${colors.badge}`}>{pct}%</span>
        </div>
        <h3 className="text-base font-bold text-zinc-100">{phase.label}</h3>
        <p className="text-xs text-zinc-500 mt-0.5">{phase.dateRange}</p>
        <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{phase.goal}</p>
        {/* Progress bar */}
        <div className="mt-3 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${colors.dot}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-xs text-zinc-600 mt-1">{done} of {total} complete</p>
      </div>

      {/* Items */}
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

        {/* Add item */}
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

export default function MissionControl() {
  const [tab, setTab] = useState<'tasks' | 'phases' | 'intel'>('tasks')
  const [tasks, setTasks] = useState<Task[]>([])
  const [activity, setActivity] = useState<Activity[]>([])
  const [ideas, setIdeas] = useState<Idea[]>([])
  const [phases, setPhases] = useState<Phase[]>([])
  const [intel, setIntel] = useState<ContentIntelRow[]>([])
  const [batch, setBatch] = useState<BatchItem[]>([])
  const [intelBrand, setIntelBrand] = useState<'TTH' | 'EBB'>('TTH')
  const [intelWeek, setIntelWeek] = useState<string>('all')
  const [showBatch, setShowBatch] = useState(false)
  const [sendingBatch, setSendingBatch] = useState(false)
  const [batchSent, setBatchSent] = useState(false)
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

  async function fetchWithTimeout(url: string, ms = 8000) {
    const controller = new AbortController()
    const id = setTimeout(() => controller.abort(), ms)
    try {
      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(id)
      return res.json()
    } catch {
      clearTimeout(id)
      return []
    }
  }

  async function fetchAll() {
    try {
      const results = await Promise.all([
        getSb().from('tasks').select('*'),
        getSb().from('activity').select('*').order('timestamp', { ascending: false }).limit(50),
        getSb().from('ideas').select('*'),
        getSb().from('phases').select('*'),
        getSb().from('content_intel').select('*').order('addedAt', { ascending: false }),
        getSb().from('batch_queue').select('*'),
      ])
      const [t, a, i, p, ci, bq] = results
      console.log('Supabase results:', results.map(r => ({ data: r.data?.length, error: r.error })))
      setTasks(t.data || [])
      setActivity(a.data || [])
      setIdeas((i.data || []).map((idea: any) => ({ ...idea, pitch: idea.description || idea.pitch || '', effort: idea.effort || 'medium', impact: idea.impact || 'medium' })))
      setPhases((p.data || []).map((ph: any) => ({ ...ph, items: ph.milestones || ph.items || [] })))
      setIntel(ci.data || [])
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

  const byStatus = (s: string) => tasks.filter(t => t.status === s)

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
      {/* Header */}
      <div className="border-b border-zinc-800 px-6 py-4 flex items-center justify-between sticky top-0 bg-zinc-900 z-10">
        <div className="flex items-center gap-3">
          <span className="text-xl">🔑</span>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Mission Control</h1>
            <p className="text-xs text-zinc-500">Foreman — Erik Bledsoe Chief of Staff</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Tabs */}
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

      {/* Task Board Tab */}
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

      {/* Phase Roadmap Tab */}
      {tab === 'phases' && (
        <div className="px-6 py-8">
          <div className="flex items-center gap-2 mb-6">
            <Map className="w-5 h-5 text-green-400" />
            <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300">Phase Roadmap — $1M by End of 2026</h2>
          </div>

          {/* Overall progress */}
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

          {/* Phase columns — horizontal scroll */}
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

      {/* Content Intel Tab */}
      {tab === 'intel' && (
        <div className="px-6 py-8">

          {/* Batch sent confirmation */}
          {batchSent && (
            <div className="mb-4 bg-green-900/50 border border-green-600 rounded-xl px-4 py-3 flex items-center gap-2 text-green-300 text-sm">
              <CheckCircle2 className="w-4 h-4" /> Batch sent to Foreman — drafts will be written to your Google Sheets shortly.
            </div>
          )}

          {/* Batch Queue Drawer */}
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

          <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold uppercase tracking-widest text-zinc-300">Content Intelligence</h2>
              <span className="text-xs text-zinc-500 ml-2">Updated every Monday 6AM + daily outlier scan</span>
            </div>
            {/* Batch + Filters */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBatch(!showBatch)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors
                  ${batch.length > 0 ? 'bg-yellow-500 text-zinc-900 hover:bg-yellow-400' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'}`}
              >
                📋 Batch Queue {batch.length > 0 && `(${batch.length})`}
              </button>
              {/* Brand toggle */}
              <div className="flex items-center bg-zinc-800 rounded-lg p-1 gap-1">
                <button
                  onClick={() => setIntelBrand('TTH')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors
                    ${intelBrand === 'TTH' ? 'bg-blue-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Take the Hill
                </button>
                <button
                  onClick={() => setIntelBrand('EBB')}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors
                    ${intelBrand === 'EBB' ? 'bg-green-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  Erik Bledsoe Brand
                </button>
              </div>
              {/* Week filter */}
              <select
                value={intelWeek}
                onChange={e => setIntelWeek(e.target.value)}
                className="text-xs bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg px-3 py-1.5 focus:outline-none"
              >
                <option value="all">All weeks</option>
                {Array.from(new Set(intel.map(r => r.week))).sort().reverse().map(w => (
                  <option key={w} value={w}>{w}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Stats bar */}
          {(() => {
            const filtered = intel.filter(r =>
              r.brand === intelBrand && (intelWeek === 'all' || r.week === intelWeek)
            )
            const bySource = filtered.reduce((acc: Record<string,number>, r) => {
              acc[r.source] = (acc[r.source] || 0) + 1
              return acc
            }, {})
            return (
              <div className="mb-6 flex items-center gap-4 flex-wrap">
                <span className="text-xs text-zinc-500">{filtered.length} rows</span>
                {Object.entries(bySource).map(([src, count]) => (
                  <span key={src} className={`text-xs px-2 py-0.5 rounded-full ${SOURCE_COLORS[src] || 'bg-zinc-700 text-zinc-300'}`}>
                    {src}: {count}
                  </span>
                ))}
              </div>
            )
          })()}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-700">
                  <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-4 font-medium w-24">Week</th>
                  <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-4 font-medium w-28">Source</th>
                  <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-4 font-medium w-24">Type</th>
                  <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-4 font-medium">Raw Finding</th>
                  <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-4 font-medium">Hook</th>
                  <th className="text-left text-zinc-500 uppercase tracking-wider py-2 pr-4 font-medium w-32">Format</th>
                  <th className="text-left text-zinc-500 uppercase tracking-wider py-2 font-medium w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {intel
                  .filter(r => r.brand === intelBrand && (intelWeek === 'all' || r.week === intelWeek))
                  .map(row => (
                    <tr key={row.id} className="hover:bg-zinc-800/50 transition-colors group">
                      <td className="py-3 pr-4 text-zinc-500 font-mono whitespace-nowrap">{row.week}</td>
                      <td className="py-3 pr-4">
                        <div className="space-y-1">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[row.source] || 'bg-zinc-700 text-zinc-300'}`}>
                            {row.source}
                          </span>
                          <div className="text-zinc-600 text-xs">{row.sourceDetail}</div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[row.type] || 'bg-zinc-700 text-zinc-300'}`}>
                          {row.type}
                        </span>
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        <p className="text-zinc-200 leading-relaxed italic">"{row.rawFinding}"</p>
                        {row.link && (
                          <a href={row.link} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-zinc-500 hover:text-blue-400 mt-1 transition-colors">
                            <ExternalLink className="w-3 h-3" /> View source
                          </a>
                        )}
                      </td>
                      <td className="py-3 pr-4 max-w-xs">
                        <p className="text-zinc-300 font-medium leading-snug">{row.hookSuggestion}</p>
                        <p className="text-zinc-500 mt-1">{row.angle}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-zinc-400 bg-zinc-800 px-2 py-1 rounded text-xs">{row.format}</span>
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
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
                          <button
                            onClick={async () => {
                              await fetch('/api/content-intel', {
                                method: 'DELETE',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ id: row.id })
                              })
                              setIntel(prev => prev.filter(r => r.id !== row.id))
                            }}
                            className="text-zinc-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
            {intel.filter(r => r.brand === intelBrand && (intelWeek === 'all' || r.week === intelWeek)).length === 0 && (
              <div className="text-center py-16 text-zinc-600">
                <Brain className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No intel yet for this brand/week.</p>
                <p className="text-xs mt-1">Scout runs every Monday at 6AM.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
