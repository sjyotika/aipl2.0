import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sessionId = formData.get('sessionId') as string | null

    if (!file || !sessionId) {
      return Response.json({ error: 'File and sessionId are required' }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return Response.json({ error: 'Only PDF files are accepted' }, { status: 400 })
    }

    // Validate file size (10MB)
    if (file.size > 10 * 1024 * 1024) {
      return Response.json({ error: 'File too large. Maximum size is 10MB' }, { status: 400 })
    }

    // Verify session belongs to user
    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: user.id },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    // Upload to Supabase Storage
    const fileName = `${user.id}/${sessionId}/${file.name}`
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(fileName, buffer, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return Response.json(
        { error: `Failed to upload file: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(fileName)

    // Create document record
    const document = await prisma.document.create({
      data: {
        sessionId,
        fileName: file.name,
        fileUrl: urlData.publicUrl,
        processed: false,
      },
    })

    return Response.json({ documentId: document.id, fileUrl: urlData.publicUrl })
  } catch (error) {
    console.error('Upload failed:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
