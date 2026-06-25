'use client'

import { ReactNode } from 'react'
import Card from '@/components/Card'

interface EmptyStateProps {
  title: string
  description?: string
  icon?: ReactNode
  action?: { label: string; onClick: () => void }
}

export default function EmptyState({ title, description, icon, action }: EmptyStateProps) {
  return (
    <Card className="flex flex-col items-center justify-center py-12">
      <div className="w-12 h-12 rounded-full bg-[#403027] flex items-center justify-center mb-4">
        <div className="text-[#B8A99A]">
          {icon}
        </div>
      </div>
      <h3 className="text-[#B8A99A] text-sm font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-[#B8A99A] text-xs mb-4 max-w-xs text-center">{description}</p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="bg-[#D49A4A] text-white rounded-full px-4 py-1.5 text-xs font-medium hover:opacity-90 transition-opacity"
        >
          {action.label}
        </button>
      )}
    </Card>
  )
}

EmptyState.displayName = 'EmptyState'
