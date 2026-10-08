import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { removeReasoning, streamWithFallback } from '@/lib/ai/provider'
import {
  getSessionHistory,
  getCurrentTurnNumber,
  determineMode,
  buildSystemPrompt,
  saveMessage,
  getInitialGreeting, LANGUAGE_NAMES,
} from '@/lib/ai/session-manager'
import { SESSION_END_PROMPT, BASE_PERSONA } from '@/lib/ai/prompts'
import { describeImage } from '@/lib/services/visionService'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { message, sessionId, action, language, imageUrl } = await request.json();

    // Verify session belongs to user
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: user.id },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    if (language && !['en', 'hi', 'mr', 'te', 'ta'].includes(language)) {
      return Response.json({ error: 'Unsupported language' }, { status: 400 })
    }
    if (imageUrl && (typeof imageUrl !== 'string' || !imageUrl.startsWith(`${user.id}/`))) {
      return Response.json({ error: 'Invalid image reference' }, { status: 400 })
    }
    if (language || imageUrl) {
      await prisma.session.update({ where: { id: sessionId }, data: { ...(language && { language }), ...(imageUrl && { imageUrl }) } })
    }

    // Handle initial greeting
    if (action === 'start') {
      const greeting = getInitialGreeting(session.topic, language || session.language || 'en')
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
        system: BASE_PERSONA + `\n\nRespond only in ${LANGUAGE_NAMES[language || session.language || 'en'] || 'English'} and preserve technical terms when useful.\n\n` + SESSION_END_PROMPT,
        messages: [...history, { role: 'user', content: 'I want to end our session now.' }],
        maxOutputTokens: 256,
      })

      let farewell = ''
      const stream = result.textStream
      for await (const chunk of stream) {
        farewell += chunk
      }
      farewell = removeReasoning(farewell)

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
          headers: {
            'Content-Type': 'application/json',
            cookie: request.headers.get('cookie') || '',
          },
          body: JSON.stringify({ sessionId, language: language || session.language, imageUrl: imageUrl || session.imageUrl })
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

    // Start determineMode in parallel
    const modePromise = determineMode(message, history, session.topic, language || session.language || 'en')

    // Build system prompt with RAG context
    let imageDescription = ''
    if (imageUrl) {
      try { imageDescription = await describeImage(imageUrl, 'Analyze this attached educational diagram as evidence for the student explanation.') } catch { imageDescription = '' }
    }
    const systemPrompt = await buildSystemPrompt('understanding', session.topic, sessionId, message, { language: language || session.language || 'en', imageDescription })

    // Stream AI response
    const result = await streamWithFallback({
      system: systemPrompt,
      messages: history,
      maxOutputTokens: 1024,
    })

    // Return a custom stream that yields JSON lines
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = ''
        try {
          for await (const chunk of result.textStream) fullResponse += chunk
          fullResponse = removeReasoning(fullResponse)
          if (!fullResponse) {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: 'The AI returned no visible response. Please try again.' }) + '\n'))
            controller.close()
            return
          }
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ chunk: fullResponse }) + '\n'))
        } catch (error) {
          console.error('Chat stream failed:', error)
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ error: 'AI is temporarily unavailable. Please try again shortly.' }) + '\n'))
          controller.close()
          return
        }

        // Wait for mode detection to finish (it usually finishes before the stream)
        let mode: 'understanding' | 'socratic' | null = null
        try {
          mode = await modePromise
          controller.enqueue(new TextEncoder().encode(JSON.stringify({ mode }) + '\n'))
        } catch (e) {
          console.error('Mode detection failed', e)
        }

        // Save AI response
        const aiTurnNumber = await getCurrentTurnNumber(sessionId)
        await saveMessage(sessionId, 'ai', fullResponse, mode, aiTurnNumber)

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Chat error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
