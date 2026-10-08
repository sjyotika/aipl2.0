import { generateWithFallback } from '@/lib/ai/provider'

/**
 * Analyze PDF document content and determine relevance to the selected session topic.
 * Returns a JSON object with primaryTopic, coveredTopics, confidence, evidence, coversSelected.
 */
export async function analyzeDocumentContent(text: string, selectedTopic: string) {
  const truncated = text.slice(0, 2000) // limit size for LLM prompt
  const prompt = `You are analyzing a PDF document that will be used as a reference for an interview session.
The session's selected topic is "${selectedTopic}".
From the full document text, produce a JSON object with the following fields:
- primaryTopic: a concise short title summarizing the main subject of the document.
- coveredTopics: an array of key concepts covered in the document (strings).
- confidence: a float between 0 and 1 indicating how comprehensively the document covers the selected topic.
- evidence: a short 1‑2 sentence justification for the confidence score.
- coversSelected: boolean, true if the confidence is >= 0.6 (i.e., the document sufficiently covers the selected topic).
Only output the JSON with no additional text.
Document text (truncated to first 2000 characters):
"${truncated}"
`
  const raw = await generateWithFallback(prompt, { model: 'gemini-pro' })
  try {
    const parsed = JSON.parse(raw)
    return parsed
  } catch (e) {
    console.error('Failed to parse document analysis JSON', e)
    throw e
  }
}
