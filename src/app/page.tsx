import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Brain, ArrowRight, BookOpen, MessageSquare, BarChart3 } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {/* Animated background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-20 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/5 blur-3xl animate-float" />
          <div className="absolute bottom-20 right-1/4 w-[400px] h-[400px] rounded-full bg-chart-4/5 blur-3xl animate-float" style={{ animationDelay: '2s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-primary/3 blur-3xl animate-pulse-glow" />
        </div>

        <div className="relative z-10 max-w-3xl mx-auto px-6 py-24 text-center space-y-8 animate-fade-in-up">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-brand shadow-lg shadow-primary/30">
              <Brain className="size-6 text-primary-foreground" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl sm:text-6xl font-bold tracking-tight">
              Learn by{' '}
              <span className="text-gradient">Teaching</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Scholarium uses the Protégé Effect — teach an AI peer, and it will
              challenge your understanding with Socratic questions to deepen your knowledge.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              size="lg"
              className="h-12 px-8 bg-gradient-brand hover:opacity-90 transition-opacity gap-2 text-base"
              render={<Link href="/register" />}
            >
              Get Started Free
              <ArrowRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-12 px-8 gap-2 text-base"
              render={<Link href="/login" />}
            >
              Sign In
            </Button>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-12 stagger-children">
            <div className="glass rounded-2xl p-5 text-left space-y-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                <BookOpen className="size-5 text-primary" />
              </div>
              <h3 className="font-semibold text-sm">Teach to Learn</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Explain concepts to your AI peer — articulating knowledge reveals gaps you didn&apos;t know existed.
              </p>
            </div>
            <div className="glass rounded-2xl p-5 text-left space-y-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-chart-4/10">
                <MessageSquare className="size-5 text-chart-4" />
              </div>
              <h3 className="font-semibold text-sm">Socratic Dialogue</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The AI asks probing questions that push you to think deeper — never giving away answers.
              </p>
            </div>
            <div className="glass rounded-2xl p-5 text-left space-y-2">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-success/10">
                <BarChart3 className="size-5 text-success" />
              </div>
              <h3 className="font-semibold text-sm">Track Growth</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Detailed reports after each session show accuracy, gaps, and improvement over time.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
