// Contact-form Worker for theteslathesis.com.
//
// Reader submits the popup form -> this Worker validates + rate-limits -> files
// the message as an issue in the PRIVATE kris-ow/ttt-inbox repo. Deliberately
// one-way: no email, no reply address. Readers wanting a conversation are
// pointed at @theteslathesis on X by the popup itself.
//
// Deploy + secrets: see README.md in this directory.

// Minimal local typings so this directory needs no npm install of its own —
// wrangler's esbuild strips types at bundle time.
interface KVNamespace {
  get(key: string): Promise<string | null>
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>
}

interface Env {
  CONTACT_RL: KVNamespace
  GITHUB_TOKEN: string // wrangler secret — fine-grained PAT, Issues:RW on ttt-inbox only
  GITHUB_REPO: string
}

const ALLOWED_ORIGINS = new Set([
  'https://theteslathesis.com',
  'https://www.theteslathesis.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
])

const MAX_MESSAGE = 2000
const MAX_HANDLE = 60
const HOURLY_LIMIT = 3
const DAILY_LIMIT = 10

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED_ORIGINS.has(origin) ? origin : 'https://theteslathesis.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

async function hashIp(ip: string): Promise<string> {
  // Hashed so raw reader IPs are never written to KV. Not reversible, but still
  // stable enough per-day to count against.
  const data = new TextEncoder().encode(`ttt-contact:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24)
}

/** Bump a KV counter with a TTL. Not atomic — races just undercount slightly,
 *  which is fine at this volume and never fails open past the next request. */
async function bump(kv: KVNamespace, key: string, ttl: number): Promise<number> {
  const current = Number((await kv.get(key)) ?? '0')
  const next = current + 1
  await kv.put(key, String(next), { expirationTtl: ttl })
  return next
}

/** Wrap reader text in a fence long enough that its own backticks can't escape it. */
function fence(text: string): string {
  let longest = 0
  for (const run of text.match(/`+/g) ?? []) longest = Math.max(longest, run.length)
  const bar = '`'.repeat(Math.max(3, longest + 1))
  return `${bar}\n${text}\n${bar}`
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }
    if (request.method !== 'POST') {
      return json({ ok: false, error: 'method_not_allowed' }, 405, origin)
    }
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return json({ ok: false, error: 'forbidden' }, 403, origin)
    }

    let payload: Record<string, unknown>
    try {
      payload = (await request.json()) as Record<string, unknown>
    } catch {
      return json({ ok: false, error: 'bad_request' }, 400, origin)
    }

    // Honeypot: a hidden field no human ever fills. Accept and discard, so bots
    // get a success response and no signal to retry differently.
    if (typeof payload.website === 'string' && payload.website.trim() !== '') {
      return json({ ok: true }, 200, origin)
    }

    const message = typeof payload.message === 'string' ? payload.message.trim() : ''
    const handle = typeof payload.handle === 'string' ? payload.handle.trim().slice(0, MAX_HANDLE) : ''
    const page = typeof payload.page === 'string' ? payload.page.slice(0, 200) : ''

    if (message.length === 0 || message.length > MAX_MESSAGE) {
      return json({ ok: false, error: 'invalid_message' }, 400, origin)
    }

    const ip = request.headers.get('CF-Connecting-IP') ?? '0.0.0.0'
    const id = await hashIp(ip)
    const now = new Date()
    const hourKey = `h:${id}:${now.toISOString().slice(0, 13)}`
    const dayKey = `d:${id}:${now.toISOString().slice(0, 10)}`

    const [hourly, daily] = await Promise.all([
      bump(env.CONTACT_RL, hourKey, 3600),
      bump(env.CONTACT_RL, dayKey, 86400),
    ])
    if (hourly > HOURLY_LIMIT || daily > DAILY_LIMIT) {
      return json({ ok: false, error: 'rate_limited' }, 429, origin)
    }

    const title = (message.split('\n')[0] ?? '').replace(/\s+/g, ' ').trim().slice(0, 60) || '(no subject)'
    // @-mentions and markdown inside the fence stay inert — nobody gets pinged.
    const body = [
      fence(message),
      '',
      '---',
      `**Received:** ${now.toISOString()}`,
      handle ? `**From:** ${handle}` : '**From:** (not given)',
      `**Country:** ${(request as { cf?: { country?: string } }).cf?.country ?? 'unknown'}`,
      page ? `**Page:** ${page}` : '',
      '',
      '_Filed automatically by the contact-form Worker. One-way channel — there is no reply address._',
    ]
      .filter(Boolean)
      .join('\n')

    const res = await fetch(`https://api.github.com/repos/${env.GITHUB_REPO}/issues`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'ttt-contact-worker',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ title, body, labels: ['reader-message'] }),
    })

    if (!res.ok) {
      // Never surface GitHub's response to the client — it can leak repo details
      // and token state. `wrangler tail` shows this line when debugging.
      console.error('github_issue_failed', res.status, await res.text())
      return json({ ok: false, error: 'delivery_failed' }, 502, origin)
    }

    return json({ ok: true }, 200, origin)
  },
}
