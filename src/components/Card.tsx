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
      className={`bg-[#362D25] rounded-xl p-4 shadow-[0_4px_12px_rgba(18,14,11,0.08)] border border-[#4C4036] ${
        onClick ? 'cursor-pointer hover:bg-[#40342B] transition-colors' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
