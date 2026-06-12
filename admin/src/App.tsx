import { useState, useEffect, useCallback } from 'react'

// ── Types ───────────────────────────────────────────────

interface WatchlistDcf {
  watch: string
  field: string
}

interface Watchlist {
  dcf_enabled?: boolean
  dcf_inputs: WatchlistDcf[]
  interview_watch?: string[]
}

interface ExtractedFact {
  fact: string
  category: string
  type: 'dcf_input' | 'interview_mention' | 'general'
  field?: string
  value?: number
  person?: string
  venue?: string
  approx_date?: string
  context?: string
  source: string
  channel: string
  extractedAt: string
  status: 'pending' | 'approved' | 'rejected'
}

type Tab = 'review' | 'watchlist'

// ── API helpers ─────────────────────────────────────────

async function api<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const opts: RequestInit = { method, headers: { 'Content-Type': 'application/json' } }
  if (body) opts.body = JSON.stringify(body)
  const res = await fetch(`/api${path}`, opts)
  return res.json()
}

// ── App ─────────────────────────────────────────────────

export default function App() {
  const [tab, setTab] = useState<Tab>('review')
  const [publishing, setPublishing] = useState(false)
  const [publishMsg, setPublishMsg] = useState<string | null>(null)

  const publish = async () => {
    setPublishing(true)
    setPublishMsg(null)
    const res = await api<{ ok: boolean; message?: string; error?: string }>('/publish', 'POST', {
      message: 'Admin console: update watchlist/facts',
    })
    setPublishMsg(res.ok ? res.message || 'Published' : `Error: ${res.error}`)
    setPublishing(false)
    setTimeout(() => setPublishMsg(null), 5000)
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '16px 20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: 'var(--green)', fontWeight: 'bold', fontSize: 18 }}>[TTT]</span>
          <span style={{ color: 'var(--text-bright)', fontWeight: 'bold', fontSize: 16 }}>ADMIN CONSOLE</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {publishMsg && (
            <span style={{ color: publishMsg.startsWith('Error') ? 'var(--red)' : 'var(--green)', fontSize: 11 }}>
              {publishMsg}
            </span>
          )}
          <button onClick={publish} disabled={publishing} style={btnStyle('green')}>
            {publishing ? 'PUBLISHING...' : '[PUBLISH]'}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {([['review', 'REVIEW QUEUE'], ['watchlist', 'WATCHLIST']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 'bold',
              cursor: 'pointer',
              border: '1px solid var(--border)',
              background: tab === key ? 'var(--green)' : 'transparent',
              color: tab === key ? 'var(--bg)' : 'var(--text-dim)',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {tab === 'review' && <ReviewQueue />}
      {tab === 'watchlist' && <WatchlistEditor />}
    </div>
  )
}

function btnStyle(color: 'green' | 'red' | 'dim' | 'amber'): React.CSSProperties {
  const colors = {
    green: 'var(--green)',
    red: 'var(--red)',
    dim: 'var(--text-dim)',
    amber: 'var(--amber)',
  }
  return {
    padding: '4px 10px',
    fontSize: 11,
    fontWeight: 'bold',
    cursor: 'pointer',
    border: `1px solid ${colors[color]}`,
    background: 'transparent',
    color: colors[color],
    transition: 'all 0.15s',
  }
}

// ── Review Queue ────────────────────────────────────────

function ReviewQueue() {
  const [facts, setFacts] = useState<ExtractedFact[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending')
  const [typeFilter, setTypeFilter] = useState<'all' | 'interview_mention' | 'dcf_input'>('interview_mention')

  const load = useCallback(async () => {
    const f = await api<ExtractedFact[]>('/facts')
    setFacts(f)
  }, [])

  useEffect(() => { load() }, [load])

  const updateFact = async (idx: number, status: ExtractedFact['status']) => {
    const updated = [...facts]
    updated[idx] = { ...updated[idx], status }
    setFacts(updated)
    await api('/facts', 'PUT', updated)
  }

  const filtered = facts.filter(f =>
    (filter === 'all' || f.status === filter) &&
    (typeFilter === 'all' || f.type === typeFilter)
  )
  const pendingCount = facts.filter(f => f.status === 'pending' && (typeFilter === 'all' || f.type === typeFilter)).length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ color: 'var(--green-dim)', fontSize: 12, fontWeight: 'bold' }}>
          EXTRACTED FACTS ({pendingCount} pending)
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              ...btnStyle('dim'),
              color: filter === f ? 'var(--green)' : 'var(--text-dim)',
              borderColor: filter === f ? 'var(--green)' : 'var(--border)',
            }}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 11 }}>TYPE:</span>
          {([['interview_mention', 'INTERVIEWS'], ['dcf_input', 'DCF'], ['all', 'ALL']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTypeFilter(key)} style={{
              ...btnStyle('dim'),
              color: typeFilter === key ? 'var(--amber)' : 'var(--text-dim)',
              borderColor: typeFilter === key ? 'var(--amber)' : 'var(--border)',
            }}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={{ color: 'var(--text-dim)', fontSize: 12, padding: 20, textAlign: 'center', border: '1px solid var(--border)' }}>
          {facts.length === 0 ? 'No extracted facts yet. Run the pipeline to populate.' : `No ${filter} facts.`}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {filtered.map((fact, i) => {
            const realIdx = facts.indexOf(fact)
            return (
              <div key={i} style={{ border: '1px solid var(--border)', background: 'var(--surface)', padding: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--text-bright)', fontSize: 12, marginBottom: 4 }}>{fact.fact}</div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 11 }}>
                      <span style={{ color: fact.type === 'dcf_input' ? 'var(--green-dim)' : fact.type === 'interview_mention' ? 'var(--amber)' : 'var(--text-dim)' }}>
                        [{fact.type}]
                      </span>
                      {fact.field && <span style={{ color: 'var(--text-dim)' }}>field: {fact.field}</span>}
                      {fact.value != null && <span style={{ color: 'var(--text-dim)' }}>value: {fact.value}</span>}
                      {fact.person && <span style={{ color: 'var(--text-dim)' }}>person: {fact.person}</span>}
                      {fact.venue && <span style={{ color: 'var(--text-dim)' }}>venue: {fact.venue}</span>}
                      {fact.approx_date && <span style={{ color: 'var(--text-dim)' }}>date: {fact.approx_date}</span>}
                      <span style={{ color: 'var(--text-dim)' }}>{fact.channel}</span>
                      <span style={{ color: 'var(--text-dim)' }}>{fact.source}</span>
                    </div>
                    {fact.context && <div style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 4 }}>{fact.context}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {fact.status === 'pending' && (
                      <>
                        <button onClick={() => updateFact(realIdx, 'approved')} style={btnStyle('green')}>[APPROVE]</button>
                        <button onClick={() => updateFact(realIdx, 'rejected')} style={btnStyle('red')}>[REJECT]</button>
                      </>
                    )}
                    {fact.status !== 'pending' && (
                      <span style={{ fontSize: 11, color: fact.status === 'approved' ? 'var(--green-dim)' : 'var(--red)', fontWeight: 'bold' }}>
                        {fact.status.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function inputStyle(width?: number): React.CSSProperties {
  return {
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    color: 'var(--text-bright)',
    padding: '4px 8px',
    fontSize: 12,
    ...(width ? { width } : {}),
  }
}

// ── Watchlist Editor ────────────────────────────────────

function WatchlistEditor() {
  const [watchlist, setWatchlist] = useState<Watchlist>({ dcf_inputs: [], interview_watch: [] })
  const [dirty, setDirty] = useState(false)

  useEffect(() => { api<Watchlist>('/watchlist').then(w => setWatchlist({ interview_watch: [], ...w })) }, [])

  const save = async () => {
    await api('/watchlist', 'PUT', watchlist)
    setDirty(false)
  }

  const updateDcf = (idx: number, field: keyof WatchlistDcf, value: string) => {
    const next = { ...watchlist, dcf_inputs: [...watchlist.dcf_inputs] }
    next.dcf_inputs[idx] = { ...next.dcf_inputs[idx], [field]: value }
    setWatchlist(next)
    setDirty(true)
  }

  const removeDcf = (idx: number) => {
    const next = { ...watchlist, dcf_inputs: watchlist.dcf_inputs.filter((_, i) => i !== idx) }
    setWatchlist(next)
    setDirty(true)
  }

  const addDcf = () => {
    setWatchlist({ ...watchlist, dcf_inputs: [...watchlist.dcf_inputs, { watch: '', field: '' }] })
    setDirty(true)
  }

  const persons = watchlist.interview_watch || []

  const updatePerson = (idx: number, value: string) => {
    const next = [...persons]
    next[idx] = value
    setWatchlist({ ...watchlist, interview_watch: next })
    setDirty(true)
  }

  const removePerson = (idx: number) => {
    setWatchlist({ ...watchlist, interview_watch: persons.filter((_, i) => i !== idx) })
    setDirty(true)
  }

  const addPerson = () => {
    setWatchlist({ ...watchlist, interview_watch: [...persons, ''] })
    setDirty(true)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ color: 'var(--green-dim)', fontSize: 12, fontWeight: 'bold' }}>PROMPT WATCHLIST</span>
        {dirty && <button onClick={save} style={btnStyle('amber')}>[SAVE]</button>}
      </div>

      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--green-dim)', fontSize: 11, fontWeight: 'bold' }}>DCF INPUT PATTERNS</span>
          <button
            onClick={() => { setWatchlist({ ...watchlist, dcf_enabled: watchlist.dcf_enabled === false }); setDirty(true) }}
            style={btnStyle(watchlist.dcf_enabled === false ? 'red' : 'green')}
          >
            {watchlist.dcf_enabled === false ? '[EXTRACTION: OFF]' : '[EXTRACTION: ON]'}
          </button>
          <button onClick={addDcf} style={btnStyle('green')}>[ADD]</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {watchlist.dcf_inputs.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={d.watch}
                onChange={e => updateDcf(i, 'watch', e.target.value)}
                placeholder="Watch pattern"
                style={{ ...inputStyle(0), flex: 1 }}
              />
              <input
                value={d.field}
                onChange={e => updateDcf(i, 'field', e.target.value)}
                placeholder="DCF field"
                style={inputStyle(160)}
              />
              <button onClick={() => removeDcf(i)} style={btnStyle('red')}>[X]</button>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ color: 'var(--green-dim)', fontSize: 11, fontWeight: 'bold' }}>INTERVIEW WATCH (PERSONS)</span>
          <button onClick={addPerson} style={btnStyle('green')}>[ADD]</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {persons.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={p}
                onChange={e => updatePerson(i, e.target.value)}
                placeholder="Person name (optionally with role)"
                style={{ ...inputStyle(0), flex: 1 }}
              />
              <button onClick={() => removePerson(i)} style={btnStyle('red')}>[X]</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
