import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import jsPDF from 'jspdf'
import { Field, PageHeader } from '../components/ui'
import { useSettings } from '../lib/settings'
import { useToast } from '../lib/toast'
import { OprData, OPR_W, OPR_H, drawOpr, loadOprFonts } from '../lib/opr'

type Img = ImageBitmap | null

const today = () => new Date().toLocaleDateString('en-CA') // YYYY-MM-DD waktu tempatan

// ponytail: OPR tak disimpan dalam DB — guru muat turun & muat naik ke Drive.
// Simpan ke jadual activities kalau nanti mahu OPR muncul dalam Takwim / Laporan Unit.
export function OprPage() {
  const { settings } = useSettings()
  const toast = useToast()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [fontsReady, setFontsReady] = useState(false)
  const [photos, setPhotos] = useState<Img[]>([null, null, null])
  const [f, setF] = useState<Omit<OprData, 'school'>>({
    nama: '',
    tarikh: today(),
    masa: '',
    tempat: '',
    kehadiran: '',
    aktiviti: '',
    objektif: '',
    impak: 'Penglibatan yang sangat memberangsangkan dengan kerjasama yang baik oleh semua pihak',
  })
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value })

  const s = settings.school
  const school = [s.name, s.daerah, s.negeri].filter(Boolean).join(', ').toUpperCase()

  useEffect(() => {
    loadOprFonts().finally(() => setFontsReady(true))
  }, [])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (ctx && fontsReady) drawOpr(ctx, { ...f, school }, photos)
  }, [f, photos, school, fontsReady])

  async function pickPhoto(i: number, file?: File) {
    if (!file) return
    try {
      const bmp = await createImageBitmap(file)
      setPhotos((p) => p.map((old, j) => (j === i ? bmp : old)))
    } catch {
      toast('Gambar tak dapat dibaca. Cuba format JPG/PNG.', 'err')
    }
  }

  const filename = () => `OPR_${(f.nama || 'Program').replace(/[^\w]+/g, '_')}_${f.tarikh}`

  function downloadPdf() {
    const c = canvasRef.current
    if (!c) return
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    doc.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297)
    doc.save(`${filename()}.pdf`)
  }

  function downloadJpg() {
    canvasRef.current?.toBlob((b) => {
      if (!b) return
      const a = document.createElement('a')
      a.href = URL.createObjectURL(b)
      a.download = `${filename()}.jpg`
      a.click()
      URL.revokeObjectURL(a.href)
    }, 'image/jpeg', 0.9)
  }

  return (
    <>
      <PageHeader title="📝 Jana OPR" sub="One Page Report — isi borang, gambar, terus muat turun" />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        <div className="panel">
          <div className="panel-head ph-indigo"><span className="ph-icon">✏️</span> Maklumat Program</div>
          <div className="panel-body">
            <Field label="Nama Program"><input value={f.nama} onChange={set('nama')} placeholder="cth: Majlis Bacaan Yaasin" /></Field>
            <Field label="Tarikh"><input type="date" value={f.tarikh} onChange={set('tarikh')} /></Field>
            <Field label="Masa (pilihan)"><input value={f.masa} onChange={set('masa')} placeholder="cth: 1.30 - 3.00 petang" /></Field>
            <Field label="Tempat (pilihan)"><input value={f.tempat} onChange={set('tempat')} placeholder="cth: Dewan Sekolah" /></Field>
            <Field label="Kehadiran (pilihan)"><input value={f.kehadiran} onChange={set('kehadiran')} placeholder="cth: 24/28 ahli" /></Field>
            <Field label="Aktiviti yang dijalankan (satu baris satu aktiviti)">
              <textarea rows={3} value={f.aktiviti} onChange={set('aktiviti')} placeholder={'Murid membaca Surah Yaasin\nBacaan doa'} />
            </Field>
            <Field label="Objektif (satu baris satu objektif)">
              <textarea rows={3} value={f.objektif} onChange={set('objektif')} placeholder={'Meningkatkan kesedaran membaca al-Quran\nMenanam amalan baik berterusan'} />
            </Field>
            <Field label="Impak / Dapatan">
              <textarea rows={3} value={f.impak} onChange={set('impak')} />
            </Field>
            {[0, 1, 2].map((i) => (
              <Field key={i} label={`Gambar ${i + 1}`}>
                <input type="file" accept="image/*" onChange={(e) => pickPhoto(i, e.target.files?.[0])} />
              </Field>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel-head ph-green"><span className="ph-icon">👁️</span> Pratonton</div>
          <div className="panel-body">
            <canvas
              ref={canvasRef}
              width={OPR_W}
              height={OPR_H}
              style={{ width: '100%', height: 'auto', border: '1px solid #ddd', borderRadius: 8, display: 'block' }}
            />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={downloadPdf} disabled={!f.nama.trim()}>⬇ Muat Turun PDF</button>
              <button className="btn btn-ghost" onClick={downloadJpg} disabled={!f.nama.trim()}>⬇ JPG (WhatsApp)</button>
              <Link className="btn btn-ghost" to="/fail-drive">📤 Muat naik ke Drive</Link>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
