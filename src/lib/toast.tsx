import { createContext, useCallback, useContext, useState, ReactNode } from 'react'

type ToastKind = 'ok' | 'err' | 'info'
interface ToastState {
  msg: string
  kind: ToastKind
}
const Ctx = createContext<(msg: string, kind?: ToastKind) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)

  const show = useCallback((msg: string, kind: ToastKind = 'info') => {
    setToast({ msg, kind })
    setTimeout(() => setToast(null), 3000)
  }, [])

  return (
    <Ctx.Provider value={show}>
      {children}
      {toast && (
        <div className={`toast ${toast.kind === 'info' ? '' : toast.kind}`}>
          {toast.msg}
        </div>
      )}
    </Ctx.Provider>
  )
}

export const useToast = () => useContext(Ctx)
