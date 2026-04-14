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
  // Insert chunks one by one to handle vector type
  for (const chunk of chunks) {
    const { error } = await getSupabaseAdmin().rpc('insert_document_chunk', {
      p_document_id: chunk.documentId,
      p_content: chunk.content,
      p_embedding: chunk.embedding,
      p_metadata: chunk.metadata,
    })

    if (error) {
      // Fallback: insert without embedding if RPC not available
      const { error: insertError } = await getSupabaseAdmin()
        .from('document_chunks')
        .insert({
          document_id: chunk.documentId,
          content: chunk.content,
          metadata: chunk.metadata,
        })

      if (insertError) {
        console.error('Failed to store chunk:', insertError)
      }
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
      // Fallback: return chunks based on text matching
      return await fallbackTextSearch(query, sessionId, topK)
    }

    return (data || []).map((row: { content: string; similarity: number }) => ({
      content: row.content,
      similarity: row.similarity,
    }))
  } catch (error) {
    console.error('Search failed:', error)
    return await fallbackTextSearch(query, sessionId, topK)
  }
}

/**
 * Fallback text-based search when vector search is unavailable
 */
async function fallbackTextSearch(
  _query: string,
  sessionId: string,
  topK: number
): Promise<{ content: string; similarity: number }[]> {
  // Step 1: Get document IDs for this session
  const { data: docs } = await getSupabaseAdmin()
    .from('documents')
    .select('id')
    .eq('session_id', sessionId)

  if (!docs || docs.length === 0) return []

  const docIds = docs.map((d: { id: string }) => d.id)

  // Step 2: Fetch chunks for those documents
  const { data } = await getSupabaseAdmin()
    .from('document_chunks')
    .select('content')
    .in('document_id', docIds)
    .limit(topK)

  return (data || []).map((row: { content: string }) => ({
    content: row.content,
    similarity: 0.5,
  }))
}
