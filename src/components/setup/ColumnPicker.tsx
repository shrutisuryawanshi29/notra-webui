'use client'

import { useState } from 'react'

interface ColumnPickerProps {
  title: string
  options: string[]
  emptyMessage: string
  currentValue: string | null
  onSelect: (columnName: string | null) => void
  onClose: () => void
}

export default function ColumnPicker({
  title,
  options,
  emptyMessage,
  currentValue,
  onSelect,
  onClose,
}: ColumnPickerProps) {
  const [search, setSearch] = useState('')

  const filtered = search
    ? options.filter(o => o.toLowerCase().includes(search.toLowerCase()))
    : options

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-[#1F1712] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[70vh] flex flex-col border border-[#5A4638]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#5A4638]">
          <h3 className="text-[#2F2F35] text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#D49A4A] text-sm font-medium">
            Cancel
          </button>
        </div>

        <div className="px-4 py-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search columns..."
            className="w-full bg-[#FBF8F4] text-[#2F2F35] rounded-lg px-3 py-2 text-sm border border-[#5A4638] focus:outline-none focus:border-[#D49A4A] placeholder-[#6F6A73]"
          />
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-3">
          {currentValue && (
            <button
              onClick={() => { onSelect(null); onClose() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[#BA5A5A] text-sm hover:bg-[#FBF8F4] transition-colors"
            >
              <span>Clear selection</span>
            </button>
          )}

          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[#6F6A73] text-sm">No columns available</p>
              <p className="text-[#5C4D42] text-xs mt-1">{emptyMessage}</p>
            </div>
          ) : (
            filtered.map(name => (
              <button
                key={name}
                onClick={() => { onSelect(name); onClose() }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  currentValue === name
                    ? 'bg-[#D49A4A]/10 border border-[#D49A4A]'
                    : 'hover:bg-[#FBF8F4]'
                }`}
              >
                <span className="text-[#2F2F35] text-sm flex-1 truncate">{name}</span>
                {currentValue === name && (
                  <span className="text-[#D49A4A] text-xs">Selected</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
