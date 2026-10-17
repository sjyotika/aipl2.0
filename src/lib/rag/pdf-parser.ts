import { PDFParse, VerbosityLevel } from 'pdf-parse'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

let workerConfigured = false

function configurePdfWorker() {
  if (!workerConfigured) {
    const workerPath = path.join(
      process.cwd(),
      'node_modules',
      'pdf-parse',
      'dist',
      'worker',
      'pdf.worker.mjs'
    )
    PDFParse.setWorker(pathToFileURL(workerPath).href)
    workerConfigured = true
  }
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  configurePdfWorker()

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
