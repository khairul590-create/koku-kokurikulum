import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { LoginModal } from './LoginModal'

const NAV = [
  { section: 'Dashboard' },
  { to: '/', icon: '📊', label: 'Dashboard', end: true },
  { section: 'Pengurusan Kokurikulum' },
  { to: '/murid', icon: '🧑‍🎓', label: 'Urus Murid' },
  { to: '/kelab', icon: '🎨', label: 'Kelab & Persatuan' },
  { to: '/beruniform', icon: '🎖️', label: 'Pasukan Beruniform' },
  { to: '/sukan', icon: '⚽', label: 'Sukan & Permainan' },
  { to: '/pajsk', icon: '📋', label: 'Pentaksiran PAJSK' },
  { to: '/kehadiran', icon: '📅', label: 'Rekod Kehadiran' },
  { to: '/pencapaian', icon: '🏆', label: 'Pencapaian & Anugerah' },
  { to: '/takwim', icon: '🗓️', label: 'Takwim Aktiviti' },
  { section: 'Laporan' },
  { to: '/laporan/individu', icon: '👤', label: 'Laporan Individu' },
  { to: '/laporan/unit', icon: '🏫', label: 'Laporan Unit' },
  { to: '/muat-turun', icon: '📥', label: 'Muat Turun' },
  { section: 'Sistem' },
  { to: '/tetapan', icon: '⚙️', label: 'Tetapan' },
  { to: '/pengguna', icon: '👥', label: 'Pengguna' },
  { to: '/bantuan', icon: '❓', label: 'Bantuan' },
] as const

export function Layout() {
  const { authed, logout } = useAuth()
  const [showLogin, setShowLogin] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="app-shell">
      {menuOpen && <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} />}
      <aside className={'sidebar' + (menuOpen ? ' open' : '')}>
        <div className="sidebar-logo">
          <div className="logo-circle">🎓</div>
          <div className="logo-text">
            <div className="school-name">SK DARAU</div>
            <div className="school-sub">Kota Kinabalu, Sabah</div>
          </div>
        </div>

        {NAV.map((item, i) =>
          'section' in item ? (
            <div className="sidebar-section" key={`s${i}`}>
              {item.section}
            </div>
          ) : (
            <NavLink
              key={item.to}
              to={item.to}
              end={'end' in item ? item.end : false}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                'sidebar-item' + (isActive ? ' active' : '')
              }
            >
              <span className="icon">{item.icon}</span> {item.label}
            </NavLink>
          ),
        )}

        <div className="sidebar-brand">
          <div className="brand-badge">
            <div className="b1">🌟 SMART KOKURIKULUM</div>
            <div className="b2">Bina Sahsiah, Lahir Pemimpin</div>
          </div>
        </div>
      </aside>

      <div className="main">
        <div className="topbar">
          <div className="topbar-left">
            <button
              className="hamburger-btn"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Menu"
            >
              ☰
            </button>
            <div>
              <div className="topbar-title">
                🎓 SISTEM PENGURUSAN KOKURIKULUM SK DARAU
              </div>
              <div className="topbar-sub">
                Pentaksiran Aktiviti Jasmani, Sukan & Kokurikulum (PAJSK)
              </div>
            </div>
          </div>
          {authed ? (
            <div className="topbar-user">
              <div className="user-avatar">👨‍🏫</div>
              <div>
                <div className="user-name">Cikgu Azwani</div>
                <div className="user-role">GPK Kokurikulum</div>
                <button
                  onClick={logout}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ffd54f',
                    fontSize: 10,
                    cursor: 'pointer',
                    padding: 0,
                    marginTop: 2,
                  }}
                >
                  Log keluar
                </button>
              </div>
              <div className="user-dot" />
            </div>
          ) : (
            <button
              className="topbar-login-btn"
              onClick={() => setShowLogin(true)}
            >
              🔑 Log Masuk Admin
            </button>
          )}
        </div>

        <div className="content">
          <Outlet />
        </div>

        <div className="footer">
          <span>
            " Kokurikulum membentuk sahsiah – di sinilah lahirnya pemimpin masa
            hadapan "
          </span>
        </div>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  )
}
