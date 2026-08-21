import { CHANNEL_META, type Article, type Bias } from '../../types'

export function formatDate(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function signalTag(signal: string | null) {
  if (!signal) return null
  const map: Record<string, { sym: string; cls: string }> = {
    bullish: { sym: '▲', cls: 'text-green' },
    neutral: { sym: '●', cls: 'text-amber' },
    bearish: { sym: '▼', cls: 'text-red' },
  }
  const s = map[signal] || map.neutral
  return <span className={s.cls}>{s.sym} {signal.toUpperCase()}</span>
}

export function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <span key={i} className="text-white font-medium">{part.slice(2, -2)}</span>
    const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (link)
      return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-green hover:text-green-dim">{link[1]}</a>
    return part
  })
}

export function channelShort(channel: string, sourceType: string) {
  const ch = CHANNEL_META[channel]
  const prefix = sourceType === 'x' ? '[X]' : sourceType === 'article' ? '[WEB]' : sourceType === 'exec' ? '[TTT]' : '[YT]'
  const name = ch?.name || channel
  // NBSP glues prefix to first word so [TTT] never sits alone on a line; remaining spaces wrap normally.
  const label = `${prefix} ${name}`
  // Amber = primary-source, matching the interview teaser label
  if (channel === 'tesla') return <span className="text-amber">{label}</span>
  return label
}

const BIAS_STYLE: Record<Bias, string> = {
  'BULL': 'text-[#009926]',
  'LEAN BULL': 'text-[#2a5a2a]',
  'NEUTRAL': 'text-amber/40',
  'BEAR': 'text-red/50',
}

export function biasTag(channel: string) {
  const ch = CHANNEL_META[channel]
  if (!ch?.bias) return null
  const cls = BIAS_STYLE[ch.bias]
  return <span className={cls}>[{ch.bias}]</span>
}

// Faded yellow for Tesla, SpaceX brand blue. `none` is a demotion marker, not
// an identity badge — it uses the theme's dim grey so it recedes instead of
// competing with the two company colors.
const TOPIC_STYLE = {
  tesla: 'text-[#d0bd5c]',
  spacex: 'text-[#4d9fff]',
  none: 'text-text-dim',
}

const TOPIC_LABEL = {
  tesla: 'TESLA',
  spacex: 'SPACEX',
  none: 'OFFTOPIC',
}

export function topicTag(topic: Article['topic']) {
  if (!topic) return null
  const topics = topic === 'both' ? (['tesla', 'spacex'] as const) : ([topic] as const)
  return topics.map(t => (
    <span key={t} className={TOPIC_STYLE[t]}>[{TOPIC_LABEL[t]}]</span>
  ))
}
