'use client'

import { ReactNode } from 'react'

interface ExploreCardProps {
  icon: ReactNode
  title: string
  subtitle: string
  iconBgClass?: string
  onClick?: () => void
}

export default function ExploreCard({ icon, title, subtitle, iconBgClass, onClick }: ExploreCardProps) {
  return (
    <div
      onClick={onClick}
      className="bg-[#35281F] rounded-2xl p-5 border border-[#6B5847] cursor-pointer hover:border-[#D49A4A] hover:bg-[#403027] transition-all"
    >
      <div className={`w-11 h-11 rounded-full flex items-center justify-center mb-3 ${iconBgClass || 'bg-[#403027]'}`}>
        {icon}
      </div>
      <p className="text-[#F4EDE3] text-sm font-semibold">{title}</p>
      <p className="text-[#B8A99A] text-xs mt-1">{subtitle}</p>
    </div>
  )
}
