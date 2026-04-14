import { PDFParse, VerbosityLevel } from 'pdf-parse'

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  const pdfData = new Uint8Array(buffer)
  const parser = new PDFParse({
    data: pdfData,
    verbosity: VerbosityLevel.ERRORS,
  })

  const result = await parser.getText()

  let text = result.text

  // Clean and normalize text
  // Remove excessive whitespace
  text = text.replace(/\s+/g, ' ')

  // Remove page numbers and headers/footers patterns
  text = text.replace(/\n\d+\n/g, '\n')

  // Normalize line breaks
  text = text.replace(/\n{3,}/g, '\n\n')

  await parser.destroy()

  return text.trim()
}

