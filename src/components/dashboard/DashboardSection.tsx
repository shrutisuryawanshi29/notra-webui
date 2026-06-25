'use client'

import { ReactNode } from 'react'

interface DashboardSectionProps {
  title: string
  subtitle?: string
  action?: { label: string; onClick: () => void }
  children: ReactNode
  id?: string
}

export default function DashboardSection({ title, subtitle, action, children, id }: DashboardSectionProps) {
  return (
    <section id={id} className="space-y-3 md:space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-n-text-muted text-xs font-semibold uppercase tracking-wider">
            {title}
          </h3>
          {subtitle && (
            <p className="text-n-text-muted text-xs mt-0.5">{subtitle}</p>
          )}
        </div>
        {action && (
          <button
            onClick={action.onClick}
            className="text-n-accent text-xs font-medium hover:underline"
          >
            {action.label} →
          </button>
        )}
      </div>
      {children}
    </section>
  )
}
