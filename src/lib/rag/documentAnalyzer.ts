import { generateWithFallback } from '@/lib/ai/provider'

const TOPIC_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'of',
  'on',
  'the',
  'to',
  'with',
])

function normalizeTopicTerms(topic: string) {
  return topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .map((term) => term.replace(/ies$/, 'y').replace(/s$/, ''))
    .filter((term) => term.length > 2 && !TOPIC_STOP_WORDS.has(term))
}

function hasExplicitTopicCoverage(text: string, selectedTopic: string) {
  const topicTerms = normalizeTopicTerms(selectedTopic)
  if (topicTerms.length === 0) return true

  const documentTerms = new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .map((term) => term.replace(/ies$/, 'y').replace(/s$/, ''))
  )

  return topicTerms.every((term) => documentTerms.has(term))
}

function parseAnalysisJson(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    return JSON.parse(cleaned)
  } catch {
    const objectStart = cleaned.indexOf('{')
    const objectEnd = cleaned.lastIndexOf('}')

    if (objectStart >= 0 && objectEnd > objectStart) {
      return JSON.parse(cleaned.slice(objectStart, objectEnd + 1))
    }

    throw new Error('The AI returned invalid document analysis JSON.')
  }
}

/**
 * Analyze PDF document content and determine relevance to the selected session topic.
 * Returns a JSON object with primaryTopic, coveredTopics, confidence, evidence, coversSelected.
 */
export async function analyzeDocumentContent(text: string, selectedTopic: string) {
  const truncated = text.slice(0, 2000) // limit size for LLM prompt
  const prompt = `You are analyzing a PDF document that will be used as a reference for an interview session.
The session's selected topic is "${selectedTopic}".
From the full document text, produce a JSON object with the following fields.
Be strict: the document must explicitly teach the selected topic, not merely mention
a related algorithm, application, or broader subject. For example, a document about
binary search is not relevant to the topic "trees" unless it explicitly teaches trees.
- primaryTopic: a concise short title summarizing the main subject of the document.
- coveredTopics: an array of key concepts covered in the document (strings).
- confidence: a float between 0 and 1 indicating how comprehensively the document covers the selected topic.
- evidence: a short 1‑2 sentence justification for the confidence score.
- coversSelected: boolean, true if the confidence is >= 0.6 (i.e., the document sufficiently covers the selected topic).
Only output the JSON with no additional text.
Document text (truncated to first 2000 characters):
"${truncated}"
`
  const raw = await generateWithFallback({
    system: 'You are a JSON-only document relevance analyzer. Output only valid JSON.',
    prompt,
    maxOutputTokens: 1024,
  })
  try {
    const parsed = parseAnalysisJson(raw)
    const explicitCoverage = hasExplicitTopicCoverage(text, selectedTopic)

    return {
      ...parsed,
      coversSelected: Boolean(parsed.coversSelected && explicitCoverage),
      evidence: explicitCoverage
        ? parsed.evidence
        : `The document does not explicitly cover all the key terms in "${selectedTopic}".`,
    }
  } catch (e) {
    console.error('Failed to parse document analysis JSON', e)
    throw e
  }
}
