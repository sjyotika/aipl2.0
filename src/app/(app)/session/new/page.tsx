'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useDropzone } from 'react-dropzone'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import {
  FileText,
  Upload,
  X,
  ArrowRight,
  Loader2,
  BookOpen,
  Sparkles,
} from 'lucide-react'
import LanguageSelector from '@/components/LanguageSelector'
import { useLanguage } from '@/context/LanguageContext'
import ImageUpload from '@/components/ImageUpload'

export default function NewSessionPage() {
  const [topic, setTopic] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isCreating, setIsCreating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const router = useRouter()
  const { language } = useLanguage()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const pdfFile = acceptedFiles[0]
    if (pdfFile) {
      if (pdfFile.size > 10 * 1024 * 1024) {
        toast.error('File too large. Maximum size is 10MB.')
        return
      }
      if (pdfFile.type !== 'application/pdf') {
        toast.error('Only PDF files are accepted.')
        return
      }
      setFile(pdfFile)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  async function handleCreateSession() {
    if (!topic.trim()) {
      toast.error('Please enter a topic.')
      return
    }

    setIsCreating(true)

    try {
      // Create session
      const sessionRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), language }),
      })

      if (!sessionRes.ok) {
        const errorData = await sessionRes.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to create session')
      }

      const { sessionId } = await sessionRes.json()

      if (imageUrl) {
        const imageSessionRes = await fetch('/api/sessions', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId, imageUrl }),
        })
        if (!imageSessionRes.ok) toast.error('Image could not be attached, but the session was created.')
      }

      // Upload PDF if provided
      if (file) {
        setUploadProgress(10)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('sessionId', sessionId)

        setUploadProgress(30)
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        })

        if (!uploadRes.ok) {
          toast.error('PDF upload failed, but session was created.')
        } else {
          setUploadProgress(60)

          // Process document (chunk + embed)
          const processRes = await fetch('/api/process-document', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          })

          if (!processRes.ok) {
            toast.error('Document processing failed, continuing without RAG context.')
          }
          setUploadProgress(100)
        }
      }

      router.push(`/session/${sessionId}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create session. Please try again.')
      setIsCreating(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)] p-6">
      <div className="max-w-xl w-full space-y-8 animate-fade-in-up">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Sparkles className="size-4" />
            New Learning Session
          </div>
          <h1 className="text-3xl font-bold tracking-tight">
            What will you teach today?
          </h1>
          <p className="text-muted-foreground">
            Choose a topic and optionally upload reference material. Your AI peer
            is ready to learn from you.
          </p>
        </div>

        {/* Topic Input */}
        <div className="space-y-3">
          <Label htmlFor="session-topic" className="text-sm font-medium">
            Topic <span className="text-destructive">*</span>
          </Label>
          <div className="relative">
            <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              id="session-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="e.g., Binary Search Trees, Photosynthesis, Supply & Demand..."
              className="pl-10 h-12 text-base"
              autoFocus
            />
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-sm font-medium">Conversation language</Label>
          <LanguageSelector />
        </div>

        {/* Reference and multimodal input */}
        <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Reference Material{' '}
            <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>

          {!file ? (
            <div
              {...getRootProps()}
              className={`
                border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all duration-200
                ${
                  isDragActive
                    ? 'border-primary bg-primary/5 scale-[1.01]'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                }
              `}
            >
              <input {...getInputProps()} />
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-muted">
                  <Upload className="size-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {isDragActive ? 'Drop your PDF here' : 'Drag & drop a PDF file'}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    or click to browse • PDF only • max 10MB
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                  <FileText className="size-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setFile(null)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </Button>
              </CardContent>
            </Card>
          )}

          {isCreating && file && uploadProgress > 0 && uploadProgress < 100 && (
            <div className="space-y-1.5">
              <Progress value={uploadProgress} className="h-1.5" />
              <p className="text-xs text-muted-foreground text-center">
                Processing document...
              </p>
            </div>
          )}
        </div>
        <div className="space-y-3">
          <Label className="text-sm font-medium">
            Multimodal input <span className="text-muted-foreground font-normal">(optional)</span>
          </Label>
          <p className="text-xs text-muted-foreground">Attach a diagram, graph, handwritten explanation, or image. PNG, JPG, WEBP, max 5MB.</p>
          <ImageUpload onUpload={setImageUrl} />
          {imageUrl && <p className="text-xs text-success">Image attached to this session.</p>}
        </div>
        </div>

        {/* Start Session */}
        <Button
          onClick={handleCreateSession}
          disabled={!topic.trim() || isCreating}
          className="w-full h-12 bg-gradient-brand hover:opacity-90 transition-opacity gap-2 text-base"
          size="lg"
        >
          {isCreating ? (
            <>
              <Loader2 className="size-5 animate-spin" />
              Creating session...
            </>
          ) : (
            <>
              Start Teaching
              <ArrowRight className="size-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
