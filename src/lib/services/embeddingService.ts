import { HfInference } from '@huggingface/inference';

/**
 * Compute sentence embeddings for an array of texts using a multilingual model.
 * Uses the model specified by EMBEDDING_MODEL env var or defaults to
 * paraphrase-multilingual-MiniLM-L12-v2.
 */
export async function computeEmbeddings(texts: string[]): Promise<number[][]> {
  const model = process.env.EMBEDDING_MODEL || 'sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2';
  const hf = new HfInference();
  const result = await hf.featureExtraction({
    model,
    inputs: texts,
  });
  // Ensure the result is an array of number arrays
  if (Array.isArray(result) && result.length && typeof result[0] === 'number') {
    return [result as number[]];
  }
  return result as number[][];
}
