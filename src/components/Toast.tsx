'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface ToastProps {
  open: boolean
  message: string
  type?: 'error' | 'success'
  onClose: () => void
  duration?: number
}

export default function Toast({ open, message, type = 'error', onClose, duration = 4000 }: ToastProps) {
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [open, duration, onClose])

  if (!open) return null

  const bg = type === 'error' ? 'bg-[#D8755D]' : 'bg-[#93B889]'

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-fade-in">
      <div className={`${bg} text-white rounded-xl px-4 py-3 shadow-xl flex items-center gap-3 max-w-sm`}>
        <p className="text-sm font-medium flex-1">{message}</p>
        <button onClick={onClose} className="text-white/80 hover:text-white transition-colors">
          <X size={16} />
        </button>
      </div>
    </div>
  )
}
