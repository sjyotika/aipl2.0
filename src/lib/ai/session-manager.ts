import { prisma } from '@/lib/db'
import { searchSimilarChunks } from '@/lib/rag/vector-store'
import {
  BASE_PERSONA,
  UNDERSTANDING_MODE,
  SOCRATIC_MODE,
  MODE_SELECTION_PROMPT,
  CONTEXT_INJECTION_TEMPLATE,
  INITIAL_GREETING,
  INTERVIEW_MODE_PROMPTS,
} from './prompts'
import { generateWithFallback, removeReasoning } from './provider'
import type { InterviewMode } from '@/lib/interview/modes'

export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
}

export const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English', hi: 'Hindi', mr: 'Marathi', te: 'Telugu', ta: 'Tamil',
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
    content: m.role === 'user' ? m.content : removeReasoning(m.content),
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
  topic: string,
  language = 'en',
): Promise<'understanding' | 'socratic'> {
  const historyContext = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n')

  const prompt = `${MODE_SELECTION_PROMPT}

Topic: ${topic}

Recent conversation:
${historyContext}

The required response language is ${LANGUAGE_NAMES[language] || 'English'}. Classify silently; do not produce a user-facing response.

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
  userMessage: string,
  options?: { language?: string; imageDescription?: string; interviewMode?: InterviewMode; companyName?: string }
): Promise<string> {
  let systemPrompt = BASE_PERSONA + '\n\n'

  const languageNames: Record<string, string> = { en: 'English', hi: 'Hindi', mr: 'Marathi', te: 'Telugu', ta: 'Tamil' }
  const language = options?.language || 'en'
  systemPrompt += `Respond consistently and only in ${languageNames[language] || 'English'}. Preserve technical terms in English when useful. Do not switch languages unless asked. This language rule applies to every response.\n\n`
  // Interview instructions take precedence over the teaching-session modes.
  systemPrompt += options?.interviewMode
    && options.interviewMode !== 'normal'
    ? INTERVIEW_MODE_PROMPTS[options.interviewMode]
    : mode === 'understanding'
      ? UNDERSTANDING_MODE
      : SOCRATIC_MODE
  systemPrompt += '\n\n'

  if (options?.companyName && options.interviewMode && options.interviewMode !== 'normal') {
    systemPrompt += `Company context: ${options.companyName}. Tailor scenarios to this company, but do not claim confidential or unverifiable company-specific facts.\n\n`
  }

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

  if (options?.imageDescription) {
    systemPrompt += `Use this attached-image evidence when responding:\n---IMAGE EVIDENCE---\n${options.imageDescription}\n---END IMAGE EVIDENCE---\n\n`
  }

  return systemPrompt
}

/**
 * Generate the initial greeting for a new session
 */
export function getInitialGreeting(topic: string, language = 'en', interviewMode: InterviewMode = 'technical'): string {
  const modeGreeting = {
    normal: INITIAL_GREETING.replace(/{topic}/g, topic),
    technical: `Welcome to your technical interview on ${topic}. Start by explaining the core idea and how you would apply it.`,
    managerial: `Welcome to your managerial interview. We will discuss ${topic} through leadership and decision-making scenarios. Tell me about a relevant situation you handled.`,
    hr: `Welcome to your HR interview. We will explore your experience and approach to ${topic}. Tell me about a situation that shows how you work with others.`,
  }[interviewMode]
  const greetings: Record<string, string> = {
    hi: `अरे! मैं ${topic} को समझने की कोशिश कर रहा हूँ। क्या तुम मुझे इसे अपने शब्दों में समझा सकते हो?`,
    mr: `अरे! मला ${topic} समजून घेण्याचा प्रयत्न करायचा आहे. तू मला ते तुझ्या शब्दांत समजावून सांगशील का?`,
    te: `హాయ్! నేను ${topic} అర్థం చేసుకోవడానికి ప్రయత్నిస్తున్నాను. దీన్ని నీ మాటల్లో నాకు వివరిస్తావా?`,
    ta: `வணக்கம்! நான் ${topic} பற்றி புரிந்துகொள்ள முயற்சிக்கிறேன். இதை உன் சொந்த வார்த்தைகளில் விளக்குவாயா?`,
  }
  return language === 'en' && interviewMode !== 'normal'
    ? modeGreeting
    : (greetings[language] || INITIAL_GREETING).replace(/{topic}/g, topic)
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
