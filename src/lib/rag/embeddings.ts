const HF_API_URL = 'https://router.huggingface.co/hf-inference/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2/pipeline/feature-extraction'

/**
 * Generate multilingual embeddings using Hugging Face Inference API.
 * Produces 384-dimensional vectors
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.HUGGINGFACE_API_KEY
  if (!apiKey) {
    throw new Error('HUGGINGFACE_API_KEY is not set')
  }

  // Process in batches of 16 to avoid API limits
  const batchSize = 16
  const allEmbeddings: number[][] = []

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)

    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: batch,
        options: {
          wait_for_model: true,
        },
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`Hugging Face API error: ${response.status} - ${error}`)
    }

    const embeddings = await response.json() as number[][]
    allEmbeddings.push(...embeddings)
  }

  return allEmbeddings
}

/**
 * Generate a single embedding for a query string
 */
export async function generateQueryEmbedding(query: string): Promise<number[]> {
  const [embedding] = await generateEmbeddings([query])
  return embedding
}
