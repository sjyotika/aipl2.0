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

    const session = await prisma.session.findFirst({
      where: { id: sessionId, userId: user.id },
      select: { topic: true },
    })

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 })
    }

    // Get documents for this session
    const documents = await prisma.document.findMany({
      where: { sessionId, processed: false },
    })

    if (documents.length === 0) {
      return Response.json({
        message: 'No documents to process',
        relevant: true,
        validations: [],
      })
    }

    const validations: Array<{
      documentId: string
      coversSelected: boolean
      primaryTopic: string
      confidence: number
      evidence: string
    }> = []
    const processingErrors: string[] = []

    for (const doc of documents) {
      try {
        // Download file from Supabase Storage
        const filePath = `${user.id}/${sessionId}/${doc.fileName}`
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('documents')
          .download(filePath)

        if (downloadError || !fileData) {
          console.error('Download error:', downloadError)
          processingErrors.push(`Could not download ${doc.fileName}.`)
          continue
        }

        // Extract text from PDF
        const buffer = Buffer.from(await fileData.arrayBuffer())
        const text = await extractTextFromPdf(buffer)

        if (!text || text.length === 0) {
          console.error('No text extracted from PDF')
          processingErrors.push(`Could not read text from ${doc.fileName}.`)
          continue
        }

        // Analyze document content for topic coverage
        const analysis = await import('@/lib/rag/documentAnalyzer').then(m =>
          m.analyzeDocumentContent(text, session.topic)
        )

        // Update Document with detected topic and confidence
        await prisma.document.update({
          where: { id: doc.id },
          data: {
            detectedTopic: analysis.primaryTopic,
            topicConfidence: analysis.confidence,
          },
        })

        // Store validation row linking session and document
        await prisma.sessionDocumentValidation.create({
          data: {
            sessionId,
            documentId: doc.id,
            selectedTopic: session.topic,
            primaryTopic: analysis.primaryTopic,
            coveredTopics: analysis.coveredTopics,
            confidence: analysis.confidence,
            coversSelected: analysis.coversSelected,
            evidence: analysis.evidence,
          },
        })

        validations.push({
          documentId: doc.id,
          coversSelected: analysis.coversSelected,
          primaryTopic: analysis.primaryTopic,
          confidence: analysis.confidence,
          evidence: analysis.evidence,
        })

        // Do not add unrelated documents to the RAG index.
        if (!analysis.coversSelected) {
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

        // Append covered topics to chunk metadata (optional for RAG boosts)
        const metadataExtra = { coveredTopics: analysis.coveredTopics }

        // Store in vector database
        const chunksWithEmbeddings = chunks.map((chunk, i) => ({
          content: chunk.content,
          embedding: embeddings[i],
          documentId: doc.id,
          metadata: {
            ...chunk.metadata,
            sessionId,
            fileName: doc.fileName,
            ...metadataExtra,
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
        const message = error instanceof Error ? error.message : 'Unknown processing error'
        processingErrors.push(`Could not validate ${doc.fileName}: ${message}`)
      }
    }

    if (processingErrors.length > 0 || validations.length !== documents.length) {
      return Response.json(
        {
          error: processingErrors[0] || 'Could not validate the uploaded PDF.',
          relevant: false,
          validations,
        },
        { status: 422 }
      )
    }

    const invalidDocument = validations.find((validation) => !validation.coversSelected)

    return Response.json({
      success: true,
      relevant: !invalidDocument,
      validations,
    })
  } catch (error) {
    console.error('Document processing failed:', error)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
