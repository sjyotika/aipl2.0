import { prisma } from '@/lib/db'
import { generateWithFallback } from '@/lib/ai/provider'
import { EvaluationReportSchema, type EvaluationReport } from './schema'

const EVALUATION_PROMPT = `You are an expert educational evaluator. Analyze the following teaching session where a student attempted to explain a topic to a peer.

Evaluate the student's understanding based ONLY on what they said. Score strictly — be honest but constructive.

You MUST respond with ONLY a valid JSON object matching this exact schema:

{
  "accuracy_score": <number 0-100>,
  "coverage_score": <number 0-100>,
  "conceptual_gaps": [<string descriptions of concepts the student missed or didn't address>],
  "misconceptions": [{"misconception": "<what they got wrong>", "correction": "<what's actually correct>"}],
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
export async function evaluateSession(sessionId: string): Promise<EvaluationReport> {
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

  // Build conversation transcript
  const conversation = session.messages
    .map((m) => {
      const modeStr = m.mode ? ` [${m.mode}]` : ''
      return `${m.role.toUpperCase()}${modeStr}: ${m.content}`
    })
    .join('\n\n')

  // Build mode transitions from actual message data
  const modeTransitions = session.messages
    .filter((m) => m.mode !== null)
    .map((m) => ({
      turn: m.turnNumber,
      mode: m.mode as 'understanding' | 'socratic',
    }))

  // Generate evaluation
  const prompt = EVALUATION_PROMPT
    .replace('{topic}', session.topic)
    .replace('{conversation}', conversation)

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
  } catch (e) {
    console.error('Failed to parse evaluation JSON:', result)
    throw new Error('Evaluation produced invalid JSON')
  }

  // Inject deterministic overall score and actual mode transitions
  if (typeof parsed === 'object' && parsed !== null) {
    const obj = parsed as Record<string, unknown>
    obj.mode_transitions = modeTransitions
    
    // Deterministic final score: 60% accuracy, 40% coverage
    const accuracy = typeof obj.accuracy_score === 'number' ? obj.accuracy_score : 0
    const coverage = typeof obj.coverage_score === 'number' ? obj.coverage_score : 0
    obj.overall_score = Math.round((accuracy * 0.6) + (coverage * 0.4))
  }

  // Validate with Zod
  const validated = EvaluationReportSchema.parse(parsed)

  return validated
}
