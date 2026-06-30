'use client'

import { X, Plus } from 'lucide-react'
import { ColumnFilter, FilterDraft, FilterableColumn, FilterOperator, FilterOption } from '@/types/filters'
import { operatorsForType } from '@/lib/filter-engine'
import StyledSelect from '@/components/StyledSelect'

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
    <div className="bg-[#403027] border border-[#6B5847] rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2">
        {/* Column picker */}
        <StyledSelect
          value={filter.columnName}
          onChange={(val) => {
            const col = filteredColumns.find((c) => c.name === val)
            const columnType = col?.type || 'rich_text'
            const ops2 = operatorsForType(columnType)
            onChange({
              columnName: val,
              columnType,
              operator: ops2[0]?.value || 'equals',
              value: '',
            })
          }}
          options={filteredColumns.map(col => ({ value: col.name, label: col.label }))}
          className="flex-1"
        />

        {/* Condition picker */}
        <StyledSelect
          value={filter.operator}
          onChange={(val) => onChange({ operator: val as FilterOperator })}
          options={ops.map(op => ({ value: op.value, label: op.label }))}
        />

        {/* Remove button */}
        <button
          onClick={onRemove}
          className="text-[#B8A99A] hover:text-[#D8755D] transition-colors p-1"
        >
          <X size={16} />
        </button>
      </div>

      {/* Value input */}
      {options && options.length > 0 ? (
        <StyledSelect
          value={filter.value}
          onChange={(val) => onChange({ value: val })}
          options={options.map(opt => ({ value: opt.value, label: opt.label }))}
          placeholder={`Select ${filter.columnName.toLowerCase()}...`}
        />
      ) : filter.columnType === 'number' ? (
        <input
          type="number"
          value={filter.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Enter value..."
          className="w-full bg-[#35281F] border border-[#6B5847] rounded px-2 py-1.5 text-sm text-[#F4EDE3] placeholder-[#9B8778] focus:outline-none focus:border-[#D49A4A]"
        />
      ) : (
        <input
          type="text"
          value={filter.value}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder="Enter value..."
          className="w-full bg-[#35281F] border border-[#6B5847] rounded px-2 py-1.5 text-sm text-[#F4EDE3] placeholder-[#9B8778] focus:outline-none focus:border-[#D49A4A]"
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
      <div className="relative w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] bg-[#35281F] border border-[#6B5847] rounded-t-2xl sm:rounded-2xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#6B5847] shrink-0">
          <button
            onClick={onClearAll}
            className="text-sm text-[#D8755D] hover:text-[#D8755D] transition-colors"
          >
            Clear All
          </button>
          <h2 className="text-[#F4EDE3] text-base font-semibold">Filters</h2>
          <button
            onClick={onApply}
            className="text-sm text-[#D49A4A] hover:text-[#D49A4A] font-semibold transition-colors"
          >
            Apply
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          {/* Date Range Section */}
          <section>
            <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider mb-3">
              Date Range
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#B8A99A] text-xs mb-1">From</label>
                <input
                  type="date"
                  value={draft.dateFrom || ''}
                  onChange={(e) => onUpdateDateFrom(e.target.value || null)}
                  className="w-full bg-[#403027] border border-[#6B5847] rounded-lg px-3 py-2 text-sm text-[#F4EDE3] focus:outline-none focus:border-[#D49A4A]"
                />
              </div>
              <div>
                <label className="block text-[#B8A99A] text-xs mb-1">To</label>
                <input
                  type="date"
                  value={draft.dateTo || ''}
                  onChange={(e) => onUpdateDateTo(e.target.value || null)}
                  className="w-full bg-[#403027] border border-[#6B5847] rounded-lg px-3 py-2 text-sm text-[#F4EDE3] focus:outline-none focus:border-[#D49A4A]"
                />
              </div>
            </div>
          </section>

          {/* Column Filters Section */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[#B8A99A] text-xs font-semibold uppercase tracking-wider">
                Column Filters
                {draft.columnFilters.length > 0 && (
                  <span className="ml-1.5 text-[#B8A99A] font-normal">
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
              className="mt-2 flex items-center gap-1.5 text-sm text-[#D49A4A] hover:text-[#D49A4A] transition-colors"
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
