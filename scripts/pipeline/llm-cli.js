// Claude Code CLI transport: runs a single prompt through `claude -p` on the
// local machine's Claude subscription instead of the metered Anthropic API.
// Used by run.js when LLM_BACKEND=cli (the Mac Mini). The API path is untouched.
//
// Isolation matters more than anything else here. A plain `claude -p` loads the
// user's CLAUDE.md files, memory, hooks, MCP servers and tools, and any of that
// would leak into a summary. So every call:
//   - runs with --safe-mode (no CLAUDE.md, skills, plugins, hooks, MCP, memory)
//     and --tools "" (no tools at all), from a fresh empty temp directory;
//   - replaces Claude Code's default system prompt with a neutral one;
//   - strips ANTHROPIC_API_KEY from the child env. If it were set, the CLI would
//     bill the API key instead of the subscription, which defeats the point;
//   - sets MAX_THINKING_TOKENS=0, matching THINKING (disabled) on the API path,
//     so the two backends produce comparable output.
// --bare would be simpler, but it refuses subscription (OAuth) auth.

import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const SYSTEM_PROMPT = 'Follow the instructions in the user message exactly. Respond with the requested output only.';
const TIMEOUT_MS = 10 * 60 * 1000;

export class CliError extends Error {
  constructor(message, { limit = false } = {}) {
    super(message);
    this.limit = limit; // subscription usage limit hit: stop calling, leave the rest to the API path
  }
}

export async function completeViaCli(prompt, { model }) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ttt-cli-'));
  const env = { ...process.env, MAX_THINKING_TOKENS: '0' };
  delete env.ANTHROPIC_API_KEY;

  const args = [
    '-p',
    '--safe-mode',
    '--tools', '',
    '--no-session-persistence',
    '--system-prompt', SYSTEM_PROMPT,
    '--model', model,
    '--output-format', 'json',
  ];

  try {
    const stdout = await new Promise((resolve, reject) => {
      const child = spawn(process.env.CLAUDE_BIN || 'claude', args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      const timer = setTimeout(() => { child.kill(); reject(new CliError(`claude -p timed out after ${TIMEOUT_MS / 60000}m`)); }, TIMEOUT_MS);
      child.stdout.on('data', d => { out += d; });
      child.stderr.on('data', d => { err += d; });
      child.on('error', e => { clearTimeout(timer); reject(new CliError(`could not start claude: ${e.message}`)); });
      child.on('close', code => {
        clearTimeout(timer);
        if (code !== 0 && !out.trim()) reject(new CliError(`claude exited ${code}: ${err.trim().slice(0, 500)}`));
        else resolve(out);
      });
      child.stdin.end(prompt);
    });

    let res;
    try {
      res = JSON.parse(stdout);
    } catch {
      throw new CliError(`unparseable claude output: ${stdout.slice(0, 300)}`);
    }

    if (res.is_error || res.subtype !== 'success') {
      const msg = String(res.result || res.api_error_status || res.subtype || 'unknown error');
      const limit = /limit|quota|usage/i.test(msg) || res.api_error_status === 429;
      throw new CliError(`claude returned an error: ${msg.slice(0, 300)}`, { limit });
    }

    const u = res.usage || {};
    const servedBy = Object.keys(res.modelUsage || {});
    if (servedBy.length && !servedBy.includes(model)) {
      throw new CliError(`requested ${model} but the CLI served ${servedBy.join(', ')}`);
    }
    return {
      text: res.result || '',
      inputTokens: (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0),
      outputTokens: u.output_tokens || 0,
      thinkingTokens: u.output_tokens_details?.thinking_tokens || 0,
      listCostUsd: res.total_cost_usd || 0, // what the API would have charged, NOT billed
    };
  } finally {
    fs.rmSync(cwd, { recursive: true, force: true });
  }
}
