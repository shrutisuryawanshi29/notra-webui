'use client'

import { ReactNode } from 'react'

interface IconButtonProps {
  children: ReactNode
  onClick?: () => void
  className?: string
}

export default function IconButton({ children, onClick, className = '' }: IconButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`w-9 h-9 rounded-full bg-[#403027] flex items-center justify-center text-[#B8A99A] hover:text-[#F4EDE3] hover:bg-[#6B5847] transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
