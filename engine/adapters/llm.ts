// One OpenAI-compatible chat adapter. Default: Groq free tier. Also works with Sunbird Sunflower
// or any provider exposing /chat/completions.
import { z } from 'zod'
import { LlmRateLimitError, type ChatLLM, type ChatRequest } from '../ports'
import { fetchWithTimeout } from './http'

interface LlmEnv {
  LLM_CHAT_URL?: string
  LLM_API_KEY?: string
  LLM_MODEL?: string
  LLM_FALLBACK_MODEL?: string
}

export const DEFAULT_LLM_URL = 'https://api.groq.com/openai/v1/chat/completions'
// From Groq's model list on 29 Oct 2026 (Llama 3.3 70B is no longer offered). Override with LLM_MODEL.
export const DEFAULT_LLM_MODEL = 'openai/gpt-oss-120b'
export const DEFAULT_FALLBACK_MODEL = 'openai/gpt-oss-20b'

const ChatResponse = z.object({
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }) })).min(1),
})

export function openAiCompatibleLlm(env: LlmEnv): ChatLLM {
  const url = env.LLM_CHAT_URL || DEFAULT_LLM_URL
  const model = env.LLM_MODEL || DEFAULT_LLM_MODEL
  // Groq rate-limits each model separately, so a smaller sibling can take over when the main one is busy.
  const fallbackModel = env.LLM_FALLBACK_MODEL ?? (model === DEFAULT_LLM_MODEL ? DEFAULT_FALLBACK_MODEL : '')

  async function call(useModel: string, { system, user, json, maxTokens = 600 }: ChatRequest): Promise<string> {
    const body: Record<string, unknown> = {
      model: useModel,
      temperature: 0,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }
    if (json) body.response_format = { type: 'json_object' }
    // gpt-oss models reason before answering; low effort keeps latency and token use down.
    if (useModel.startsWith('openai/gpt-oss')) body.reasoning_effort = 'low'
    const res = await fetchWithTimeout(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: 20000,
    })
    if (res.status === 429) throw new LlmRateLimitError()
    if (!res.ok) throw new Error(`LLM HTTP ${res.status} (${useModel}): ${(await res.text()).slice(0, 200)}`)
    const parsed = ChatResponse.parse(await res.json())
    return parsed.choices[0].message.content ?? ''
  }

  return {
    live: true,
    async complete(req) {
      try {
        return await call(model, req)
      } catch (err) {
        if (!(err instanceof LlmRateLimitError) || !fallbackModel) throw err
        return call(fallbackModel, req)
      }
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
