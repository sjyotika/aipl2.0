import { prisma } from '@/lib/db'
import { searchSimilarChunks } from '@/lib/rag/vector-store'
import {
  BASE_PERSONA,
  UNDERSTANDING_MODE,
  SOCRATIC_MODE,
  MODE_SELECTION_PROMPT,
  CONTEXT_INJECTION_TEMPLATE,
  INITIAL_GREETING,
} from './prompts'
import { generateWithFallback } from './provider'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

/**
 * Build the full conversation history for a session
 */
export async function getSessionHistory(sessionId: string): Promise<ConversationMessage[]> {
  const messages = await prisma.message.findMany({
    where: { sessionId },
    orderBy: { turnNumber: 'asc' },
  })

  return messages.map((m) => ({
    role: m.role === 'user' ? 'user' as const : 'assistant' as const,
    content: m.content,
  }))
}

/**
 * Get the current turn number for a session
 */
export async function getCurrentTurnNumber(sessionId: string): Promise<number> {
  const count = await prisma.message.count({
    where: { sessionId },
  })
  return count + 1
}

/**
 * Determine the AI response mode based on the user's latest message
 */
export async function determineMode(
  userMessage: string,
  history: ConversationMessage[],
  topic: string
): Promise<'understanding' | 'socratic'> {
  const historyContext = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')

  const prompt = `${MODE_SELECTION_PROMPT}

Topic: ${topic}

Recent conversation:
${historyContext}

Latest user explanation:
${userMessage}`

  try {
    const result = await generateWithFallback({
      system: 'You are a mode classifier. Respond with exactly one word: "understanding" or "socratic".',
      prompt,
      maxOutputTokens: 10,
    })

    const mode = result.trim().toLowerCase()
    if (mode.includes('understanding')) return 'understanding'
    return 'socratic'
  } catch {
    return 'socratic' // Default to Socratic mode on failure
  }
}

/**
 * Build the system prompt for the AI response
 */
export async function buildSystemPrompt(
  mode: 'understanding' | 'socratic',
  topic: string,
  sessionId: string,
  userMessage: string
): Promise<string> {
  let systemPrompt = BASE_PERSONA + '\n\n'

  // Add mode-specific instructions
  systemPrompt += mode === 'understanding' ? UNDERSTANDING_MODE : SOCRATIC_MODE
  systemPrompt += '\n\n'

  // Add RAG context if available
  try {
    const relevantChunks = await searchSimilarChunks(userMessage, sessionId, 3)
    if (relevantChunks.length > 0) {
      const context = relevantChunks.map((c) => c.content).join('\n\n')
      systemPrompt += CONTEXT_INJECTION_TEMPLATE
        .replace('{topic}', topic)
        .replace('{context}', context)
    }
  } catch {
    // Continue without RAG context
  }

  return systemPrompt
}

/**
 * Generate the initial greeting for a new session
 */
export function getInitialGreeting(topic: string): string {
  return INITIAL_GREETING.replace(/{topic}/g, topic)
}

/**
 * Save a message to the database
 */
export async function saveMessage(
  sessionId: string,
  role: 'user' | 'ai',
  content: string,
  mode: 'understanding' | 'socratic' | null,
  turnNumber: number
) {
  await prisma.message.create({
    data: {
      sessionId,
      role,
      content,
      mode,
      turnNumber,
    },
  })
}
