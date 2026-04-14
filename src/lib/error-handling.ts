/**
 * Global error handling utilities
 */

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class AuthError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'AUTH_ERROR')
    this.name = 'AuthError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400, 'VALIDATION_ERROR')
    this.name = 'ValidationError'
  }
}

export class RateLimitError extends AppError {
  constructor() {
    super('Rate limit exceeded. Please try again later.', 429, 'RATE_LIMIT')
    this.name = 'RateLimitError'
  }
}

/**
 * Safely handle API route errors and return appropriate Response
 */
export function handleApiError(error: unknown): Response {
  console.error('API Error:', error)

  if (error instanceof AppError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.statusCode }
    )
  }

  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('rate limit') || error.message.includes('429')) {
      return Response.json(
        { error: 'Rate limit exceeded. Please wait a moment and try again.', code: 'RATE_LIMIT' },
        { status: 429 }
      )
    }

    if (error.message.includes('timeout') || error.message.includes('ETIMEDOUT')) {
      return Response.json(
        { error: 'Request timed out. Please try again.', code: 'TIMEOUT' },
        { status: 504 }
      )
    }
  }

  return Response.json(
    { error: 'An unexpected error occurred', code: 'INTERNAL_ERROR' },
    { status: 500 }
  )
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt)
        await new Promise((resolve) => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError || new Error('Retry failed')
}
