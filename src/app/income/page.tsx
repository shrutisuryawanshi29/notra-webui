'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import { NormalizedTransaction } from '@/types/transaction'
import TransactionList from '@/components/TransactionList'
import LoadingSpinner from '@/components/LoadingSpinner'
import { RefreshCw, Plus } from 'lucide-react'

export default function IncomePage() {
  const router = useRouter()
  const { state, loadData } = useCache()

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

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
            onClick={() => router.push('/add')}
            className="bg-[#8CA37D] text-white p-2 rounded-lg hover:bg-[#7B9270] transition-colors"
            title="Add income"
          >
            <Plus size={18} />
          </button>
        </div>
      </div>

      <p className="text-[#9B8778] text-xs mb-4">
        {state.incomes.length} transaction{state.incomes.length !== 1 ? 's' : ''}
      </p>

      <TransactionList
        transactions={state.incomes}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  )
}
