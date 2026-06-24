import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export function exportExcel(
  filename: string,
  sheets: { name: string; rows: Record<string, unknown>[] }[],
) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows.length ? s.rows : [{}])
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  XLSX.writeFile(wb, `${filename}.xlsx`)
}

export function exportPdf(
  title: string,
  blocks: { heading?: string; head: string[]; body: (string | number)[][] }[],
  filename = title,
) {
  const doc = new jsPDF()
  doc.setFontSize(14)
  doc.text(title, 14, 16)
  doc.setFontSize(9)
  doc.text('Sistem Pengurusan Kokurikulum SK Darau', 14, 22)
  let y = 28
  for (const b of blocks) {
    if (b.heading) {
      doc.setFontSize(11)
      doc.text(b.heading, 14, y)
      y += 4
    }
    autoTable(doc, {
      head: [b.head],
      body: b.body,
      startY: y,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [94, 53, 177] },
    })
    // @ts-expect-error lastAutoTable is added by the plugin at runtime
    y = (doc.lastAutoTable?.finalY ?? y) + 10
  }
  doc.save(`${filename}.pdf`)
}
