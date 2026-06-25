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
      <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider mb-3">
        Explore
      </h3>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <ExploreCard
          icon={<Receipt size={22} className="text-[#D8755D]" />}
          title="Expenses"
          subtitle="View spending"
          iconBgClass="bg-[#D8755D]/10"
          onClick={onExpenses}
        />
        <ExploreCard
          icon={<TrendingUp size={22} className="text-[#93B889]" />}
          title="Income"
          subtitle="View earnings"
          iconBgClass="bg-[#93B889]/10"
          onClick={onIncome}
        />
        <ExploreCard
          icon={<BarChart3 size={22} className="text-[#D49A4A]" />}
          title="Analytics"
          subtitle="See insights"
          iconBgClass="bg-[#D49A4A]/10"
          onClick={onAnalytics}
        />
        <ExploreCard
          icon={<Users size={22} className="text-[#F7E49B]" />}
          title="Split Tracker"
          subtitle="View settlements"
          iconBgClass="bg-[#F7E49B]/10"
          onClick={onSplitTracker}
        />
      </div>
    </section>
  )
}
