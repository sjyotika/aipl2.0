export const INTERVIEW_MODES = ['normal', 'technical', 'managerial', 'hr'] as const

export type InterviewMode = (typeof INTERVIEW_MODES)[number]

export const INTERVIEW_MODE_DETAILS: Record<
  InterviewMode,
  { label: string; description: string; focus: string }
> = {
  normal: {
    label: 'Normal',
    description: 'Learn by teaching with a curious AI peer.',
    focus: 'clear explanations, understanding, and discovering knowledge gaps',
  },
  technical: {
    label: 'Technical',
    description: 'Test technical depth, problem-solving, and accuracy.',
    focus: 'technical knowledge, trade-offs, debugging, and structured problem-solving',
  },
  managerial: {
    label: 'Managerial',
    description: 'Practice leadership, prioritization, and decision-making.',
    focus: 'leadership, prioritization, ownership, communication, and measurable outcomes',
  },
  hr: {
    label: 'HR',
    description: 'Prepare for behavioral and culture-fit questions.',
    focus: 'behavioral examples, motivation, collaboration, adaptability, and culture fit',
  },
}

export function isInterviewMode(value: unknown): value is InterviewMode {
  return typeof value === 'string' && INTERVIEW_MODES.includes(value as InterviewMode)
}
