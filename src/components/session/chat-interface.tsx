'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Send,
  Loader2,
  Square,
  Flag,
  Clock,
  Brain,
  User,
  Lightbulb,
  HelpCircle,
  Mic,
  MicOff,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  id: string
  role: 'user' | 'ai'
  content: string
  mode?: 'understanding' | 'socratic' | null
}

interface ChatInterfaceProps {
  sessionId: string
  topic: string
}

export default function ChatInterface({ sessionId, topic }: ChatInterfaceProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [elapsedTime, setElapsedTime] = useState(0)
  const [isListening, setIsListening] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  // Timer
  useEffect(() => {
    if (sessionEnded) return
    const interval = setInterval(() => setElapsedTime((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [sessionEnded])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Start session with greeting
  useEffect(() => {
    async function startSession() {
      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, action: 'start' }),
        })
        const data = await res.json()
        if (data.message) {
          setMessages([{
            id: 'greeting',
            role: 'ai',
            content: data.message,
            mode: null,
          }])
        }
      } catch {
        toast.error('Failed to start session')
      }
    }
    startSession()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Voice input setup
  const finalTranscriptRef = useRef('')
  const interimRef = useRef('')

  useEffect(() => {
    if (typeof window !== 'undefined' && ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      const recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'en-US'

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        let finalText = ''
        let interimText = ''

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i]
          if (result.isFinal) {
            finalText += result[0].transcript
          } else {
            interimText += result[0].transcript
          }
        }

        // Accumulate only finalized text
        if (finalText) {
          finalTranscriptRef.current += finalText
        }
        interimRef.current = interimText

        // Update input: base text + all finalized speech + current interim preview
        setInput((prev) => {
          // Find where speech text starts (everything before the first speech input)
          const baseText = prev.substring(0, prev.length - (interimRef.current.length || 0))
          // Rebuild: whatever was typed before + finalized speech + live interim
          return finalTranscriptRef.current + interimText
        })
      }

      recognition.onerror = () => {
        setIsListening(false)
      }

      recognition.onend = () => {
        // Commit final transcript and clear interim on stop
        interimRef.current = ''
        setIsListening(false)
      }

      recognitionRef.current = recognition
    }
  }, [])

  function toggleVoice() {
    if (!recognitionRef.current) {
      toast.error('Speech recognition is not supported in this browser')
      return
    }

    if (isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      // On stop, set input to only the finalized transcript (drop any interim)
      setInput(finalTranscriptRef.current)
    } else {
      // Reset speech tracking; preserve any text the user already typed
      const currentText = input
      finalTranscriptRef.current = currentText
      interimRef.current = ''
      recognitionRef.current.start()
      setIsListening(true)
    }
  }

  async function sendMessage() {
    if (!input.trim() || isLoading) return

    // Stop voice if active
    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop()
      setIsListening(false)
    }

    const userMessage = input.trim()
    setInput('')
    // Reset speech tracking for next mic session
    finalTranscriptRef.current = ''
    interimRef.current = ''
    setIsLoading(true)

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userMessage,
    }
    setMessages((prev) => [...prev, userMsg])

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, message: userMessage }),
      })

      const data = await res.json()

      if (data.error) {
        toast.error(data.error)
        return
      }

      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: 'ai',
        content: data.message,
        mode: data.mode,
      }
      setMessages((prev) => [...prev, aiMsg])
    } catch {
      toast.error('Failed to send message')
    } finally {
      setIsLoading(false)
    }
  }

  async function endSession(action: 'end' | 'give-up') {
    setIsLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, action }),
      })

      const data = await res.json()

      if (data.message) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ai-farewell`,
            role: 'ai',
            content: data.message,
            mode: null,
          },
        ])
      }

      setSessionEnded(true)

      // Navigate to report after a brief delay
      setTimeout(() => {
        router.push(`/session/${sessionId}/report`)
      }, 2000)
    } catch {
      toast.error('Failed to end session')
    } finally {
      setIsLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 lg:px-6 py-3 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
            <Brain className="size-4 text-primary" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">{topic}</h2>
            <p className="text-xs text-muted-foreground">Teaching Session</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 font-mono text-xs">
            <Clock className="size-3" />
            {formatTime(elapsedTime)}
          </Badge>

          {!sessionEnded && (
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => endSession('give-up')}
                disabled={isLoading}
                className="text-xs gap-1"
              >
                <Flag className="size-3" />
                I Give Up
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => endSession('end')}
                disabled={isLoading}
                className="text-xs gap-1"
              >
                <Square className="size-3" />
                End Session
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={msg.id}
            className={cn(
              'flex gap-3 animate-fade-in',
              msg.role === 'user' ? 'justify-end' : 'justify-start'
            )}
            style={{ animationDelay: `${i * 50}ms` }}
          >
            {msg.role === 'ai' && (
              <div className="flex items-start">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
                  <Brain className="size-4 text-primary" />
                </div>
              </div>
            )}

            <div
              className={cn(
                'max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed',
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted rounded-bl-md'
              )}
            >
              {msg.mode && (
                <div className="mb-1.5">
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] gap-1 py-0 h-5',
                      msg.mode === 'understanding'
                        ? 'border-success/30 text-success bg-success/5'
                        : 'border-warning/30 text-warning bg-warning/5'
                    )}
                  >
                    {msg.mode === 'understanding' ? (
                      <Lightbulb className="size-2.5" />
                    ) : (
                      <HelpCircle className="size-2.5" />
                    )}
                    {msg.mode === 'understanding' ? 'Understanding' : 'Socratic'}
                  </Badge>
                </div>
              )}
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>

            {msg.role === 'user' && (
              <div className="flex items-start">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary shrink-0">
                  <User className="size-4 text-secondary-foreground" />
                </div>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 animate-fade-in">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 shrink-0">
              <Brain className="size-4 text-primary" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      {!sessionEnded && (
        <div className="border-t border-border/50 bg-background/80 backdrop-blur-md px-4 lg:px-6 py-3">
          <div className="flex items-end gap-2 max-w-4xl mx-auto">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleVoice}
              className={cn(
                'shrink-0 mb-0.5',
                isListening && 'text-destructive animate-pulse-glow'
              )}
            >
              {isListening ? (
                <MicOff className="size-4" />
              ) : (
                <Mic className="size-4" />
              )}
            </Button>

            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Explain the concept to your peer..."
              className="min-h-[44px] max-h-[160px] resize-none text-sm"
              rows={1}
              disabled={isLoading}
            />

            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="shrink-0 mb-0.5 bg-gradient-brand hover:opacity-90 transition-opacity"
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
