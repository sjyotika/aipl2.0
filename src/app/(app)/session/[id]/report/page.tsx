import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import SessionReportClient from '@/components/dashboard/session-report-client'
import type { EvaluationReport } from '@/lib/evaluation/schema'

export const dynamic = 'force-dynamic'

export default async function SessionReportPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
  })

  if (!session) {
    redirect('/dashboard')
  }

  const report = session.evaluationReport as unknown as EvaluationReport | null

  return (
    <SessionReportClient
      sessionId={id}
      topic={session.topic}
      initialReport={report}
    />
  )
}
