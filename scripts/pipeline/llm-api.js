// One Messages API call for the pipeline's direct (non-batch) scripts, with the
// refusal fallback Sonnet 5.5 needs.
//
// Sonnet 5.5 can decline a request (HTTP 200, stop_reason "refusal") in more
// categories than Sonnet 5 did, and the batch API rejects server-side
// `fallbacks`, so the fallback is done here: a refused request is re-sent once
// to FALLBACK_MODEL. The retry must not carry THINKING (`between_tools` is a 400
// on any model other than Sonnet 5.5), hence FALLBACK_THINKING.
//
// Callers read the text with textOf(), never content.map(c => c.text): any
// non-text block (thinking, fallback) would otherwise join in as "undefined".

import { MODEL, THINKING, FALLBACK_MODEL, FALLBACK_THINKING } from './config.js';

export function textOf(msg) {
  return msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

export async function createMessage(client, prompt, { max_tokens = 16000 } = {}) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens,
    thinking: THINKING,
    messages: [{ role: 'user', content: prompt }],
  });
  if (msg.stop_reason !== 'refusal') return msg;

  const category = msg.stop_details?.category ?? 'unknown';
  console.log(`  ${MODEL} declined (refusal, category ${category}) - retrying on ${FALLBACK_MODEL}`);
  console.error(`::warning::${MODEL} refused a request (category ${category}); served by ${FALLBACK_MODEL} instead`);
  const retry = await client.messages.create({
    model: FALLBACK_MODEL,
    max_tokens,
    thinking: FALLBACK_THINKING,
    messages: [{ role: 'user', content: prompt }],
  });
  if (retry.stop_reason === 'refusal') {
    throw new Error(`both ${MODEL} and ${FALLBACK_MODEL} refused the request`);
  }
  // Count the declined attempt too. Whether it was billed depends on the refusal
  // category, so this can over-report slightly - never under-report.
  retry.usage = {
    ...retry.usage,
    input_tokens: retry.usage.input_tokens + (msg.usage?.input_tokens || 0),
    output_tokens: retry.usage.output_tokens + (msg.usage?.output_tokens || 0),
  };
  return retry;
}
