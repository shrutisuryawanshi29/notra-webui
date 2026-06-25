'use client'

import { Suspense, useEffect, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import { useFilters } from '@/hooks/use-filters'
import { NormalizedTransaction } from '@/types/transaction'
import { ColumnFilter } from '@/types/filters'
import TransactionList from '@/components/TransactionList'
import LoadingSpinner from '@/components/LoadingSpinner'
import FilterBar from '@/components/FilterBar'
import FilterSheet from '@/components/FilterSheet'
import { RefreshCw, Plus } from 'lucide-react'

function IncomePageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { state, loadData } = useCache()

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  const initialFilters = useMemo(() => {
    const monthFrom = searchParams?.get('monthFrom')
    const monthTo = searchParams?.get('monthTo')
    const category = searchParams?.get('category')

    const colFilters: ColumnFilter[] = []
    if (category) {
      colFilters.push({
        id: 'init_cat',
        columnName: 'Category',
        columnType: 'select',
        operator: 'equals',
        value: category,
      })
    }

    return {
      dateFrom: monthFrom || null,
      dateTo: monthTo || null,
      columnFilters: colFilters,
    }
  }, [searchParams])

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
  } = useFilters(state.incomes, 'income', initialFilters)

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
          <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight">Income</h1>
        </div>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight">Income</h1>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="text-[#B8A99A] hover:text-[#B8A99A] transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={18} />
          </button>
        <button
          onClick={() => router.push('/add?role=income')}
          className="bg-[#93B889] text-white p-2 rounded-lg hover:bg-[#8BB080] transition-colors"
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

export default function IncomePage() {
  return (
    <Suspense fallback={
      <div className="p-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight">Income</h1>
        </div>
        <LoadingSpinner />
      </div>
    }>
      <IncomePageContent />
    </Suspense>
  )
}
