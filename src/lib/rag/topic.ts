// src/lib/rag/topic.ts
import { generateWithFallback } from '@/lib/ai/provider';

/**
 * Detect a concise topic phrase for a given document text.
 * Returns a short topic string (max ~5 words).
 */
export async function detectTopic(text: string): Promise<{ topic: string }> {
  const system = 'You are a concise topic identifier. Return ONLY a short topic phrase (max 5 words) that best describes the main subject of the provided text. Do NOT include explanations or punctuation.';
  const result = await generateWithFallback({
    system,
    prompt: text,
    maxOutputTokens: 64,
  });
  return { topic: result.trim() };
}
