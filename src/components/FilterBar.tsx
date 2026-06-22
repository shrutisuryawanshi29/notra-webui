'use client'

import { X, SlidersHorizontal, Search, Filter } from 'lucide-react'
import { ActiveFilters } from '@/types/filters'
import { chipLabel } from '@/lib/filter-engine'

interface FilterBarProps {
  active: ActiveFilters
  activeCount: number
  filteredTotal: number
  totalCount: number
  isFiltered: boolean
  resultCount: number
  relationLookup: Record<string, string>
  onSearchChange: (query: string) => void
  onOpenSheet: () => void
  onRemoveColumnFilter: (id: string) => void
  onClearDateRange: () => void
}

export default function FilterBar({
  active,
  activeCount,
  filteredTotal,
  totalCount,
  isFiltered,
  resultCount,
  relationLookup,
  onSearchChange,
  onOpenSheet,
  onRemoveColumnFilter,
  onClearDateRange,
}: FilterBarProps) {
  return (
    <div className="space-y-3 mb-4">
      {/* Search + Filter button row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B5C4E]" />
          <input
            type="text"
            placeholder="Search transactions..."
            value={active.search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-[#2A211A] border border-[#40342B] rounded-lg pl-9 pr-3 py-2 text-sm text-[#EDE1D1] placeholder-[#6B5C4E] focus:outline-none focus:border-[#C99152]"
          />
        </div>
        <button
          onClick={onOpenSheet}
          className="flex items-center gap-1.5 bg-[#2A211A] border border-[#40342B] rounded-lg px-3 py-2 text-sm text-[#EDE1D1] hover:border-[#C99152] transition-colors shrink-0"
        >
          <Filter size={14} />
          {activeCount > 0 ? (
            <span>Filters ({activeCount})</span>
          ) : (
            <span>Filters</span>
          )}
        </button>
      </div>

      {/* Filter chips */}
      {(active.columnFilters.length > 0 || active.dateFrom || active.dateTo) && (
        <div className="flex gap-2 flex-wrap">
          {active.columnFilters.map((cf) => (
            <span
              key={cf.id}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[#40342B] text-[#CBB9A7]"
            >
              {chipLabel(cf, relationLookup)}
              <button
                onClick={() => onRemoveColumnFilter(cf.id)}
                className="hover:text-[#EDE1D1] transition-colors"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {active.dateFrom && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[#40342B] text-[#CBB9A7]">
              From: {active.dateFrom}
              <button onClick={onClearDateRange} className="hover:text-[#EDE1D1] transition-colors">
                <X size={12} />
              </button>
            </span>
          )}
          {active.dateTo && !active.dateFrom && (
            <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-[#40342B] text-[#CBB9A7]">
              To: {active.dateTo}
              <button onClick={onClearDateRange} className="hover:text-[#EDE1D1] transition-colors">
                <X size={12} />
              </button>
            </span>
          )}
        </div>
      )}

      {/* Count / filtered total line */}
      <p className="text-[#9B8778] text-xs">
        {isFiltered
          ? `${resultCount} of ${totalCount} transaction${totalCount !== 1 ? 's' : ''}`
          : `${totalCount} transaction${totalCount !== 1 ? 's' : ''}`
        }
        {isFiltered && <span className="ml-2 text-[#C99152]">(${filteredTotal.toFixed(2)})</span>}
      </p>
    </div>
  )
}
