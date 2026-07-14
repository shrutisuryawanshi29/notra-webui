'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import { useFilters } from '@/hooks/use-filters'
import { NormalizedTransaction } from '@/types/transaction'
import { ColumnFilter } from '@/types/filters'
import TransactionList from '@/components/TransactionList'
import TransactionDetailModal from '@/components/TransactionDetailModal'
import LoadingSpinner from '@/components/LoadingSpinner'
import FilterBar from '@/components/FilterBar'
import FilterSheet from '@/components/FilterSheet'
import { RefreshCw, Plus } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toast from '@/components/Toast'

function ExpensesPageContent() {
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
  } = useFilters(state.expenses, 'expense', initialFilters)

  const relationLookup = useMemo(
    () => ({ ...(state.expenseRelationCategoryLookup || {}), ...(state.expenseMonthClassificationLookup || {}) }),
    [state.expenseRelationCategoryLookup, state.expenseMonthClassificationLookup],
  )

  const [deleteTarget, setDeleteTarget] = useState<NormalizedTransaction | null>(null)
  const [detailTarget, setDetailTarget] = useState<NormalizedTransaction | null>(null)
  const [errorToast, setErrorToast] = useState('')

  const handleEdit = (t: NormalizedTransaction) => {
    router.push(`/edit/${t.id}`)
  }

  const handleDelete = async (t: NormalizedTransaction) => {
    setDeleteTarget(t)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    const config = (await import('@/lib/config')).loadConfig()
    if (!config) return
    setDeleteTarget(null)
    try {
      await fetch(`/api/notion/pages/${deleteTarget.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: config.notionToken }),
      })
      loadData()
    } catch {
      setErrorToast('Failed to delete')
    }
  }

  if (state.loading && state.expenses.length === 0) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight">Expenses</h1>
        </div>
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight">Expenses</h1>
        <div className="flex gap-2">
          <button
            onClick={loadData}
            className="text-[#B8A99A] hover:text-[#B8A99A] transition-colors"
            title="Refresh data"
          >
            <RefreshCw size={18} />
          </button>
        <button
          onClick={() => router.push('/add?role=expense')}
          className="bg-[#D8755D] text-white p-2 rounded-lg hover:bg-[#C96852] transition-colors"
          title="Add expense"
        >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <FilterBar
        active={active}
        activeCount={activeCount}
        filteredTotal={result.total}
        totalCount={state.expenses.length}
        isFiltered={state.expenses.length !== result.filtered.length}
        resultCount={result.filtered.length}
        relationLookup={relationLookup}
        onSearchChange={updateSearch}
        onOpenSheet={openSheet}
        onRemoveColumnFilter={removeActiveFilter}
        onClearDateRange={clearDateRange}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete expense"
        message={deleteTarget ? `Are you sure you want to delete "${deleteTarget.title}"? This action cannot be undone.` : ''}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <Toast open={!!errorToast} message={errorToast} onClose={() => setErrorToast('')} />

      <TransactionList
        transactions={result.filtered}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onView={setDetailTarget}
      />

      <TransactionDetailModal
        open={!!detailTarget}
        transaction={detailTarget}
        onClose={() => setDetailTarget(null)}
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

export default function ExpensesPage() {
  return (
    <Suspense fallback={
      <div className="p-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight">Expenses</h1>
        </div>
        <LoadingSpinner />
      </div>
    }>
      <ExpensesPageContent />
    </Suspense>
  )
}
