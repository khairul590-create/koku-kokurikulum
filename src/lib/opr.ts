// One Page Report (OPR) — dilukis terus atas <canvas> supaya pratonton = PDF.
// (html2canvas tak sokong clip-path, jadi bucu gambar bersudut potong mesti dilukis sendiri.)

const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember']

/** '2026-08-21' → '21 Ogos 2026' */
export function formatTarikh(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${d} ${BULAN[m - 1]} ${y}`
}

/** Satu baris = satu item. Buang nombor / bullet yang guru taip sendiri. */
export function toItems(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim().replace(/^(\d+[.)]|[-•*])\s*/, ''))
    .filter(Boolean)
}

/** Balut perkataan ikut lebar. Perkataan lebih panjang dari lebar kekal sebaris. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (line && measure(next) > maxWidth) {
      lines.push(line)
      line = word
    } else line = next
  }
  if (line) lines.push(line)
  return lines
}

export interface OprData {
  school: string
  nama: string
  tarikh: string // ISO
  masa: string
  tempat: string
  kehadiran: string
  aktiviti: string
  objektif: string
  impak: string
}

// Ukuran asas ikut templat Canva (904×1280), diskala ke A4 150dpi.
const BASE_W = 904
const BASE_H = 1280
export const OPR_W = 1240
export const OPR_H = Math.round((OPR_W * BASE_H) / BASE_W)

const C = {
  band: '#e2a9ef',
  triTop: '#8e4a9e',
  triBot: '#d49be0',
  script: '#5e1f70',
  banner: '#d3a0d9',
  bannerText: '#4b1a5c',
  box: '#cbbdcf',
  ink: '#1e1e1e',
}
const SANS = 'Poppins, sans-serif'
const SCRIPT = '"Dancing Script", cursive'

export async function loadOprFonts() {
  await Promise.all([
    document.fonts.load(`800 54px ${SANS}`),
    document.fonts.load(`700 22px ${SANS}`),
    document.fonts.load(`600 18px ${SANS}`),
    document.fonts.load(`500 18px ${SANS}`),
    document.fonts.load(`700 72px ${SCRIPT}`),
  ])
}

type Run = { text: string; size: number; weight: number; num?: string; gap?: number; center?: boolean }

const font = (weight: number, size: number) => `${weight} ${size}px ${SANS}`

/** Susun runs dalam kotak; kecilkan fon sehingga muat (min 55%). */
function drawRuns(ctx: CanvasRenderingContext2D, runs: Run[], x: number, y: number, w: number, h: number, vCenter = false) {
  const INDENT = 34
  for (let k = 1; k >= 0.55; k -= 0.05) {
    const out: { text: string; f: string; x: number; y: number; center?: boolean }[] = []
    let cy = 0
    for (const r of runs) {
      const size = r.size * k
      const lh = size * 1.3
      cy += (r.gap ?? 0) * k
      ctx.font = font(r.weight, size)
      const tx = r.num ? x + INDENT : x
      const lines = wrapText(r.text, r.num ? w - INDENT : w, (s) => ctx.measureText(s).width)
      lines.forEach((line, i) => {
        cy += lh
        if (r.num && i === 0) out.push({ text: r.num, f: ctx.font, x: x + 10, y: cy })
        out.push({ text: line, f: ctx.font, x: r.center ? x + w / 2 : tx, y: cy, center: r.center })
      })
    }
    if (cy <= h || k - 0.05 < 0.55) {
      const offset = vCenter ? (h - cy) / 2 : 0
      ctx.fillStyle = C.ink
      for (const o of out) {
        ctx.font = o.f
        ctx.textAlign = o.center ? 'center' : 'left'
        ctx.fillText(o.text, o.x, y + offset + o.y - 4)
      }
      ctx.textAlign = 'left'
      return
    }
  }
}

function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, r = 12) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = C.ink
  ctx.stroke()
}

function photo(ctx: CanvasRenderingContext2D, img: CanvasImageSource & { width: number; height: number } | null, x: number, y: number, w: number, h: number, n: number) {
  const c = 44 // potongan bucu
  ctx.save()
  ctx.beginPath()
  ctx.moveTo(x + c, y)
  ctx.lineTo(x + w - c, y)
  ctx.lineTo(x + w, y + c)
  ctx.lineTo(x + w, y + h - c)
  ctx.lineTo(x + w - c, y + h)
  ctx.lineTo(x + c, y + h)
  ctx.lineTo(x, y + h - c)
  ctx.lineTo(x, y + c)
  ctx.closePath()
  ctx.clip()
  if (img) {
    // object-fit: cover
    const s = Math.max(w / img.width, h / img.height)
    const sw = w / s
    const sh = h / s
    ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
  } else {
    ctx.fillStyle = '#eee8f0'
    ctx.fillRect(x, y, w, h)
    ctx.fillStyle = '#9a8aa0'
    ctx.font = font(600, 20)
    ctx.textAlign = 'center'
    ctx.fillText(`Gambar ${n}`, x + w / 2, y + h / 2 + 7)
    ctx.textAlign = 'left'
  }
  ctx.restore()
}

export function drawOpr(
  ctx: CanvasRenderingContext2D,
  d: OprData,
  photos: (CanvasImageSource & { width: number; height: number } | null)[],
) {
  ctx.save()
  ctx.scale(OPR_W / BASE_W, OPR_H / BASE_H)
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, BASE_W, BASE_H)

  // Hiasan atas
  ctx.fillStyle = C.band
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(170, 0); ctx.lineTo(0, 75); ctx.fill()
  ctx.beginPath(); ctx.moveTo(400, 0); ctx.lineTo(BASE_W, 0); ctx.lineTo(BASE_W, 135); ctx.fill()
  const g = ctx.createLinearGradient(0, 0, 0, 78)
  g.addColorStop(0, C.triTop)
  g.addColorStop(1, C.triBot)
  ctx.fillStyle = g
  ctx.beginPath(); ctx.moveTo(95, 0); ctx.lineTo(470, 0); ctx.lineTo(278, 78); ctx.fill()

  // Tajuk "ONE PAGE Report"
  ctx.font = `800 56px ${SANS}`
  const w1 = ctx.measureText('ONE PAGE ').width
  ctx.font = `700 78px ${SCRIPT}`
  const w2 = ctx.measureText('Report').width
  const tx = (BASE_W - w1 - w2) / 2
  ctx.fillStyle = '#000'
  ctx.font = `800 56px ${SANS}`
  ctx.fillText('ONE PAGE ', tx, 148)
  ctx.fillStyle = C.script
  ctx.font = `700 78px ${SCRIPT}`
  ctx.fillText('Report', tx + w1, 138)

  // Banner sekolah
  box(ctx, 73, 172, 739, 54, C.banner, 10)
  let bs = 28
  ctx.font = font(700, bs)
  while (ctx.measureText(d.school).width > 700 && bs > 14) ctx.font = font(700, --bs)
  ctx.fillStyle = C.bannerText
  ctx.textAlign = 'center'
  ctx.fillText(d.school, BASE_W / 2, 199 + bs * 0.36)
  ctx.textAlign = 'left'

  // Kotak kiri
  const BX = 80, BW = 366, PAD = 12
  const panels: { y: number; h: number; label: string; runs: Run[]; vCenter?: boolean }[] = [
    {
      y: 305, h: 180, label: 'NAMA PROGRAM', vCenter: true,
      runs: [{ text: d.nama.toUpperCase() || '—', size: 30, weight: 600, center: true }],
    },
    {
      y: 510, h: 222, label: 'BUTIRAN PROGRAM',
      runs: [
        { text: `Tarikh : ${formatTarikh(d.tarikh)}`, size: 18, weight: 500 },
        ...[['Masa', d.masa], ['Tempat', d.tempat], ['Kehadiran', d.kehadiran]]
          .filter(([, v]) => v.trim())
          .map(([k, v]) => ({ text: `${k} : ${v.trim()}`, size: 18, weight: 500 })),
        { text: 'Aktiviti yang dijalankan:', size: 18, weight: 500, gap: 14 },
        ...toItems(d.aktiviti).map((t, i) => ({ text: t, size: 18, weight: 600, num: `${i + 1}.` })),
      ],
    },
    {
      y: 757, h: 233, label: 'OBJEKTIF',
      runs: toItems(d.objektif).map((t, i) => ({ text: t, size: 19, weight: 600, num: `${i + 1}.`, gap: i ? 0 : 8 })),
    },
    {
      y: 1012, h: 178, label: 'IMPAK / DAPATAN',
      runs: [{ text: d.impak.trim(), size: 18, weight: 500 }],
    },
  ]
  for (const p of panels) {
    box(ctx, BX, p.y, BW, p.h, C.box)
    ctx.fillStyle = C.ink
    ctx.font = font(700, 22)
    ctx.fillText(p.label, BX + PAD, p.y + 34)
    drawRuns(ctx, p.runs, BX + PAD, p.y + 44, BW - PAD * 2, p.h - 52, p.vCenter)
  }

  // Gambar kanan
  ;[295, 605, 915].forEach((y, i) => photo(ctx, photos[i] ?? null, 473, y, 403, 275, i + 1))

  // Jalur bawah
  ctx.fillStyle = C.band
  ctx.fillRect(0, 1232, BASE_W, 48)
  ctx.restore()
}
