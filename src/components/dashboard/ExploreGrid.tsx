'use client'

import { Receipt, TrendingUp, BarChart3, Users } from 'lucide-react'
import ExploreCard from './ExploreCard'

interface ExploreGridProps {
  onExpenses: () => void
  onIncome: () => void
  onAnalytics: () => void
  onSplitTracker: () => void
}

export default function ExploreGrid({
  onExpenses,
  onIncome,
  onAnalytics,
  onSplitTracker,
}: ExploreGridProps) {
  return (
    <section>
      <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
        Explore
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <ExploreCard
          icon={<Receipt size={22} className="text-[#C7745A]" />}
          title="Expenses"
          subtitle="View spending"
          iconBgClass="bg-[#C7745A]/10"
          onClick={onExpenses}
        />
        <ExploreCard
          icon={<TrendingUp size={22} className="text-[#8CA37D]" />}
          title="Income"
          subtitle="View earnings"
          iconBgClass="bg-[#8CA37D]/10"
          onClick={onIncome}
        />
        <ExploreCard
          icon={<BarChart3 size={22} className="text-[#C99152]" />}
          title="Analytics"
          subtitle="See insights"
          iconBgClass="bg-[#C99152]/10"
          onClick={onAnalytics}
        />
        <ExploreCard
          icon={<Users size={22} className="text-[#C49A5A]" />}
          title="Split Tracker"
          subtitle="View settlements"
          iconBgClass="bg-[#C49A5A]/10"
          onClick={onSplitTracker}
        />
      </div>
    </section>
  )
}
