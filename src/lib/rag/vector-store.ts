import { createClient } from '@supabase/supabase-js'
import { generateQueryEmbedding } from './embeddings'

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/**
 * Store document chunk embeddings in pgvector via Supabase
 */
export async function storeEmbeddings(
  chunks: { content: string; embedding: number[]; documentId: string; metadata: Record<string, unknown> }[]
): Promise<void> {
  // Attempt native bulk insert first (much faster)
  const formattedChunks = chunks.map((chunk) => ({
    document_id: chunk.documentId,
    content: chunk.content,
    embedding: chunk.embedding,
    metadata: chunk.metadata,
  }))

  const { error } = await getSupabaseAdmin()
    .from('document_chunks')
    .insert(formattedChunks)

  if (error) {
    console.error('Bulk insert failed, falling back to concurrent RPC:', error)
    
    // Process in batches of 50 to avoid connection pooling limits
    const batchSize = 50
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      await Promise.all(
        batch.map((chunk) =>
          getSupabaseAdmin().rpc('insert_document_chunk', {
            p_document_id: chunk.documentId,
            p_content: chunk.content,
            p_embedding: chunk.embedding,
            p_metadata: chunk.metadata,
          })
        )
      )
    }
  }
}

/**
 * Perform similarity search against stored document chunks
 * Returns top-k most relevant chunks for a given query
 */
export async function searchSimilarChunks(
  query: string,
  sessionId: string,
  topK: number = 5
): Promise<{ content: string; similarity: number }[]> {
  try {
    const queryEmbedding = await generateQueryEmbedding(query)

    const { data, error } = await getSupabaseAdmin().rpc('match_document_chunks', {
      query_embedding: queryEmbedding,
      match_count: topK,
      p_session_id: sessionId,
    })

    if (error) {
      console.error('Vector search error:', error)
      return []
    }

    // Filter out chunks with low similarity to prevent random noise
    // Retrieve IDs of documents with valid coverage for this session
    const { data: validDocs } = await getSupabaseAdmin()
      .from('session_document_validation')
      .select('document_id')
      .eq('session_id', sessionId)
      .eq('covers_selected', true)
    const validDocIds = (validDocs || []).map((row: any) => row.document_id)

    // Filter chunks to only those belonging to valid documents
    const filteredData = (data || []).filter((row: any) =>
      row.similarity >= 0.6 && validDocIds.includes(row.document_id)
    )

    return filteredData.map((row: { content: string; similarity: number }) => ({
      content: row.content,
      similarity: row.similarity,
    }))
  } catch (error) {
    console.error('Search failed:', error)
    return []
  }
}
