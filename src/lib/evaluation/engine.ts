import { prisma } from '@/lib/db'
import { generateWithFallback } from '@/lib/ai/provider'
import { describeImage } from '@/lib/services/visionService'
import { EvaluationReportSchema, type EvaluationReport } from './schema'

const EVALUATION_PROMPT = `You are an expert educational evaluator. Analyze the following teaching session where a student attempted to explain a topic to a peer.

Evaluate meaning independently of the language used. Missing concepts are gaps, not misconceptions. A misconception requires an actively stated incorrect claim. Use attached images as additional evidence. Respond in {language}; retain technical terms in English when clearer. Score strictly — be honest but constructive.

You MUST respond with ONLY a valid JSON object matching this exact schema:

{
  "accuracy_score": <number 0-100>,
  "coverage_score": <number 0-100>,
  "conceptual_gaps": [<string descriptions of concepts the student missed or didn't address>],
  "misconceptions": [{"misconception": "<what they got wrong>", "correction": "<what's actually correct>"}],
  "common_topic_misconceptions": [{"misconception": "<a common misconception about this topic>", "correction": "<the correct understanding>"}],
  "improvement_suggestions": [<specific actionable suggestions>],
  "confidence_flag": <boolean - true if the student showed confidence, false if they seemed unsure>,
  "session_narrative": "<2-3 sentence narrative describing how the student's explanation evolved during the session>"
}

SCORING GUIDELINES:
- 90-100: Expert-level explanation with depth and nuance
- 70-89: Good understanding with minor gaps
- 50-69: Basic understanding but significant gaps
- 30-49: Partial understanding with major misconceptions
- 0-29: Little to no demonstrated understanding

Topic: {topic}

Session conversation:
{conversation}

Remember: Respond with ONLY the JSON object, no markdown, no code fences, no explanation.`

/**
 * Run the evaluation engine on a completed session
 */
export async function evaluateSession(sessionId: string, options?: { language?: string; imageUrl?: string }): Promise<EvaluationReport> {
  // Fetch session and messages
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      messages: {
        orderBy: { turnNumber: 'asc' },
      },
    },
  })

  if (!session) {
    throw new Error('Session not found')
  }

  const language = options?.language || session.language || 'en'
  const languageInfo = `Selected response language: ${language}`
  const imageInfo = options?.imageUrl || session.imageUrl ? 'An image was attached as additional evidence.' : ''
  let imageDescription = ''
  if (options?.imageUrl || session.imageUrl) {
    try {
      imageDescription = await describeImage(options?.imageUrl || session.imageUrl || '', 'Analyze this educational diagram as evidence. Identify visible structures, labels, relationships, and contradictions a student explanation might make. Do not merely caption it.')
    } catch {
      imageDescription = 'Image analysis failed; evaluate the available text normally.'
    }
  }
  const conversation = [languageInfo, imageInfo, imageDescription].filter(Boolean).join('\n') + (languageInfo || imageInfo || imageDescription ? '\n\n' : '') + session.messages
    .map((m) => {
      const modeStr = m.mode ? ` [${m.mode}]` : '';
      return `${m.role.toUpperCase()}${modeStr}: ${m.content}`;
    })
    .join('\n\n');

  // Fetch validated reference chunks for this session (only from documents with coversSelected = true)
  const validDocs = await prisma.sessionDocumentValidation.findMany({
    where: { sessionId, coversSelected: true },
    select: { documentId: true },
  })
  const validDocIds = validDocs.map(v => v.documentId)

  // Pull a limited number of chunks from those documents (e.g., first 10)
  const referenceChunks = await prisma.documentChunk.findMany({
    where: { documentId: { in: validDocIds } },
    take: 10,
    select: { content: true },
  })
  const referenceText = referenceChunks.map(c => c.content).join('\n')

  // Extend the prompt with reference context and request additional fields
  const extendedPrompt = `${EVALUATION_PROMPT}\n\nReference content (for alignment check):\n${referenceText}\n\nAdditionally, include in the JSON output the fields:\n- answer_topic: main topic of the student's answer\n- reference_alignment: true if the answer aligns with the reference content, false otherwise`;

  const prompt = extendedPrompt
    .replace('{topic}', session.topic)
    .replace('{conversation}', conversation)
    .replace('{language}', language);

  const result = await generateWithFallback({
    system: 'You are a JSON-only evaluator. Output ONLY valid JSON, no markdown fences or extra text.',
    prompt,
    maxOutputTokens: 2048,
  })

  // Parse and validate
  let parsed: unknown
  try {
    // Clean response — remove markdown fences if present
    let cleaned = result.trim()
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```json?\n?/, '').replace(/\n?```$/, '')
    }
    parsed = JSON.parse(cleaned)
  } catch {
    console.error('Failed to parse evaluation JSON:', result)
    throw new Error('Evaluation produced invalid JSON')
  }

  // Enrich parsed data with additional computed fields
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>
    // Mode transitions
    obj.mode_transitions = session.messages
      .filter((message) => message.mode)
      .map((message) => ({ turn: message.turnNumber, mode: message.mode! }))
    
    // Deterministic final score: 60% accuracy, 40% coverage
    const accuracy = typeof obj.accuracy_score === 'number' ? obj.accuracy_score : 0
    const coverage = typeof obj.coverage_score === 'number' ? obj.coverage_score : 0
    obj.overall_score = Math.round((accuracy * 0.6) + (coverage * 0.4))

    // Fetch validation row for this session/document (assume one document per session for simplicity)
    const validation = await prisma.sessionDocumentValidation.findFirst({
      where: { sessionId },
    })
    const referenceValid = validation?.coversSelected ?? false
    obj.reference_valid = referenceValid

    // Determine answer_topic_match conceptually (simple normalized inclusion as fallback)
    const answerTopic = typeof obj.answer_topic === 'string' ? obj.answer_topic.toLowerCase() : ''
    const sessionTopic = session.topic.toString().toLowerCase()
    const match = answerTopic.includes(sessionTopic) || sessionTopic.includes(answerTopic)
    obj.answer_topic_match = match

    // Preserve factual_correctness separate from reference checks (use accuracy_score)
    obj.factual_correctness = accuracy

    // If reference is invalid, nullify final_score and add explanatory message
    if (!referenceValid) {
      obj.final_score = null
      obj.message = 'Reference does not adequately cover the selected topic; please upload a more relevant document.'
    } else {
      // When reference is valid, final_score equals overall_score
      obj.final_score = obj.overall_score
    }
  }

  // Validate with Zod
  const validated = EvaluationReportSchema.parse(parsed)

  return validated
}
