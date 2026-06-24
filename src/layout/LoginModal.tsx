import { useState } from 'react'
import { Modal } from '../components/Modal'
import { Field } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useToast } from '../lib/toast'

export function LoginModal({ onClose }: { onClose: () => void }) {
  const { login } = useAuth()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    try {
      await login(password)
      toast('Berjaya log masuk', 'ok')
      onClose()
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="🔑 Log Masuk Admin" onClose={onClose}>
      <form onSubmit={submit}>
        {err && <div className="form-err">{err}</div>}
        <Field label="Kata Laluan Admin">
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Masukkan kata laluan"
          />
        </Field>
        <div className="modal-foot" style={{ padding: 0 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Batal
          </button>
          <button type="submit" className="btn btn-primary" disabled={busy}>
            {busy ? 'Memproses…' : 'Log Masuk'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
