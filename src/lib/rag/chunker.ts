export interface TextChunk {
  content: string
  metadata: {
    chunkIndex: number
    startChar: number
    endChar: number
  }
}

/**
 * Split text into overlapping chunks using a recursive character splitter approach.
 * Uses sentence boundaries for natural splits when possible.
 */
export function chunkText(
  text: string,
  chunkSize: number = 500,
  chunkOverlap: number = 50
): TextChunk[] {
  if (!text || text.trim().length === 0) {
    return []
  }

  const chunks: TextChunk[] = []
  const separators = ['\n\n', '\n', '. ', '! ', '? ', '; ', ', ', ' ']

  function splitRecursive(text: string, seps: string[]): string[] {
    if (text.length <= chunkSize) {
      return [text]
    }

    // Try each separator
    for (const sep of seps) {
      if (text.includes(sep)) {
        const parts = text.split(sep)
        const result: string[] = []
        let current = ''

        for (const part of parts) {
          const candidate = current ? current + sep + part : part

          if (candidate.length > chunkSize && current) {
            result.push(current)
            current = part
          } else {
            current = candidate
          }
        }

        if (current) {
          result.push(current)
        }

        return result
      }
    }

    // Fallback: hard split
    const result: string[] = []
    for (let i = 0; i < text.length; i += chunkSize - chunkOverlap) {
      result.push(text.slice(i, i + chunkSize))
    }
    return result
  }

  const rawChunks = splitRecursive(text, separators)
  let charOffset = 0

  for (let i = 0; i < rawChunks.length; i++) {
    const content = rawChunks[i].trim()
    if (content.length > 0) {
      const startChar = text.indexOf(content, charOffset)
      chunks.push({
        content,
        metadata: {
          chunkIndex: chunks.length,
          startChar: startChar >= 0 ? startChar : charOffset,
          endChar: (startChar >= 0 ? startChar : charOffset) + content.length,
        },
      })
      charOffset = startChar >= 0 ? startChar + content.length : charOffset + content.length
    }
  }

  return chunks
}
