import { generateEmbeddings } from '@/lib/rag/embeddings'

/**
 * Compute sentence embeddings for an array of texts using a multilingual model.
 * Uses the model specified by EMBEDDING_MODEL env var or defaults to
 * paraphrase-multilingual-MiniLM-L12-v2.
 */
export async function computeEmbeddings(texts: string[]): Promise<number[][]> {
  return generateEmbeddings(texts)
}
