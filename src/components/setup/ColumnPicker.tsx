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
      <div className="relative bg-[#2B241E] w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[70vh] flex flex-col border border-[#4C4036]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#4C4036]">
          <h3 className="text-[#F4E9DA] text-sm font-semibold">{title}</h3>
          <button onClick={onClose} className="text-[#C99152] text-sm font-medium">
            Cancel
          </button>
        </div>

        <div className="px-4 py-2">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search columns..."
            className="w-full bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152] placeholder-[#9B8778]"
          />
        </div>

        <div className="overflow-y-auto flex-1 px-2 pb-3">
          {currentValue && (
            <button
              onClick={() => { onSelect(null); onClose() }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left text-[#C7745A] text-sm hover:bg-[#40342B] transition-colors"
            >
              <span>Clear selection</span>
            </button>
          )}

          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <p className="text-[#9B8778] text-sm">No columns available</p>
              <p className="text-[#5C4D42] text-xs mt-1">{emptyMessage}</p>
            </div>
          ) : (
            filtered.map(name => (
              <button
                key={name}
                onClick={() => { onSelect(name); onClose() }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  currentValue === name
                    ? 'bg-[#C99152]/10 border border-[#C99152]'
                    : 'hover:bg-[#40342B]'
                }`}
              >
                <span className="text-[#F4E9DA] text-sm flex-1 truncate">{name}</span>
                {currentValue === name && (
                  <span className="text-[#C99152] text-xs">Selected</span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
