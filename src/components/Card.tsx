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
      className={`bg-n-surface rounded-xl p-4 shadow-[0_2px_10px_rgba(0,0,0,0.35)] border border-n-border-soft transition-all duration-200 hover:-translate-y-0.5 hover:border-n-accent/30 hover:shadow-[0_6px_20px_rgba(0,0,0,0.45)] ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      {children}
    </div>
  )
}
