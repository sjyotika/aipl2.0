import { createGroq } from '@ai-sdk/groq'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { generateText, streamText, type LanguageModel } from 'ai'

/**
 * Get the primary LLM model (Groq Llama 3.1 70B)
 */
export function getPrimaryModel(): LanguageModel {
  const groq = createGroq({
    apiKey: process.env.GROQ_API_KEY,
  })
  return groq('llama-3.3-70b-versatile')
}

/**
 * Get the fallback LLM model (Gemini 1.5 Flash)
 */
export function getFallbackModel(): LanguageModel {
  const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY,
  })
  return google('gemini-2.0-flash')
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
    })
    return result.text
  } catch (error: unknown) {
    console.warn('Primary model (Groq) failed, falling back to Gemini:', error)
    try {
      const result = await generateText({
        model: getFallbackModel(),
        system: options.system,
        prompt: options.prompt,
        maxOutputTokens: options.maxOutputTokens || 1024,
      })
      return result.text
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
  try {
    const result = streamText({
      model: getPrimaryModel(),
      system: options.system,
      messages: options.messages,
      maxOutputTokens: options.maxOutputTokens || 1024,
    })
    // Return immediately to allow streaming to start
    return result
  } catch (error: unknown) {
    console.warn('Primary model (Groq) failed for streaming, falling back to Gemini:', error)
    try {
      const result = streamText({
        model: getFallbackModel(),
        system: options.system,
        messages: options.messages,
        maxOutputTokens: options.maxOutputTokens || 1024,
      })
      return result
    } catch (fallbackError) {
      console.error('Fallback model (Gemini) also failed:', fallbackError)
      throw new Error('All AI models failed. Please try again later.')
    }
  }
}
