'use client'

import { X, Plus } from 'lucide-react'
import { ColumnFilter, FilterDraft, FilterableColumn, FilterOperator, FilterOption } from '@/types/filters'
import { operatorsForType } from '@/lib/filter-engine'

interface FilterSheetProps {
  open: boolean
  onClose: () => void
  draft: FilterDraft
  setDraft: (draft: FilterDraft) => void
  onApply: () => void
  onClearAll: () => void
  onUpdateDateFrom: (value: string | null) => void
  onUpdateDateTo: (value: string | null) => void
  onAddColumnFilter: (columnName: string, columnType: string) => void
  onRemoveColumnFilter: (id: string) => void
  onUpdateColumnFilter: (id: string, updates: Partial<ColumnFilter>) => void
  filteredColumns: FilterableColumn[]
  columnOptions: Record<string, FilterOption[]>
}

function FilterRow({
  filter,
  filteredColumns,
  columnOptions,
  onRemove,
  onChange,
}: {
  filter: ColumnFilter
  filteredColumns: FilterableColumn[]
  columnOptions: Record<string, FilterOption[]>
  onRemove: () => void
  onChange: (updates: Partial<ColumnFilter>) => void
}) {
  const ops = operatorsForType(filter.columnType)
  const options = columnOptions[filter.columnName]

  return (
    <div className="bg-[#2A211A] border border-[#40342B] rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* Column picker */}
        <select
          value={filter.columnName}
          onChange={(e) => {
            const col = filteredColumns.find((c) => c.name === e.target.value)
            const columnType = col?.type || 'rich_text'
            const ops2 = operatorsForType(columnType)
            onChange({
              columnName: e.target.value,
              columnType,
              operator: ops2[0]?.value || 'equals',
              value: '',
            })
          }}
          className="flex-1 bg-[#1A1410] border border-[#40342B] rounded px-2 py-1.5 text-sm text-[#EDE1D1] focus:outline-none focus:border-[#C99152]"
        >
          {filteredColumns.map((col) => (
            <option key={col.name} value={col.name}>{col.label}</option>
          ))}
        </select>

        {/* Condition picker */}
        <select
          value={filter.operator}
          onChange={(e) => onChange({ operator: e.target.value as FilterOperator })}
          className="bg-[#1A1410] border border-[#40342B] rounded px-2 py-1.5 text-sm text-[#EDE1D1] focus:outline-none focus:border-[#C99152]"
        >
          {ops.map((op) => (
            <option key={op.value} value={op.value}>{op.label}</option>
          ))}
        </select>

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="text-[#9B8778] hover:text-[#C7745A] transition-colors p-1"
        >
          <X size={16} />
        </button>
      </div>

      {/* Value input */}
      {options && options.length > 0 ? (
        <select
          value={filter.value}
          onChange={(e) => onChange({ value: e.target.value })}
          className="w-full bg-[#1A1410] border border-[#40342B] rounded px-2 py-1.5 text-sm text-[#EDE1D1] focus:outline-none focus:border-[#C99152]"
        >
          <option value="">Select {filter.columnName.toLowerCase()}...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      ) : filter.columnType === 'number' ? (
        <input
          type="number"
          value={filter.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Enter value..."
          className="w-full bg-[#1A1410] border border-[#40342B] rounded px-2 py-1.5 text-sm text-[#EDE1D1] placeholder-[#6B5C4E] focus:outline-none focus:border-[#C99152]"
        />
      ) : (
        <input
          type="text"
          value={filter.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Enter value..."
          className="w-full bg-[#1A1410] border border-[#40342B] rounded px-2 py-1.5 text-sm text-[#EDE1D1] placeholder-[#6B5C4E] focus:outline-none focus:border-[#C99152]"
        />
      )}
    </div>
  )
}

export default function FilterSheet({
  open,
  onClose,
  draft,
  setDraft,
  onApply,
  onClearAll,
  onUpdateDateFrom,
  onUpdateDateTo,
  onAddColumnFilter,
  onRemoveColumnFilter,
  onUpdateColumnFilter,
  filteredColumns,
  columnOptions,
}: FilterSheetProps) {
  if (!open) return null

  const columnsWithoutCategory = filteredColumns.filter((c) => c.name !== 'Category')
  const addFilterColumns = filteredColumns.length > 0 ? filteredColumns : columnsWithoutCategory

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] bg-[#1A1410] border border-[#40342B] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#40342B] shrink-0">
          <button
            onClick={onClearAll}
            className="text-sm text-[#C7745A] hover:text-[#E0876A] transition-colors"
          >
            Clear All
          </button>
          <h2 className="text-[#EDE1D1] text-base font-semibold">Filters</h2>
          <button
            onClick={onApply}
            className="text-sm text-[#C99152] hover:text-[#DBA860] font-medium transition-colors"
          >
            Apply
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Date Range Section */}
          <section>
            <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider mb-3">
              Date Range
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#9B8778] text-xs mb-1">From</label>
                <input
                  type="date"
                  value={draft.dateFrom || ''}
                  onChange={(e) => onUpdateDateFrom(e.target.value || null)}
                  className="w-full bg-[#2A211A] border border-[#40342B] rounded-lg px-3 py-2 text-sm text-[#EDE1D1] focus:outline-none focus:border-[#C99152]"
                />
              </div>
              <div>
                <label className="block text-[#9B8778] text-xs mb-1">To</label>
                <input
                  type="date"
                  value={draft.dateTo || ''}
                  onChange={(e) => onUpdateDateTo(e.target.value || null)}
                  className="w-full bg-[#2A211A] border border-[#40342B] rounded-lg px-3 py-2 text-sm text-[#EDE1D1] focus:outline-none focus:border-[#C99152]"
                />
              </div>
            </div>
          </section>

          {/* Column Filters Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#CBB9A7] text-xs font-semibold uppercase tracking-wider">
                Column Filters
                {draft.columnFilters.length > 0 && (
                  <span className="ml-1.5 text-[#9B8778] font-normal">
                    ({draft.columnFilters.length})
                  </span>
                )}
              </h3>
            </div>

            <div className="space-y-2">
              {draft.columnFilters.map((cf) => (
                <FilterRow
                  key={cf.id}
                  filter={cf}
                  filteredColumns={filteredColumns}
                  columnOptions={columnOptions}
                  onRemove={() => onRemoveColumnFilter(cf.id)}
                  onChange={(updates) => onUpdateColumnFilter(cf.id, updates)}
                />
              ))}
            </div>

            {/* Add Filter button */}
            <button
              onClick={() => {
                const defaultCol = addFilterColumns[0]
                if (defaultCol) {
                  onAddColumnFilter(defaultCol.name, defaultCol.type)
                }
              }}
              className="mt-2 flex items-center gap-1.5 text-sm text-[#C99152] hover:text-[#DBA860] transition-colors"
            >
              <Plus size={14} />
              Add Filter
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
