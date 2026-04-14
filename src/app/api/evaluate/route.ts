import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { evaluateSession } from '@/lib/evaluation/engine'

export async function POST(request: NextRequest) {
  try {
    const { sessionId } = await request.json()

    if (!sessionId) {
      return Response.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // Verify session exists and is completed
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status === 'active') {
      return Response.json({ error: 'Session is still active' }, { status: 400 })
    }

    // Skip if already evaluated
    if (session.evaluationReport) {
      return Response.json({ report: session.evaluationReport })
    }

    // Run evaluation
    const report = await evaluateSession(sessionId)

    // Store report in session
    await prisma.session.update({
      where: { id: sessionId },
      data: { evaluationReport: JSON.parse(JSON.stringify(report)) },
    })

    return Response.json({ report })
  } catch (error) {
    console.error('Evaluation error:', error)
    return Response.json({ error: 'Evaluation failed' }, { status: 500 })
  }
}
