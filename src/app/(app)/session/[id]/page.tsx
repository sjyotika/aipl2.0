import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { redirect } from 'next/navigation'
import ChatInterface from '@/components/session/chat-interface'

export const dynamic = 'force-dynamic'

export default async function SessionPage({
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

  // If session is already completed, redirect to report
  if (session.status !== 'active') {
    redirect(`/session/${id}/report`)
  }

  return <ChatInterface sessionId={id} topic={session.topic} />
}
