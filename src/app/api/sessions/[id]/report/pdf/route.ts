import { prisma } from '@/lib/db'
import { createClient } from '@/lib/supabase/server'
import { EvaluationReportSchema } from '@/lib/evaluation/schema'
import PDFDocument from 'pdfkit'

export const runtime = 'nodejs'

function addBulletList(document: PDFKit.PDFDocument, items: string[]) {
  if (items.length === 0) {
    document.fontSize(10).fillColor('#666666').text('None identified.')
    return
  }

  for (const item of items) {
    document.fontSize(10).fillColor('#222222').text(`• ${item}`, {
      indent: 12,
      paragraphGap: 5,
    })
  }
}

function addMisconceptions(
  document: PDFKit.PDFDocument,
  items: Array<{ misconception: string; correction: string }>
) {
  if (items.length === 0) {
    document.fontSize(10).fillColor('#666666').text('None identified.')
    return
  }

  for (const item of items) {
    document.fontSize(10).fillColor('#a12622').text(`Incorrect or risky idea: ${item.misconception}`, {
      paragraphGap: 2,
    })
    document.fontSize(10).fillColor('#176b3a').text(`Correct understanding: ${item.correction}`, {
      paragraphGap: 8,
    })
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const session = await prisma.session.findFirst({
    where: { id, userId: user.id },
    select: { topic: true, evaluationReport: true },
  })

  if (!session || !session.evaluationReport) {
    return Response.json({ error: 'Session report not found' }, { status: 404 })
  }

  const parsedReport = EvaluationReportSchema.safeParse(session.evaluationReport)
  if (!parsedReport.success) {
    return Response.json({ error: 'Session report is not ready' }, { status: 409 })
  }

  const report = parsedReport.data
  const document = new PDFDocument({ margin: 54, size: 'A4' })
  const chunks: Buffer[] = []
  document.on('data', (chunk: Buffer) => chunks.push(chunk))

  const pdfReady = new Promise<Buffer>((resolve, reject) => {
    document.on('end', () => resolve(Buffer.concat(chunks)))
    document.on('error', reject)
  })

  document.fontSize(22).fillColor('#172554').text('Session Learning Report')
  document.moveDown(0.3)
  document.fontSize(13).fillColor('#444444').text(`Topic: ${session.topic}`)
  document.moveDown(1)

  document.fontSize(15).fillColor('#172554').text('Session-specific results')
  document.moveDown(0.3)
  document.fontSize(11).fillColor('#222222')
    .text(`Overall score: ${report.overall_score}%`)
    .text(`Accuracy: ${report.accuracy_score}%`)
    .text(`Coverage: ${report.coverage_score}%`)
  document.moveDown(0.8)

  document.fontSize(15).fillColor('#172554').text('Errors and conceptual gaps')
  document.moveDown(0.3)
  addBulletList(document, report.conceptual_gaps)
  document.moveDown(0.8)

  document.fontSize(15).fillColor('#172554').text('Session-specific misconceptions')
  document.moveDown(0.3)
  addMisconceptions(document, report.misconceptions)
  document.moveDown(0.8)

  document.fontSize(15).fillColor('#172554').text('Common misconceptions about this topic')
  document.moveDown(0.3)
  addMisconceptions(document, report.common_topic_misconceptions)
  document.moveDown(0.8)

  document.fontSize(15).fillColor('#172554').text('Recommended improvements')
  document.moveDown(0.3)
  addBulletList(document, report.improvement_suggestions)

  document.end()
  const pdf = await pdfReady

  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="session-report-${id}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
