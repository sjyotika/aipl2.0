import { pipeline } from '@huggingface/transformers'

const HF_API_URL = 'https://router.huggingface.co/hf-inference/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/pipeline/feature-extraction'
const LOCAL_MODEL = 'Xenova/paraphrase-multilingual-MiniLM-L12-v2'
const EMBEDDING_DIMENSIONS = 384

type EmbeddingPipeline = Awaited<ReturnType<typeof pipeline>>

let localPipeline: Promise<EmbeddingPipeline> | undefined

function validateEmbeddings(embeddings: number[][]): number[][] {
  if (embeddings.length === 0 || embeddings.some((embedding) => embedding.length !== EMBEDDING_DIMENSIONS)) {
    throw new Error(`Embedding provider returned vectors that are not ${EMBEDDING_DIMENSIONS}-dimensional`)
  }

  return embeddings
}

async function generateLocalEmbeddings(texts: string[]): Promise<number[][]> {
  localPipeline ??= pipeline('feature-extraction', process.env.EMBEDDING_MODEL || LOCAL_MODEL)
  const extractor = await localPipeline as unknown as (
    inputs: string[],
    options: { pooling: 'mean'; normalize: true }
  ) => Promise<{ tolist(): number[][] }>
  const output = await extractor(texts, { pooling: 'mean', normalize: true })
  return validateEmbeddings(output.tolist() as number[][])
}

async function generateHostedEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not set')
  }

  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += 16) {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: texts.slice(i, i + 16),
        options: { wait_for_model: true },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Hugging Face API error: ${response.status} - ${error}`)
    }

    allEmbeddings.push(...(await response.json() as number[][]))
  }

  return validateEmbeddings(allEmbeddings)
}

/**
 * Generate multilingual embeddings using local Transformers.js by default.
 * Set EMBEDDING_PROVIDER=huggingface to use the hosted API instead.
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  return process.env.EMBEDDING_PROVIDER === 'huggingface'
    ? generateHostedEmbeddings(texts)
    : generateLocalEmbeddings(texts)
}

/**
 * Generate a single embedding for a query string
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([query])
  return embedding
}
