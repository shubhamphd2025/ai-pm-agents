/**
 * Shared LLM client
 * Uses OpenRouter (OpenAI-compatible API) with DeepSeek V4 Flash by default
 * Falls back through a chain of models on rate limit or provider errors
 */

const OpenAI = require('openai');
require('dotenv').config();

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    'HTTP-Referer': 'https://github.com/kiro-pm-discovery',
    'X-Title': 'Assistant PM - Discovery',
  },
});

// Default model — best quality-to-cost balance on OpenRouter
// ~$0.006 per full analysis run = 1,500+ runs per $10
// 1M context window handles large review batches comfortably
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || 'deepseek/deepseek-v4-flash';

// Fallback models tried in order if the primary fails
const FALLBACK_MODELS = [
  'mistralai/mistral-nemo',
  'qwen/qwen3-14b',
  'mistralai/mistral-small-24b-instruct-2501',
];

/**
 * Simple chat completion wrapper with retry + model fallback
 * @param {string} prompt
 * @param {number} maxTokens
 * @returns {string} response text
 */
async function chat(prompt, maxTokens = 1500, retries = 3) {
  const modelsToTry = [DEFAULT_MODEL, ...FALLBACK_MODELS];

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const response = await client.chat.completions.create({
          model,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: prompt }],
        });

        if (!response.choices || response.choices.length === 0) {
          throw new Error('Empty choices in LLM response');
        }

        // Log if we fell back to a different model
        if (model !== DEFAULT_MODEL) {
          console.log(`  ℹ️  Used fallback model: ${model}`);
        }

        const content = response.choices[0].message.content;
        if (content == null) {
          throw new Error('Empty choices in LLM response');
        }
        return content.trim();
      } catch (err) {
        const isRetryable =
          err.status === 429 ||
          err.status === 502 ||
          err.status === 503 ||
          err.message?.includes('rate') ||
          err.message?.includes('Empty choices');

        if (isRetryable && attempt < retries) {
          const wait = attempt * 8000; // 8s, 16s backoff
          console.warn(`  ⏳ Model ${model} unavailable, retrying in ${wait / 1000}s... (attempt ${attempt}/${retries})`);
          await new Promise((r) => setTimeout(r, wait));
          continue;
        }

        // Move to next fallback model
        if (isRetryable) {
          console.warn(`  ⚠️  Model ${model} exhausted retries, trying next fallback...`);
          break;
        }

        throw err;
      }
    }
  }

  throw new Error('All LLM models failed. Please try again later or check your OpenRouter quota.');
}

/**
 * Strip markdown code fences and trailing text from LLM JSON responses.
 * Some models append explanatory text after the closing brace/bracket.
 * Also handles truncated responses by finding the outermost complete JSON structure.
 */
function extractJSON(raw) {
  let cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim();

  // Find the start of the JSON (first { or [)
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let start = -1;
  let isArray = false;

  if (firstBrace === -1 && firstBracket === -1) return cleaned;

  if (firstBrace === -1) { start = firstBracket; isArray = true; }
  else if (firstBracket === -1) { start = firstBrace; isArray = false; }
  else if (firstBracket < firstBrace) { start = firstBracket; isArray = true; }
  else { start = firstBrace; isArray = false; }

  const openChar = isArray ? '[' : '{';
  const closeChar = isArray ? ']' : '}';

  // Walk forward tracking depth to find the matching close
  let depth = 0;
  let inString = false;
  let escape = false;
  let end = -1;

  for (let i = start; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (escape) { escape = false; continue; }
    if (ch === '\\' && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === openChar) depth++;
    else if (ch === closeChar) {
      depth--;
      if (depth === 0) { end = i; break; }
    }
  }

  if (end !== -1) {
    return cleaned.substring(start, end + 1);
  }

  // Truncated response — trim to last complete top-level value
  const lastBrace = Math.max(cleaned.lastIndexOf('}'), cleaned.lastIndexOf(']'));
  if (lastBrace !== -1) {
    return cleaned.substring(start, lastBrace + 1);
  }

  return cleaned;
}

module.exports = { chat, extractJSON };
