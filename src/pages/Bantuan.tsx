import { PageHeader } from '../components/ui'

export function Bantuan() {
  return (
    <>
      <PageHeader title="❓ Bantuan" sub="Panduan ringkas penggunaan sistem" />
      <div className="panel">
        <div className="panel-head ph-teal"><span className="ph-icon">📖</span> Panduan Penggunaan</div>
        <div className="panel-body">
          <div className="help-section">
            <h3>1. Log Masuk Admin</h3>
            <p>Klik butang <b>🔑 Log Masuk Admin</b> di bahagian atas. Tanpa log masuk, sistem hanya boleh dibaca (tiada butang tambah/edit/padam).</p>
          </div>
          <div className="help-section">
            <h3>2. Susunan Kerja Disyorkan</h3>
            <ul>
              <li>Tambah <b>Murid</b> dahulu (tab Urus Murid).</li>
              <li>Tambah <b>Unit</b> di Kelab, Pasukan Beruniform, atau Sukan.</li>
              <li>Daftar ahli unit melalui butang <b>Ahli</b> pada setiap unit.</li>
              <li>Masukkan <b>Markah PAJSK</b> dan <b>Kehadiran</b>.</li>
              <li>Rekod <b>Pencapaian</b> dan <b>Takwim Aktiviti</b>.</li>
            </ul>
          </div>
          <div className="help-section">
            <h3>3. Gred PAJSK</h3>
            <p>Gred dikira automatik daripada jumlah markah: A (80–100), B (60–79), C (40–59), D (20–39), E (0–19).</p>
          </div>
          <div className="help-section">
            <h3>4. Laporan & Eksport</h3>
            <p>Jana laporan individu/unit, atau muat turun semua data sebagai Excel/PDF di tab <b>Muat Turun</b>.</p>
          </div>
          <div className="help-section">
            <h3>5. Dashboard</h3>
            <p>Semua statistik dikira automatik daripada data yang dimasukkan. Dashboard dikemas kini serta-merta selepas sebarang perubahan.</p>
          </div>
        </div>
      </div>
    </>
  )
}
