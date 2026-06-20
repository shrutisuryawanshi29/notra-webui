'use client'

import { Plus } from 'lucide-react'

interface FloatingActionButtonProps {
  onClick: () => void
}

export default function FloatingActionButton({ onClick }: FloatingActionButtonProps) {
  return (
    <button
      onClick={onClick}
      className="w-14 h-14 rounded-full bg-[#C99152] text-white flex items-center justify-center shadow-lg hover:bg-[#A97845] transition-colors active:scale-95"
      title="Add transaction"
    >
      <Plus size={26} />
    </button>
  )
}
