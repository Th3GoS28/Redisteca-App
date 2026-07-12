import jsPDF from 'jspdf'

interface QuotePdfData {
  quote_number: string
  client_name: string
  client_rif?: string | null
  valid_until?: string | null
  created_at: string
  items: { description: string; quantity: number; unit_price: number; subtotal: number }[]
  total: number
  notes?: string | null
}

export function generateQuotePdf(data: QuotePdfData) {
  const doc = new jsPDF({ unit: 'mm', format: 'letter' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 15
  let y = 20

  // Encabezado con la identidad de Redisteca
  doc.setFillColor(28, 63, 115) // #1c3f73
  doc.rect(0, 0, pageWidth, 30, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(18)
  doc.setFont('helvetica', 'bold')
  doc.text('REDISTECA', margin, 15)
  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.text('Instrumentación & Automatización · Festo | Rosemount | Schneider | KSB', margin, 21)
  doc.text('Maracaibo, Venezuela · info@redisteca.com', margin, 26)

  y = 40
  doc.setTextColor(0, 0, 0)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`Cotización ${data.quote_number}`, margin, y)

  y += 8
  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(`Cliente: ${data.client_name}`, margin, y)
  if (data.client_rif) {
    y += 5
    doc.text(`RIF: ${data.client_rif}`, margin, y)
  }
  y += 5
  doc.text(`Fecha: ${new Date(data.created_at).toLocaleDateString()}`, margin, y)
  if (data.valid_until) {
    y += 5
    doc.text(`Válida hasta: ${data.valid_until}`, margin, y)
  }

  y += 10
  // Tabla de productos
  doc.setFillColor(240, 240, 240)
  doc.rect(margin, y, pageWidth - margin * 2, 7, 'F')
  doc.setFont('helvetica', 'bold')
  doc.text('Descripción', margin + 2, y + 5)
  doc.text('Cant.', pageWidth - 85, y + 5)
  doc.text('P. Unit.', pageWidth - 60, y + 5)
  doc.text('Subtotal', pageWidth - 30, y + 5)
  y += 10

  doc.setFont('helvetica', 'normal')
  for (const item of data.items) {
    const lines = doc.splitTextToSize(item.description, pageWidth - margin * 2 - 90)
    doc.text(lines, margin + 2, y)
    doc.text(String(item.quantity), pageWidth - 85, y)
    doc.text(`$${item.unit_price.toFixed(2)}`, pageWidth - 60, y)
    doc.text(`$${item.subtotal.toFixed(2)}`, pageWidth - 30, y)
    y += Math.max(6, lines.length * 5)

    if (y > 260) {
      doc.addPage()
      y = 20
    }
  }

  y += 4
  doc.setDrawColor(200, 200, 200)
  doc.line(margin, y, pageWidth - margin, y)
  y += 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text(`Total: $${data.total.toFixed(2)}`, pageWidth - margin, y, { align: 'right' })

  if (data.notes) {
    y += 10
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    const noteLines = doc.splitTextToSize(`Notas: ${data.notes}`, pageWidth - margin * 2)
    doc.text(noteLines, margin, y)
  }

  doc.save(`${data.quote_number}.pdf`)
}
