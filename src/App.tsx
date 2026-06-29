import { Routes, Route } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { LoginScreen } from './pages/LoginScreen'
import { Layout } from './layout/Layout'
import { Dashboard } from './pages/Dashboard'
import { UnitsPage } from './pages/UnitsPage'
import { StudentsInfo } from './pages/StudentsInfo'
import { StudentProfile } from './pages/StudentProfile'
import { PajskPage } from './pages/PajskPage'
import { KehadiranPage } from './pages/KehadiranPage'
import { PencapaianPage } from './pages/PencapaianPage'
import { TakwimPage } from './pages/TakwimPage'
import { LaporanIndividu } from './pages/LaporanIndividu'
import { LaporanUnit } from './pages/LaporanUnit'
import { MuatTurun } from './pages/MuatTurun'
import { Tetapan } from './pages/Tetapan'
import { Pengguna } from './pages/Pengguna'
import { Bantuan } from './pages/Bantuan'

export default function App() {
  const { authed, loading } = useAuth()

  if (loading)
    return <div className="login-screen"><div className="loading">Memuatkan…</div></div>
  if (!authed) return <LoginScreen />

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="kelab" element={<UnitsPage kind="kelab" />} />
        <Route path="beruniform" element={<UnitsPage kind="beruniform" />} />
        <Route path="sukan" element={<UnitsPage kind="sukan" />} />
        <Route path="murid" element={<StudentsInfo />} />
        <Route path="murid/:id" element={<StudentProfile />} />
        <Route path="pajsk" element={<PajskPage />} />
        <Route path="kehadiran" element={<KehadiranPage />} />
        <Route path="pencapaian" element={<PencapaianPage />} />
        <Route path="takwim" element={<TakwimPage />} />
        <Route path="laporan/individu" element={<LaporanIndividu />} />
        <Route path="laporan/unit" element={<LaporanUnit />} />
        <Route path="muat-turun" element={<MuatTurun />} />
        <Route path="tetapan" element={<Tetapan />} />
        <Route path="pengguna" element={<Pengguna />} />
        <Route path="bantuan" element={<Bantuan />} />
        <Route path="*" element={<Dashboard />} />
      </Route>
    </Routes>
  )
}
