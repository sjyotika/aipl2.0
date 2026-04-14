import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import type { EvaluationReport } from '@/lib/evaluation/schema'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch all completed sessions with reports
    const sessions = await prisma.session.findMany({
      where: {
        userId: user.id,
        status: { in: ['completed', 'abandoned'] },
        evaluationReport: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        topic: true,
        status: true,
        createdAt: true,
        evaluationReport: true,
        _count: {
          select: { messages: true },
        },
      },
    })

    // Compute analytics
    const reports = sessions
      .filter((s) => s.evaluationReport)
      .map((s) => ({
        ...s,
        report: s.evaluationReport as unknown as EvaluationReport,
      }))

    // Score trends (last 20 sessions)
    const scoreTrends = reports.slice(0, 20).reverse().map((s) => ({
      date: s.createdAt.toISOString().split('T')[0],
      topic: s.topic,
      accuracy: s.report.accuracy_score,
      coverage: s.report.coverage_score,
      overall: s.report.overall_score,
    }))

    // Average scores
    const avgScores = reports.length
      ? {
          accuracy: Math.round(
            reports.reduce((sum, s) => sum + s.report.accuracy_score, 0) / reports.length
          ),
          coverage: Math.round(
            reports.reduce((sum, s) => sum + s.report.coverage_score, 0) / reports.length
          ),
          overall: Math.round(
            reports.reduce((sum, s) => sum + s.report.overall_score, 0) / reports.length
          ),
        }
      : { accuracy: 0, coverage: 0, overall: 0 }

    // Weak areas (recurring gaps)
    const gapCounts = new Map<string, number>()
    reports.forEach((s) => {
      s.report.conceptual_gaps.forEach((gap) => {
        const key = gap.toLowerCase().trim()
        gapCounts.set(key, (gapCounts.get(key) || 0) + 1)
      })
    })
    const weakAreas = Array.from(gapCounts.entries())
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([gap, count]) => ({ gap, count }))

    // Topic mastery map
    const topicMap = new Map<
      string,
      { scores: number[]; lastDate: string }
    >()
    reports.forEach((s) => {
      const topic = s.topic.toLowerCase().trim()
      const existing = topicMap.get(topic) || { scores: [], lastDate: '' }
      existing.scores.push(s.report.overall_score)
      existing.lastDate = s.createdAt.toISOString()
      topicMap.set(topic, existing)
    })
    const topicMastery = Array.from(topicMap.entries()).map(
      ([topic, data]) => ({
        topic,
        avgScore: Math.round(
          data.scores.reduce((a, b) => a + b, 0) / data.scores.length
        ),
        attempts: data.scores.length,
        lastDate: data.lastDate,
        trend:
          data.scores.length > 1
            ? data.scores[data.scores.length - 1] - data.scores[0]
            : 0,
      })
    )

    // Streak calculation
    const sessionDates = sessions
      .map((s) => s.createdAt.toISOString().split('T')[0])
      .filter((v, i, a) => a.indexOf(v) === i) // unique dates
      .sort()

    let currentStreak = 0
    let longestStreak = 0
    let tempStreak = 1

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]

    if (sessionDates.includes(today) || sessionDates.includes(yesterday)) {
      currentStreak = 1
      for (let i = sessionDates.length - 2; i >= 0; i--) {
        const diff =
          (new Date(sessionDates[i + 1]).getTime() -
            new Date(sessionDates[i]).getTime()) /
          86400000
        if (diff <= 1) {
          currentStreak++
        } else break
      }
    }

    for (let i = 1; i < sessionDates.length; i++) {
      const diff =
        (new Date(sessionDates[i]).getTime() -
          new Date(sessionDates[i - 1]).getTime()) /
        86400000
      if (diff <= 1) {
        tempStreak++
        longestStreak = Math.max(longestStreak, tempStreak)
      } else {
        tempStreak = 1
      }
    }
    longestStreak = Math.max(longestStreak, tempStreak)

    return Response.json({
      totalSessions: sessions.length,
      scoreTrends,
      avgScores,
      weakAreas,
      topicMastery,
      streak: {
        current: currentStreak,
        longest: longestStreak,
        activeDays: sessionDates.length,
      },
      recentSessions: sessions.slice(0, 10).map((s) => ({
        id: s.id,
        topic: s.topic,
        status: s.status,
        createdAt: s.createdAt,
        messageCount: s._count.messages,
        overallScore: s.evaluationReport
          ? (s.evaluationReport as unknown as EvaluationReport).overall_score
          : null,
      })),
    })
  } catch (error) {
    console.error('Analytics error:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
