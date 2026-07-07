import { PageHeader, EmptyState } from '../components/ui'

// Folder Google Drive kokurikulum. Ambil ID dari URL folder:
//   https://drive.google.com/drive/folders/<INI_ID_NYA>
// Folder mesti dikongsi "Sesiapa yang ada pautan → Pelihat".
// ponytail: hardcode — folder tetap. Kalau kerap tukar, pindah ke Tetapan (settings jsonb).
const FOLDER_ID = '1ZB8Efb6JMklpAFNuzhts_OlGGwBk5_c6'

export function FailDrive() {
  const driveUrl = `https://drive.google.com/drive/folders/${FOLDER_ID}`
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
