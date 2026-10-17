import { createGroq } from '@ai-sdk/groq'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, streamText, type LanguageModel } from 'ai'

export function removeReasoning(text: string): string {
  const thinkStart = text.search(/<think>/i)
  if (thinkStart >= 0) {
    const thinkEnd = text.search(/<\/think>/i)
    text = thinkEnd >= 0 ? text.slice(0, thinkStart) + text.slice(thinkEnd + 7) : text.slice(0, thinkStart)
  }

  return text
    .replace(/^\s*Thinking Process:\s*[\s\S]*?(?=\n\s*(?:Oh|Okay|Wait|Hmm|That's|That|So|It seems|I think)\b)/i, '')
    .trim()
}

/** Get the primary chat model. Groq avoids consuming Gemini's smaller free-tier quota. */
export function getPrimaryModel(): LanguageModel {
  const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
  })
  return groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b')
}

/** Get the Gemini fallback model. */
export function getFallbackModel(): LanguageModel {
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  })
  return google(process.env.GEMINI_MODEL || 'gemini-3.8-flash')
}

/**
 * Generate text with automatic fallback from Groq to Gemini
 */
export async function generateWithFallback(options: {
  system: string
  prompt: string
  maxOutputTokens?: number
}): Promise<string> {
  try {
    const result = await generateText({
      model: getPrimaryModel(),
      system: options.system,
      prompt: options.prompt,
      maxOutputTokens: options.maxOutputTokens || 1024,
      providerOptions: { groq: { reasoningEffort: 'none', reasoningFormat: 'hidden' } },
    })
    return removeReasoning(result.text)
  } catch (error: unknown) {
    console.warn('Primary model (Groq) failed, falling back to Gemini:', error)
    try {
      const result = await generateText({
        model: getFallbackModel(),
        system: options.system,
        prompt: options.prompt,
        maxOutputTokens: options.maxOutputTokens || 1024,
      })
      return removeReasoning(result.text)
    } catch (fallbackError) {
      console.error('Fallback model (Gemini) also failed:', fallbackError)
      throw new Error('All AI models failed. Please try again later.')
    }
  }
}

/**
 * Stream text with automatic fallback.
 * Wraps the primary model's stream; if consumption fails, retries with fallback.
 */
export async function streamWithFallback(options: {
  system: string
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  maxOutputTokens?: number
}): Promise<{ textStream: AsyncIterable<string> }> {
  async function* generateStream() {
    let emitted = false
    try {
      const primary = streamText({
        model: getPrimaryModel(),
        system: options.system,
        messages: options.messages,
        maxOutputTokens: options.maxOutputTokens || 1024,
        providerOptions: { groq: { reasoningEffort: 'none', reasoningFormat: 'hidden' } },
      })
      for await (const chunk of primary.textStream) {
        emitted = true
        yield chunk
      }
      return
    } catch (error: unknown) {
      console.warn('Primary model failed for streaming, falling back:', error)
      if (emitted) throw error
    }

    try {
      const fallback = streamText({
        model: getFallbackModel(),
        system: options.system,
        messages: options.messages,
        maxOutputTokens: options.maxOutputTokens || 1024,
      })
      for await (const chunk of fallback.textStream) yield chunk
    } catch (fallbackError) {
      console.error('Fallback model also failed:', fallbackError)
      throw new Error('All AI models failed. Please try again later.')
    }
  }

  return { textStream: generateStream() }
}
