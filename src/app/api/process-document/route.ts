import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/db'
import { extractTextFromPdf } from '@/lib/rag/pdf-parser'
import { chunkText } from '@/lib/rag/chunker'
import { generateEmbeddings } from '@/lib/rag/embeddings'
import { storeEmbeddings } from '@/lib/rag/vector-store'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { sessionId } = await request.json()

    // Get documents for this session
    const documents = await prisma.document.findMany({
      where: { sessionId, processed: false },
    })

    if (documents.length === 0) {
      return Response.json({ message: 'No documents to process' })
    }

    for (const doc of documents) {
      try {
        // Download file from Supabase Storage
        const filePath = `${user.id}/${sessionId}/${doc.fileName}`
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(filePath)

        if (downloadError || !fileData) {
          console.error('Download error:', downloadError)
          continue
        }

        // Extract text from PDF
        const buffer = Buffer.from(await fileData.arrayBuffer())
        const text = await extractTextFromPdf(buffer)

        if (!text || text.length === 0) {
          console.error('No text extracted from PDF')
          continue
        }

        // Chunk the text
        const chunks = chunkText(text)

        if (chunks.length === 0) {
          continue
        }

        // Generate embeddings
        const chunkTexts = chunks.map((c) => c.content)
        const embeddings = await generateEmbeddings(chunkTexts)

        // Store in vector database
        const chunksWithEmbeddings = chunks.map((chunk, i) => ({
          content: chunk.content,
          embedding: embeddings[i],
          documentId: doc.id,
          metadata: {
            ...chunk.metadata,
            sessionId,
            fileName: doc.fileName,
          },
        }))

        await storeEmbeddings(chunksWithEmbeddings)

        // Mark document as processed
        await prisma.document.update({
          where: { id: doc.id },
          data: { processed: true },
        })
      } catch (error) {
        console.error(`Failed to process document ${doc.id}:`, error)
      }
    }

    return Response.json({ success: true })
  } catch (error) {
    console.error('Document processing failed:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
