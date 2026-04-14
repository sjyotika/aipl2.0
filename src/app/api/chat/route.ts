import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { streamWithFallback } from '@/lib/ai/provider'
import {
  getSessionHistory,
  getCurrentTurnNumber,
  determineMode,
  buildSystemPrompt,
  saveMessage,
  getInitialGreeting,
} from '@/lib/ai/session-manager'
import { SESSION_END_PROMPT, BASE_PERSONA } from '@/lib/ai/prompts'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, sessionId, action } = await request.json()

    // Verify session belongs to user
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: user.id },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    // Handle initial greeting
    if (action === 'start') {
      const greeting = getInitialGreeting(session.topic)
      const turnNumber = await getCurrentTurnNumber(sessionId)
      await saveMessage(sessionId, 'ai', greeting, null, turnNumber)
      return Response.json({ message: greeting, mode: null })
    }

    // Handle session end
    if (action === 'end' || action === 'give-up') {
      // Update session status
      await prisma.session.update({
        where: { id: sessionId },
        data: { status: action === 'give-up' ? 'abandoned' : 'completed' },
      })

      // Generate farewell
      const history = await getSessionHistory(sessionId)
      const result = await streamWithFallback({
        system: BASE_PERSONA + '\n\n' + SESSION_END_PROMPT,
        messages: [...history, { role: 'user', content: 'I want to end our session now.' }],
        maxOutputTokens: 256,
      })

      let farewell = ''
      const stream = result.textStream
      for await (const chunk of stream) {
        farewell += chunk
      }

      const turnNumber = await getCurrentTurnNumber(sessionId)
      await saveMessage(sessionId, 'ai', farewell, null, turnNumber)

      // Trigger evaluation asynchronously
      try {
        const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
          ? process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : 'http://localhost:3000'
          : 'http://localhost:3000'

        fetch(`${baseUrl}/api/evaluate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        }).catch(console.error)
      } catch {}

      return Response.json({ message: farewell, mode: null, sessionEnded: true })
    }

    // Regular chat message
    if (!message || typeof message !== 'string') {
      return Response.json({ error: 'Message is required' }, { status: 400 })
    }

    // Save user message
    const userTurnNumber = await getCurrentTurnNumber(sessionId)
    await saveMessage(sessionId, 'user', message, null, userTurnNumber)

    // Get conversation history
    const history = await getSessionHistory(sessionId)

    // Determine mode
    const mode = await determineMode(message, history, session.topic)

    // Build system prompt with RAG context
    const systemPrompt = await buildSystemPrompt(mode, session.topic, sessionId, message)

    // Stream AI response
    const result = await streamWithFallback({
      system: systemPrompt,
      messages: history,
      maxOutputTokens: 512,
    })

    // Collect the full response for saving
    let fullResponse = ''
    const stream = result.textStream
    for await (const chunk of stream) {
      fullResponse += chunk
    }

    // Save AI response
    const aiTurnNumber = await getCurrentTurnNumber(sessionId)
    await saveMessage(sessionId, 'ai', fullResponse, mode, aiTurnNumber)

    return Response.json({ message: fullResponse, mode })
  } catch (error) {
    console.error('Chat error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
