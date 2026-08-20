# Contact-form Worker

Receives the site's contact popup and files each message as an issue in the
**private** `kris-ow/ttt-inbox` repo. One-way by design: no email, no reply
address. The popup points readers at `@theteslathesis` on X for conversation.

Deployed at `https://ttt-contact.<subdomain>.workers.dev`. Not part of
`npm run build` — the Pages build never touches this directory, and
`tsconfig.app.json` only includes `src/`, so `tsc -b` ignores it too.

## Credentials

Deploys authenticate with `CLOUDFLARE_API_TOKEN` from the **project root `.env`**
(gitignored) — wrangler v4 loads `.env` automatically when run from the repo
root. There is no `wrangler login` OAuth session on this machine; if `.env` is
missing or the token is rotated, every wrangler command here fails with an auth
error.

## Deploy

```powershell
npx wrangler deploy --config worker/contact/wrangler.toml
```

## Secret

One secret, set once (interactive prompt — never pass the value on a command
line, it would land in shell history):

```powershell
npx wrangler secret put GITHUB_TOKEN --config worker/contact/wrangler.toml
```

`GITHUB_TOKEN` is a GitHub **fine-grained PAT**, scoped to `ttt-inbox` only,
with `Issues: Read and write` and nothing else.

⚠️ **The PAT expires** (1 year max, GitHub's cap). On expiry the Worker starts
returning `delivery_failed` and the popup shows an error to readers — there is
no alert. The expiry date is in the owner's calendar; re-mint and re-run the
`secret put` above.

## Abuse controls

- **Origin allowlist** — the site's two hostnames plus localhost for dev.
- **Honeypot** — hidden `website` field; if filled, the request gets a `200` and
  is discarded, so bots see success and no reason to retry.
- **Rate limit** — 3/hour and 10/day per hashed IP, in KV with TTL expiry. Raw
  IPs are never stored. Counter bumps are non-atomic; concurrent requests can
  undercount slightly, which is irrelevant at this volume.

Turnstile was deliberately **not** added for v1 — the audience is small and the
destination is a private repo, so the blast radius of spam is a few junk issues.
If abuse shows up, add a Turnstile widget, put the secret in
`wrangler secret put TURNSTILE_SECRET`, and verify the token after the honeypot
check; the site key goes in the frontend. That's an insert, not a rewrite.

## Debugging

```powershell
npx wrangler tail --config worker/contact/wrangler.toml
```

GitHub failures are logged as `github_issue_failed <status> <body>` and are never
returned to the client.
