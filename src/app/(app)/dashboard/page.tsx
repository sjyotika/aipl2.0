'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  BarChart3,
  Target,
  BookOpen,
  Trophy,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  Flame,
  ArrowRight,
  MessageSquarePlus,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles,
  Brain,
  ChevronRight,
} from 'lucide-react'

interface AnalyticsData {
  totalSessions: number
  scoreTrends: Array<{
    date: string
    topic: string
    accuracy: number
    coverage: number
    overall: number
  }>
  avgScores: {
    accuracy: number
    coverage: number
    overall: number
  }
  weakAreas: Array<{ gap: string; count: number }>
  topicMastery: Array<{
    topic: string
    avgScore: number
    attempts: number
    lastDate: string
    trend: number
  }>
  streak: {
    current: number
    longest: number
    activeDays: number
  }
  recentSessions: Array<{
    id: string
    topic: string
    status: string
    createdAt: string
    messageCount: number
    overallScore: number | null
  }>
}

function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  color = 'text-primary',
  bg = 'bg-primary/10',
}: {
  icon: React.ElementType
  label: string
  value: string | number
  subtext?: string
  color?: string
  bg?: string
}) {
  return (
    <div className="glass rounded-2xl p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg', bg)}>
          <Icon className={cn('size-4', color)} />
        </div>
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        {subtext && <p className="text-xs text-muted-foreground mt-0.5">{subtext}</p>}
      </div>
    </div>
  )
}

function MiniBar({ value, max = 100 }: { value: number; max?: number }) {
  const pct = Math.min((value / max) * 100, 100)
  const color = value >= 70 ? 'bg-success' : value >= 40 ? 'bg-warning' : 'bg-destructive'
  return (
    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
      <div
        className={cn('h-full rounded-full transition-all duration-700', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetch('/api/analytics', { cache: 'no-store' })
      .then((r) => {
        if (!r.ok) return null
        return r.json()
      })
      .then((d) => {
        if (d && d.totalSessions !== undefined) {
          setData(d)
        }
        setIsLoading(false)
      })
      .catch(() => setIsLoading(false))
  }, [])

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
      </div>
    )
  }

  // Empty state
  if (!data || data.totalSessions === 0) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] p-6">
        <div className="text-center space-y-6 max-w-md animate-fade-in-up">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto">
            <Brain className="size-8 text-primary" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">No Sessions Yet</h1>
            <p className="text-muted-foreground">
              Start your first teaching session to see your learning analytics here.
            </p>
          </div>
          <Button className="bg-gradient-brand hover:opacity-90 gap-2" render={<Link href="/session/new" />}>
              <MessageSquarePlus className="size-4" />
              Start First Session
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Your learning journey at a glance
          </p>
        </div>
        <Button className="bg-gradient-brand hover:opacity-90 gap-2" render={<Link href="/session/new" />}>
            <MessageSquarePlus className="size-4" />
            New Session
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 stagger-children">
        <StatCard
          icon={Trophy}
          label="Overall Average"
          value={`${data.avgScores.overall}%`}
          subtext={`${data.totalSessions} sessions total`}
        />
        <StatCard
          icon={Target}
          label="Accuracy"
          value={`${data.avgScores.accuracy}%`}
          color="text-chart-2"
          bg="bg-chart-2/10"
        />
        <StatCard
          icon={BookOpen}
          label="Coverage"
          value={`${data.avgScores.coverage}%`}
          color="text-chart-5"
          bg="bg-chart-5/10"
        />
        <StatCard
          icon={Flame}
          label="Current Streak"
          value={`${data.streak.current} days`}
          subtext={`Longest: ${data.streak.longest} days`}
          color="text-destructive"
          bg="bg-destructive/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Score Trend */}
        {data.scoreTrends.length > 0 && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="size-4 text-primary" />
              Score Trends
            </div>
            <div className="space-y-3">
              {data.scoreTrends.slice(-8).map((s, i) => (
                <div key={i} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground truncate max-w-[60%]">
                      {s.topic}
                    </span>
                    <span className="font-medium">{s.overall}%</span>
                  </div>
                  <MiniBar value={s.overall} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Topic Mastery */}
        {data.topicMastery.length > 0 && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Sparkles className="size-4 text-chart-4" />
              Topic Mastery
            </div>
            <div className="space-y-2.5">
              {data.topicMastery.slice(0, 8).map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 rounded-xl bg-muted/30 p-3"
                >
                  <div
                    className={cn(
                      'flex items-center justify-center w-8 h-8 rounded-lg text-xs font-bold',
                      t.avgScore >= 70
                        ? 'bg-success/10 text-success'
                        : t.avgScore >= 40
                        ? 'bg-warning/10 text-warning'
                        : 'bg-destructive/10 text-destructive'
                    )}
                  >
                    {t.avgScore}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium capitalize truncate">
                      {t.topic}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.attempts} attempt{t.attempts > 1 ? 's' : ''}
                      {t.trend !== 0 && (
                        <span
                          className={cn(
                            'ml-1.5',
                            t.trend > 0 ? 'text-success' : 'text-destructive'
                          )}
                        >
                          {t.trend > 0 ? '↑' : '↓'} {Math.abs(t.trend)}pts
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Weak Areas */}
        {data.weakAreas.length > 0 && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle className="size-4 text-warning" />
              Recurring Weak Areas
            </div>
            <div className="space-y-2">
              {data.weakAreas.map((w, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-xl bg-warning/5 border border-warning/10 p-3"
                >
                  <Badge
                    variant="outline"
                    className="shrink-0 text-xs border-warning/30 text-warning"
                  >
                    ×{w.count}
                  </Badge>
                  <p className="text-sm text-muted-foreground capitalize">
                    {w.gap}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Growth Callouts */}
        {data.topicMastery.some((t) => t.trend > 10) && (
          <div className="glass rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TrendingUp className="size-4 text-success" />
              Growth Highlights
            </div>
            <div className="space-y-2">
              {data.topicMastery
                .filter((t) => t.trend > 10)
                .map((t, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 rounded-xl bg-success/5 border border-success/10 p-3"
                  >
                    <CheckCircle2 className="size-4 text-success shrink-0" />
                    <p className="text-sm text-muted-foreground capitalize">
                      Improved <strong className="text-foreground">{t.topic}</strong>{' '}
                      by {t.trend} points across {t.attempts} sessions!
                    </p>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent Sessions */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-chart-5" />
            All Sessions
          </div>
        </div>

        <div className="space-y-2">
          {data.recentSessions.map((s) => (
            <Link
              key={s.id}
              href={`/session/${s.id}/report`}
              className="flex items-center gap-4 rounded-xl hover:bg-muted/40 transition-colors p-3 group"
            >
              <div
                className={cn(
                  'flex items-center justify-center w-10 h-10 rounded-lg text-sm font-bold',
                  s.overallScore !== null
                    ? s.overallScore >= 70
                      ? 'bg-success/10 text-success'
                      : s.overallScore >= 40
                      ? 'bg-warning/10 text-warning'
                      : 'bg-destructive/10 text-destructive'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {s.overallScore ?? '—'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{s.topic}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(s.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                  {' · '}
                  {s.messageCount} messages
                </p>
              </div>
              <Badge
                variant="outline"
                className={cn(
                  'text-xs',
                  s.status === 'completed'
                    ? 'border-success/30 text-success'
                    : 'border-muted-foreground/30'
                )}
              >
                {s.status}
              </Badge>
              <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
