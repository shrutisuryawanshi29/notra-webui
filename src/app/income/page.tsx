'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import { useFilters } from '@/hooks/use-filters'
import { NormalizedTransaction } from '@/types/transaction'
import TransactionList from '@/components/TransactionList'
import LoadingSpinner from '@/components/LoadingSpinner'
import FilterBar from '@/components/FilterBar'
import FilterSheet from '@/components/FilterSheet'
import { RefreshCw, Plus } from 'lucide-react'

export default function IncomePage() {
  const router = useRouter()
  const { state, loadData } = useCache()

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  const {
    draft,
    sheetOpen,
    active,
    result,
    activeCount,
    filteredColumns,
    columnOptions,
    openSheet,
    closeSheet,
    setDraft,
    applyFilters,
    clearAll,
    removeColumnFilter,
    removeActiveFilter,
    clearDateRange,
    addColumnFilter,
    updateColumnFilter,
    updateDateFrom,
    updateDateTo,
    updateSearch,
  } = useFilters(state.incomes, 'income')

  const relationLookup = useMemo(
    () => ({ ...(state.incomeRelationCategoryLookup || {}), ...(state.incomeMonthClassificationLookup || {}) }),
    [state.incomeRelationCategoryLookup, state.incomeMonthClassificationLookup],
  )

  const handleEdit = (t: NormalizedTransaction) => {
    router.push(`/edit/${t.id}`)
  }

  const handleDelete = async (t: NormalizedTransaction) => {
    if (!confirm(`Delete "${t.title}"?`)) return
    const config = (await import('@/lib/config')).loadConfig()
    if (!config) return
    try {
      await fetch(`/api/notion/pages/${t.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: config.notionToken }),
      })
      loadData()
    } catch {
      alert('Failed to delete')
    }
  }

  if (state.loading && state.incomes.length === 0) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[#EDE1D1] text-2xl font-bold">Income</h1>
        </div>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[#EDE1D1] text-2xl font-bold">Income</h1>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="text-[#9B8778] hover:text-[#CBB9A7] transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={18} />
          </button>
        <button
          onClick={() => router.push('/add?role=income')}
          className="bg-[#8CA37D] text-white p-2 rounded-lg hover:bg-[#7B9270] transition-colors"
          title="Add income"
        >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <FilterBar
        active={active}
        activeCount={activeCount}
        filteredTotal={result.total}
        totalCount={state.incomes.length}
        isFiltered={state.incomes.length !== result.filtered.length}
        resultCount={result.filtered.length}
        relationLookup={relationLookup}
        onSearchChange={updateSearch}
        onOpenSheet={openSheet}
        onRemoveColumnFilter={removeActiveFilter}
        onClearDateRange={clearDateRange}
      />

      <TransactionList
        transactions={result.filtered}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <FilterSheet
        open={sheetOpen}
        onClose={closeSheet}
        draft={draft}
        setDraft={setDraft}
        onApply={applyFilters}
        onClearAll={clearAll}
        onUpdateDateFrom={updateDateFrom}
        onUpdateDateTo={updateDateTo}
        onAddColumnFilter={addColumnFilter}
        onRemoveColumnFilter={removeColumnFilter}
        onUpdateColumnFilter={updateColumnFilter}
        filteredColumns={filteredColumns}
        columnOptions={columnOptions}
      />
    </div>
  )
}
