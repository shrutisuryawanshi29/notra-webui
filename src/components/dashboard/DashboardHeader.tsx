'use client'

import { Settings, RefreshCw } from 'lucide-react'
import IconButton from './IconButton'

interface DashboardHeaderProps {
  onSettings: () => void
  onRefresh: () => void
}

export default function DashboardHeader({ onSettings, onRefresh }: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <IconButton onClick={onSettings}>
        <Settings size={18} />
      </IconButton>
      <h1 className="text-[#EDE1D1] text-lg font-semibold">Dashboard</h1>
      <IconButton onClick={onRefresh}>
        <RefreshCw size={18} />
      </IconButton>
    </div>
  )
}
