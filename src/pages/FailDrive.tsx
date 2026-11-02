import { PageHeader, EmptyState } from '../components/ui'

// Folder Google Drive kokurikulum. Ambil ID dari URL folder:
//   https://drive.google.com/drive/folders/<INI_ID_NYA>
// Folder mesti dikongsi "Sesiapa yang ada pautan → Pelihat".
// ponytail: hardcode — folder tetap. Kalau kerap tukar, pindah ke Tetapan (settings jsonb).
const FOLDER_ID = '1ZB8Efb6JMklpAFNuzhts_OlGGwBk5_c6'

// Folder muat naik setiap unit dalam eKOKUM/2026/. Paparan terbenam Drive tak boleh
// muat naik, jadi butang buka folder unit di tab baru → Baharu → Muat naik fail.
// ponytail: hardcode setahun sekali. Tahun baru: cipta folder <tahun>/ dalam Drive,
// tukar UPLOAD_YEAR + ID di bawah. Pindah ke lajur units.drive_folder_id kalau kerap berubah.
const UPLOAD_YEAR = 2026
const UPLOAD_FOLDERS: { icon: string; label: string; units: [string, string][] }[] = [
  {
    icon: '🎖️', label: 'Unit Beruniform',
    units: [
      ['PENGAKAP', '19DwoI22lT-vE5vXmRQ-Jvs6qZlcjNb6o'],
      ['BSMM', '1ltMbcWHdIfgGNMkvfqGX5XKq87VqmUOJ'],
      ['TKRS', '1nuOQ9jnvfJu9-WL4ztO8j3Id0nTGJRpY'],
      ['PP TUNAS', '15qM8wATdBPPzv6RNxG0tiEuYqE9_8K-r'],
      ['PPIM', '1WXRDOK8va6ZeVTg377NelPijhr5_FBCw'],
    ],
  },
  {
    icon: '🎨', label: 'Kelab & Persatuan',
    units: [
      ['BAHASA INGGERIS', '1h_U66RvCSQN7iV37rTFN6pVWQS17PNVA'],
      ['STEM', '13h3uXPcb9JyvBNtu-B7QZ1DLM90P-Qab'],
      ['BAHASA MELAYU', '17DjBCnB_y_ZsULzOTJ7mlTY9uEzp4rSi'],
      ['PENDIDIKAN ISLAM', '1ZTuLAgUIKNLnWAwmMaJpdr5Ll7BxjhMs'],
      ['KEBUDAYAAN', '1LRZ3W_B7Z_gnJfVXQm8-pH_tTeQ2uxSZ'],
      ['DOKTOR MUDA', '1-SSLhBSl_psJZjQnOnXy-_43L8rsVn2F'],
      ['KERJAYA', '1Rxsd41JEGUoF6l4xG7KjSYmmiZxXx6b0'],
    ],
  },
  {
    icon: '⚽', label: 'Sukan & Permainan',
    units: [
      ['BOLA JARING', '1S-oY9TAG5U35diXdLoSAujgNIsiB0cUh'],
      ['BOLA SEPAK', '1qpe8BhK6Ql_j234i712pnsK0WMSLzvIs'],
      ['BOLA BALING', '1ALwt0o2z1gYQECIKndfYxfAnNZ3cLSjS'],
      ['BOLA TAMPAR', '1cTZcgXkFtezkI7xaDuqXvkrWehjCuHqa'],
      ['BADMINTON', '1T6foPmO9yR9cCTjtD4IkcksxhZjrzjze'],
      ['CATUR', '1fij5aSLGT-pdO3uq7RkBYKqPYRqlIoWu'],
      ['OLAHRAGA', '14U-55Y8bS-xoZDtilWcI8JiyQjuktrLh'],
      ['MERENTAS DESA', '1YLTqs0boj-Mg3-r_38Y7pNwWnm_znJed'],
      ['PENGLIBATAN LUAR', '1EZtszDcszbYqh9Oj0s-c3fb_n06ZYCgP'],
    ],
  },
  {
    icon: '📋', label: 'Lain-lain',
    units: [
      ['PAJSK', '1GFH5PpO_JOz0b3ph68-Km7WFMkvkFYXT'],
      ['1M1S', '1I_tI7WJOijsO2bos29x0UXn8jDwJ2gG8'],
      ['KEHADIRAN', '1YRfeqj0zOAmDqxhERlWz_PLXRlkyQVz7'],
    ],
  },
]

const folderUrl = (id: string) => `https://drive.google.com/drive/folders/${id}`

export function FailDrive() {
  const driveUrl = folderUrl(FOLDER_ID)
  return (
    <>
      <PageHeader
        title="📁 Fail Drive Kokurikulum"
        sub="Fail & dokumen dari Google Drive"
        action={
          FOLDER_ID && (
            <a className="btn btn-ghost" href={driveUrl} target="_blank" rel="noreferrer">
              ↗ Buka di Google Drive
            </a>
          )
        }
      />

      <div className="panel">
        <div className="panel-head ph-green">
          <span className="ph-icon">📤</span> Muat Naik Fail {UPLOAD_YEAR}
        </div>
        <div className="panel-body">
          <p style={{ margin: '0 0 12px' }}>
            Tekan unit anda → folder Drive terbuka → tekan <b>Baharu</b> → <b>Muat naik fail</b>.
            Simpan dalam subfolder yang betul: Carta Organisasi, Rancangan Tahunan atau Laporan Aktiviti.
          </p>
          {UPLOAD_FOLDERS.map((g) => (
            <div key={g.label} style={{ marginBottom: 14 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>{g.icon} {g.label}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {g.units.map(([name, id]) => (
                  <a key={id} className="btn btn-ghost" href={folderUrl(id)} target="_blank" rel="noreferrer">
                    {name}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel" style={{ padding: FOLDER_ID ? 0 : undefined }}>
        {!FOLDER_ID ? (
          <EmptyState
            icon="📁"
            text="Folder Drive belum ditetapkan. Beri pautan folder kepada pentadbir sistem."
          />
        ) : (
          <iframe
            title="Fail Drive Kokurikulum"
            src={`https://drive.google.com/embeddedfolderview?id=${FOLDER_ID}#list`}
            style={{ width: '100%', height: '72vh', border: 'none', display: 'block' }}
          />
        )}
      </div>
    </>
  )
}
