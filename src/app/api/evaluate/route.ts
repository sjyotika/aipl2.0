import { NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { evaluateSession } from '@/lib/evaluation/engine'
import { createClient } from '@/lib/supabase/server'
import { Prisma } from '@prisma/client'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const { sessionId, language, imageUrl } = await request.json();
    if (imageUrl && (typeof imageUrl !== 'string' || !imageUrl.startsWith(`${user.id}/`))) {
      return Response.json({ error: 'Invalid image reference' }, { status: 400 })
    }

  // Persist language and imageUrl if provided
  if (language || imageUrl) {
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        ...(language && { language }),
        ...(imageUrl && { imageUrl }),
      },
    });
  }



    if (!sessionId) {
      return Response.json({ error: 'sessionId is required' }, { status: 400 })
    }

    // Verify session exists and is completed
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: user.id },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    if (session.status === 'active') {
      return Response.json({ status: 'waiting' }, { status: 202 })
    }

    // Skip if already evaluated or currently evaluating
    if (session.evaluationReport) {
      const reportObj = session.evaluationReport as { status?: string }
      if (reportObj.status === 'evaluating') {
        return Response.json({ status: 'evaluating' }, { status: 202 })
      }
      return Response.json({ report: session.evaluationReport })
    }

    // Set lock to prevent concurrent evaluation runs from polling
    await prisma.session.update({
      where: { id: sessionId },
      data: { evaluationReport: { status: 'evaluating' } },
    })

    // Run evaluation with language and image options
    const report = await evaluateSession(sessionId, { language, imageUrl });

    // Store report in session
    await prisma.session.update({
      where: { id: sessionId },
      data: { evaluationReport: JSON.parse(JSON.stringify(report)) },
    })

    return Response.json({ report })
  } catch (error) {
    console.error('Evaluation error:', error)
    const body = await request.clone().json().catch(() => null) as { sessionId?: string } | null
    if (body?.sessionId) {
      await prisma.session.updateMany({
        where: { id: body.sessionId },
        data: { evaluationReport: Prisma.JsonNull },
      }).catch(() => undefined)
    }
    return Response.json({ error: 'Evaluation failed' }, { status: 500 })
  }
}
