'use client'

import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import Card from '@/components/Card'
import { Insight } from '@/lib/analytics'

interface SmartInsightsProps {
  insights: Insight[]
}

const iconMap = {
  positive: { Icon: CheckCircle2, color: '#93B889' },
  negative: { Icon: AlertTriangle, color: '#D8755D' },
  neutral: { Icon: Info, color: '#D49A4A' },
}

export default function SmartInsights({ insights }: SmartInsightsProps) {
  if (insights.length === 0) return null

  return (
    <Card>
      <h3 className="text-[#F4EDE3] text-sm font-semibold mb-3">Insights</h3>
      <div className="space-y-1">
        {insights.map((insight, index) => {
          const { Icon, color } = iconMap[insight.type]
          return (
            <div key={index} className="flex items-start gap-2 py-1.5">
              <Icon size={14} className="mt-0.5 shrink-0" style={{ color }} />
              <span className="text-[#F4EDE3] text-xs leading-relaxed">{insight.text}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

SmartInsights.displayName = 'SmartInsights'
