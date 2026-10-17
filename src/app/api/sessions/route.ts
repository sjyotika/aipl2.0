import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { isInterviewMode, type InterviewMode } from '@/lib/interview/modes'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topic, language = 'en', interviewMode = 'normal', companyName } = await request.json()

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return Response.json({ error: 'Topic is required' }, { status: 400 })
    }

    if (!['en', 'hi', 'mr', 'te', 'ta'].includes(language)) {
      return Response.json({ error: 'Unsupported language' }, { status: 400 })
    }
    if (!isInterviewMode(interviewMode)) {
      return Response.json({ error: 'Unsupported interview mode' }, { status: 400 })
    }
    if ((interviewMode === 'managerial' || interviewMode === 'hr') &&
      (!companyName || typeof companyName !== 'string' || companyName.trim().length === 0)) {
      return Response.json({ error: 'Company name is required for Managerial and HR modes' }, { status: 400 })
    }
    if (companyName !== undefined && (typeof companyName !== 'string' || companyName.trim().length > 100)) {
      return Response.json({ error: 'Company name must be 100 characters or fewer' }, { status: 400 })
    }

    // Ensure user exists in our database
    await prisma.user.upsert({
      where: { id: user.id },
      create: {
        id: user.id,
        email: user.email!,
        name: user.user_metadata?.name || null,
        avatarUrl: user.user_metadata?.avatar_url || null,
      },
      update: {
        email: user.email!,
        name: user.user_metadata?.name || null,
      },
    })

    const session = await prisma.session.create({
      data: {
        userId: user.id,
        topic: topic.trim(),
        interviewMode: interviewMode as InterviewMode,
        companyName: typeof companyName === 'string' ? companyName.trim() : null,
        language,
        status: 'active',
      },
    })

    return Response.json({ sessionId: session.id })
  } catch (error) {
    console.error('Failed to create session:', error)

    const message = error instanceof Error ? error.message.toLowerCase() : ''
    if (message.includes('password authentication failed')) {
      return Response.json(
        { error: 'Database authentication failed. Update DATABASE_URL with the current Supabase database password.' },
        { status: 503 }
      )
    }

    if (message.includes("can't reach database server") || message.includes('enotfound')) {
      return Response.json(
        { error: 'Database connection failed. Check the Supabase DATABASE_URL.' },
        { status: 503 }
      )
    }

    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

    const { sessionId, imageUrl } = await request.json()
    if (!sessionId || typeof imageUrl !== 'string' || !imageUrl.startsWith(`${user.id}/`)) {
      return Response.json({ error: 'Invalid session image' }, { status: 400 })
    }

    const session = await prisma.session.updateMany({
      where: { id: sessionId, userId: user.id },
      data: { imageUrl },
    })
    if (session.count === 0) return Response.json({ error: 'Session not found' }, { status: 404 })
    return Response.json({ ok: true })
  } catch {
    return Response.json({ error: 'Failed to attach image' }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const sessions = await prisma.session.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        topic: true,
        interviewMode: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        evaluationReport: true,
        _count: {
          select: { messages: true },
        },
      },
    })

    return Response.json({ sessions })
  } catch (error) {
    console.error('Failed to fetch sessions:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
