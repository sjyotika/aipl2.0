import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_AUDIO_TYPES = new Set(['audio/webm', 'audio/wav', 'audio/mpeg', 'audio/mp4', 'audio/ogg'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const audio = formData.get('audio')
  const languageValue = formData.get('language')
  const language = typeof languageValue === 'string' ? languageValue : 'en'
  if (!(audio instanceof File)) return Response.json({ error: 'Audio is required' }, { status: 400 })
  if (!ALLOWED_AUDIO_TYPES.has(audio.type)) return Response.json({ error: 'Unsupported audio format' }, { status: 400 })
  if (audio.size > 25 * 1024 * 1024) return Response.json({ error: 'Audio exceeds the 25 MB limit' }, { status: 400 })

  const endpoint = process.env.FASTER_WHISPER_URL
  if (!endpoint) return Response.json({ error: 'Server transcription is not configured' }, { status: 503 })

  const upstream = new FormData()
  upstream.append('audio', audio, audio.name || 'speech.webm')
  upstream.append('language', language)
  upstream.append('task', 'transcribe')
  const response = await fetch(endpoint, { method: 'POST', body: upstream, signal: AbortSignal.timeout(120000) })
  if (!response.ok) return Response.json({ error: 'Transcription failed' }, { status: 502 })

  const result = await response.json() as { text?: string; language?: string; language_probability?: number; segments?: unknown[] }
  return Response.json({ text: result.text || '', detectedLanguage: result.language || language, confidence: result.language_probability, segments: result.segments })
}
