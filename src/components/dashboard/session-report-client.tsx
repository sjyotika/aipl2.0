'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import type { EvaluationReport } from '@/lib/evaluation/schema'
import {
  Trophy,
  Target,
  BookOpen,
  AlertTriangle,
  Lightbulb,
  ArrowRight,
  MessageSquarePlus,
  BarChart3,
  TrendingUp,
  XCircle,
  CheckCircle2,
  Clock,
  Brain,
  Download,
} from 'lucide-react'
import { cn } from '@/lib/utils'

function ScoreRing({ score, label, size = 120 }: { score: number; label: string; size?: number }) {
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-destructive'
  const bgColor =
    score >= 70 ? 'stroke-success/15' : score >= 40 ? 'stroke-warning/15' : 'stroke-destructive/15'
  const strokeColor =
    score >= 70 ? 'stroke-success' : score >= 40 ? 'stroke-warning' : 'stroke-destructive'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90" width={size} height={size}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={6}
            className={bgColor}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={6}
            strokeLinecap="round"
            className={cn(strokeColor, 'transition-all duration-1000 ease-out')}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn('text-2xl font-bold', color)}>{score}</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  )
}

function ScoreCard({
  icon: Icon,
  label,
  score,
  className,
}: {
  icon: React.ElementType
  label: string
  score: number
  className?: string
}) {
  const color =
    score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-destructive'
  const bg =
    score >= 70 ? 'bg-success/10' : score >= 40 ? 'bg-warning/10' : 'bg-destructive/10'

  return (
    <div className={cn('glass rounded-2xl p-5 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center justify-center w-8 h-8 rounded-lg', bg)}>
            <Icon className={cn('size-4', color)} />
          </div>
          <span className="text-sm font-medium">{label}</span>
        </div>
        <span className={cn('text-2xl font-bold', color)}>{score}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-1000 ease-out',
            score >= 70 ? 'bg-success' : score >= 40 ? 'bg-warning' : 'bg-destructive'
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

interface SessionReportClientProps {
  sessionId: string
  topic: string
  initialReport: EvaluationReport | null
}

export default function SessionReportClient({
  sessionId,
  topic,
  initialReport,
}: SessionReportClientProps) {
  const [report, setReport] = useState<EvaluationReport | null>(initialReport)
  const [isLoading, setIsLoading] = useState(!initialReport)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialReport) return

    const pollReport = async () => {
      try {
        const res = await fetch('/api/evaluate', {
          method: 'POST',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        })
        const data = await res.json()
        if (data.report) {
          setReport(data.report)
          setIsLoading(false)
          return true
        }

        if (res.status >= 400) {
          setError(data.error || 'We could not analyze this session.')
          setIsLoading(false)
          return true
        }
      } catch {}
      return false
    }

    // Poll every 3 seconds
    const interval = setInterval(async () => {
      const done = await pollReport()
      if (done) clearInterval(interval)
    }, 3000)

    // Initial attempt
    pollReport()

    return () => clearInterval(interval)
  }, [sessionId, initialReport])

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center space-y-4">
        <h1 className="text-2xl font-bold">Analysis unavailable</h1>
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={() => window.location.reload()}>Try again</Button>
      </div>
    )
  }

  if (isLoading || !report) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8 animate-fade-in">
        <div className="text-center space-y-4 py-12">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mx-auto animate-pulse-glow">
            <Brain className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Analyzing Your Session</h1>
          <p className="text-muted-foreground">
            Our AI is evaluating your explanation of <strong>{topic}</strong>...
          </p>
          <div className="space-y-3 max-w-md mx-auto pt-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4 mx-auto" />
            <Skeleton className="h-4 w-1/2 mx-auto" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <BarChart3 className="size-4" />
            Session Report
          </div>
          <h1 className="text-2xl font-bold tracking-tight">{topic}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" render={<a href={`/api/sessions/${sessionId}/report/pdf`} download />}>
            <Download className="size-4" />
            Download PDF
          </Button>
          <Button className="bg-gradient-brand hover:opacity-90 gap-2" render={<Link href="/session/new" />}>
              <MessageSquarePlus className="size-4" />
              New Session
          </Button>
        </div>
      </div>

      {/* Overall Score */}
      <div className="glass rounded-2xl p-8 flex flex-col items-center gap-6">
        <ScoreRing score={report.overall_score} label="Overall Score" size={140} />
        <div className="flex items-center gap-2">
          <Badge variant={report.confidence_flag ? 'default' : 'outline'} className="gap-1">
            {report.confidence_flag ? (
              <CheckCircle2 className="size-3" />
            ) : (
              <AlertTriangle className="size-3" />
            )}
            {report.confidence_flag ? 'Confident' : 'Uncertain'}
          </Badge>
        </div>
      </div>

      {/* Score Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 stagger-children">
        <ScoreCard icon={Target} label="Accuracy" score={report.accuracy_score} />
        <ScoreCard icon={BookOpen} label="Coverage" score={report.coverage_score} />
      </div>

      {/* Narrative */}
      {report.session_narrative && (
        <div className="glass rounded-2xl p-6 space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            <TrendingUp className="size-4 text-primary" />
            Session Summary
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {report.session_narrative}
          </p>
        </div>
      )}

      {/* Conceptual Gaps */}
      {report.conceptual_gaps.length > 0 && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <AlertTriangle className="size-4 text-warning" />
            Conceptual Gaps ({report.conceptual_gaps.length})
          </div>
          <div className="space-y-2">
            {report.conceptual_gaps.map((gap, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl bg-warning/5 border border-warning/10 p-3"
              >
                <div className="flex items-center justify-center w-6 h-6 rounded-md bg-warning/10 shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-warning">{i + 1}</span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">{gap}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Misconceptions */}
      {report.misconceptions.length > 0 && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <XCircle className="size-4 text-destructive" />
            Misconceptions ({report.misconceptions.length})
          </div>
          <div className="space-y-3">
            {report.misconceptions.map((m, i) => (
              <div key={i} className="rounded-xl border border-border/50 overflow-hidden">
                <div className="bg-destructive/5 px-4 py-2.5 border-b border-border/50">
                  <p className="text-sm">
                    <span className="text-xs font-medium text-destructive mr-1.5">✗</span>
                    {m.misconception}
                  </p>
                </div>
                <div className="bg-success/5 px-4 py-2.5">
                  <p className="text-sm">
                    <span className="text-xs font-medium text-success mr-1.5">✓</span>
                    {m.correction}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Improvement Suggestions */}
      {report.improvement_suggestions.length > 0 && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Lightbulb className="size-4 text-primary" />
            How to Improve
          </div>
          <div className="space-y-2">
            {report.improvement_suggestions.map((s, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-xl bg-primary/5 border border-primary/10 p-3"
              >
                <ArrowRight className="size-4 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground leading-relaxed">{s}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mode Transitions */}
      {report.mode_transitions.length > 0 && (
        <div className="glass rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Clock className="size-4 text-chart-5" />
            Dialogue Arc
          </div>
          <div className="flex flex-wrap gap-1.5">
            {report.mode_transitions.map((t, i) => (
              <Badge
                key={i}
                variant="outline"
                className={cn(
                  'text-xs gap-1',
                  t.mode === 'understanding'
                    ? 'border-success/30 text-success bg-success/5'
                    : 'border-warning/30 text-warning bg-warning/5'
                )}
              >
                T{t.turn}: {t.mode === 'understanding' ? '✓' : '?'} {t.mode}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-center gap-3 pt-4">
        <Button variant="outline" render={<Link href="/dashboard" />}>
          View All Sessions
        </Button>
        <Button className="bg-gradient-brand hover:opacity-90 gap-2" render={<Link href="/session/new" />}>
            Practice Again
            <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}
