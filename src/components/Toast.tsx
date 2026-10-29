import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'

type Tone = 'info' | 'success' | 'error'
interface ToastItem {
  id: number
  tone: Tone
  text: string
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const push = useCallback((text: string, tone: Tone = 'info') => {
    const id = Date.now() + Math.random()
    setItems((list) => [...list.slice(-2), { id, tone, text }])
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 7000 : 4500)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite" role="status">
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full max-w-md rounded-[12px] border px-4 py-3 text-[14px] font-medium ${
              t.tone === 'error' ? 'border-error bg-white text-ink' : t.tone === 'success' ? 'border-success bg-white text-ink' : 'border-primary bg-primary text-white'
            }`}
          >
            {t.tone === 'error' && <span className="mr-2 font-bold text-error">Error</span>}
            {t.tone === 'success' && <span className="mr-2 font-bold text-success">Done</span>}
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// oxlint-disable-next-line react/only-export-components
export const useToast = () => useContext(ToastContext)
