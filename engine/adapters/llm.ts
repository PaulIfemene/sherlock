// One OpenAI-compatible chat adapter. Default: Groq free tier. Also works with Sunbird Sunflower
// or any provider exposing /chat/completions.
import { z } from 'zod'
import { LlmRateLimitError, type ChatLLM } from '../ports'
import { fetchWithTimeout } from './http'

interface LlmEnv {
  LLM_CHAT_URL?: string
  LLM_API_KEY?: string
  LLM_MODEL?: string
}

export const DEFAULT_LLM_URL = 'https://api.groq.com/openai/v1/chat/completions'
// Check Groq's model list before the demo; override with LLM_MODEL.
export const DEFAULT_LLM_MODEL = 'llama-3.3-70b-versatile'

const ChatResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
})

export function openAiCompatibleLlm(env: LlmEnv): ChatLLM {
  const url = env.LLM_CHAT_URL || DEFAULT_LLM_URL
  const model = env.LLM_MODEL || DEFAULT_LLM_MODEL
  return {
    live: true,
    async complete({ system, user, json, maxTokens = 600 }) {
      const body: Record<string, unknown> = {
        model,
        temperature: 0,
        max_tokens: maxTokens,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }
      if (json) body.response_format = { type: 'json_object' }
      const res = await fetchWithTimeout(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        timeoutMs: 20000,
      })
      if (res.status === 429) throw new LlmRateLimitError()
      if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`)
      const parsed = ChatResponse.parse(await res.json())
      return parsed.choices[0].message.content ?? ''
    },
  }
}

/** Fallback when no LLM key is configured. The engine checks `live` and uses rule-based stand-ins. */
export const cannedLlm: ChatLLM = {
  live: false,
  async complete() {
    throw new Error('LLM unavailable (demo mode, no LLM_API_KEY)')
  },
}
