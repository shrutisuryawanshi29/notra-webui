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
      className={`w-9 h-9 rounded-full bg-[#332A23] flex items-center justify-center text-[#CBB9A7] hover:text-[#F4E9DA] hover:bg-[#40342B] transition-colors ${className}`}
    >
      {children}
    </button>
  )
}
