import { CHANNEL_META, type Bias } from '../../types'

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
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <span key={i} className="text-white font-medium">{part.slice(2, -2)}</span>
    return part
  })
}

export function channelShort(channel: string, sourceType: string) {
  const ch = CHANNEL_META[channel]
  const prefix = sourceType === 'x' ? '[X]' : sourceType === 'article' ? '[WEB]' : '[YT]'
  return `${prefix} ${ch?.name || channel}`
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
