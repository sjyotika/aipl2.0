import DOMMatrix from '@thednp/dommatrix'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

type TextItem = { str: string }

function normalizeText(text: string): string {
  text = text.replace(/\s+/g, ' ')
  text = text.replace(/\n\d+\n/g, '\n')
  text = text.replace(/\n{3,}/g, '\n\n')
  return text.trim()
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  globalThis.DOMMatrix ??= DOMMatrix as unknown as typeof globalThis.DOMMatrix
  const { getDocument, GlobalWorkerOptions } = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const workerPath = path.join(
    process.cwd(),
    'node_modules',
    'pdfjs-dist',
    'legacy',
    'build',
    'pdf.worker.mjs'
  )
  GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href
  const document = await getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise
  const pages: string[] = []

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push((content.items as TextItem[]).map((item) => item.str).join(' '))
  }

  return normalizeText(pages.join('\n'))
}
