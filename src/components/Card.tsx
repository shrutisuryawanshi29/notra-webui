import { ReactNode } from 'react'

interface CardProps {
  children: ReactNode
  className?: string
  onClick?: () => void
}

export default function Card({ children, className = '', onClick }: CardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-[#35281F] rounded-xl p-4 shadow-[0_2px_8px_rgba(24,49,43,0.06)] border border-[#6B5847] ${
        onClick ? 'cursor-pointer hover:bg-[#403027] transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
