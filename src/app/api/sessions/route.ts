import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { topic } = await request.json()

    if (!topic || typeof topic !== 'string' || topic.trim().length === 0) {
      return Response.json({ error: 'Topic is required' }, { status: 400 })
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
        status: 'active',
      },
    })

    return Response.json({ sessionId: session.id })
  } catch (error) {
    console.error('Failed to create session:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
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
