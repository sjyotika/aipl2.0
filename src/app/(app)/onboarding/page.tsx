'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Brain, BookOpen, MessageSquare, BarChart3, ArrowRight, ChevronRight } from 'lucide-react'

const steps = [
  {
    icon: BookOpen,
    title: 'Teach Your AI Peer',
    description:
      'Pick a topic you want to master. Then explain it to your AI peer as if they know nothing about it. The act of explaining is the learning.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: MessageSquare,
    title: 'Answer Socratic Questions',
    description:
      'Your AI peer will ask probing, targeted questions about your explanation. These aren\'t trick questions — they\'re designed to surface gaps in your understanding.',
    color: 'text-chart-4',
    bg: 'bg-chart-4/10',
  },
  {
    icon: BarChart3,
    title: 'Review Your Progress',
    description:
      'After each session, get a detailed report: accuracy scores, conceptual gaps, misconceptions, and personalized suggestions for improvement.',
    color: 'text-success',
    bg: 'bg-success/10',
  },
]

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0)
  const router = useRouter()

  function handleNext() {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      router.push('/session/new')
    }
  }

  const step = steps[currentStep]

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] p-6">
      <div className="max-w-lg w-full space-y-8 animate-fade-in">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-brand shadow-lg shadow-primary/20 mx-auto">
            <Brain className="size-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight mt-4">
            How Scholarium Works
          </h1>
          <p className="text-sm text-muted-foreground">
            The Protégé Effect: you learn more when you teach others
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-500 ${
                i === currentStep
                  ? 'w-8 bg-primary'
                  : i < currentStep
                  ? 'w-4 bg-primary/40'
                  : 'w-4 bg-muted'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div key={currentStep} className="glass rounded-2xl p-8 text-center space-y-5 animate-scale-in">
          <div
            className={`flex items-center justify-center w-14 h-14 rounded-2xl ${step.bg} mx-auto`}
          >
            <step.icon className={`size-7 ${step.color}`} />
          </div>
          <h2 className="text-xl font-semibold">{step.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => router.push('/session/new')}
            className="text-muted-foreground"
          >
            Skip
          </Button>
          <Button
            onClick={handleNext}
            className="bg-gradient-brand hover:opacity-90 transition-opacity gap-2"
          >
            {currentStep < steps.length - 1 ? (
              <>
                Next
                <ChevronRight className="size-4" />
              </>
            ) : (
              <>
                Start Learning
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}
