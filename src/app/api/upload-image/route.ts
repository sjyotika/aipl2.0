import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { prisma } from '@/lib/db'

const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('image')
  if (!(file instanceof File)) return Response.json({ error: 'Image is required' }, { status: 400 })
  if (!ALLOWED_TYPES.has(file.type)) return Response.json({ error: 'Only PNG, JPEG, and WEBP images are supported' }, { status: 400 })
  if (file.size > MAX_IMAGE_SIZE) return Response.json({ error: 'Image exceeds the 5 MB limit' }, { status: 400 })

  const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.split('/')[1]
  const storagePath = `${user.id}/${crypto.randomUUID()}.${extension}`
  const sessionId = formData.get('sessionId')
  if (typeof sessionId === 'string') {
    const session = await prisma.session.findFirst({ where: { id: sessionId, userId: user.id } })
    if (!session) return Response.json({ error: 'Session not found' }, { status: 404 })
  }
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((bucket) => bucket.name === 'images')) {
    const { error } = await admin.storage.createBucket('images', { public: false, fileSizeLimit: MAX_IMAGE_SIZE, allowedMimeTypes: [...ALLOWED_TYPES] })
    if (error) return Response.json({ error: 'Image storage is not configured' }, { status: 503 })
  }

  const { error } = await admin.storage.from('images').upload(storagePath, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false })
  if (error) return Response.json({ error: 'Image upload failed' }, { status: 500 })

  return Response.json({ url: storagePath })
}
