'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { isSetupComplete, loadConfig, getExpenseConfig, getIncomeConfig, getExpenseMapping, getIncomeMapping } from '@/lib/config'
import { useCache } from '@/hooks/use-notra-cache'
import { safeExtractText } from '@/lib/notion-properties'
import { NormalizedTransaction } from '@/types/transaction'
import TransactionForm from '@/components/TransactionForm'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function EditPage() {
  const router = useRouter()
  const params = useParams()
  const { state } = useCache()
  const [transaction, setTransaction] = useState<NormalizedTransaction | null>(null)
  const [loading, setLoading] = useState(true)

  const cachedTransaction = useMemo(
    () => [...state.expenses, ...state.incomes].find(t => t.id === params.id),
    [state.expenses, state.incomes, params.id]
  )

  useEffect(() => {
    ;(async () => {
      if (!isSetupComplete()) {
        router.replace('/setup')
        return
      }

      const id = params.id as string
      if (cachedTransaction) {
        setTransaction(cachedTransaction)
        setLoading(false)
        return
      }

      const config = loadConfig()
      if (!config) return
      const expenseCfg = getExpenseConfig(config)
      const incomeCfg = getIncomeConfig(config)
      const expenseMapping = getExpenseMapping(config)
      const incomeMapping = getIncomeMapping(config)

      // Build relation lookups — try databases API first, then data sources API
      const buildRelationLookup = async (token: string, relationDbId: string): Promise<Record<string, string> | undefined> => {
        const extractLookup = (rows: Array<Record<string, unknown>>): Record<string, string> => {
          const lookup: Record<string, string> = {}
          for (const row of rows) {
            const props = (row.properties || {}) as Record<string, unknown>
            const titleProp = Object.values(props).find(
              (v: unknown) => (v as Record<string, unknown>).type === 'title'
            ) as Record<string, unknown> | undefined
            const name = safeExtractText(titleProp?.title).trim()
            if (name) lookup[row.id as string] = name
          }
          return lookup
        }

        try {
          const dbRes = await fetch('/api/notion/databases/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, databaseId: relationDbId }),
          })
          if (dbRes.ok) {
            const data = await dbRes.json()
            const lookup = extractLookup(data.results || [])
            if (Object.keys(lookup).length > 0) return lookup
          }
        } catch { /* fall through */ }

        try {
          const dsRes = await fetch('/api/notion/data-sources/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, dataSourceId: relationDbId }),
          })
          if (dsRes.ok) {
            const data = await dsRes.json()
            const lookup = extractLookup(data.results || [])
            if (Object.keys(lookup).length > 0) return lookup
          }
        } catch { /* fall through */ }
        return undefined
      }

      const expenseRelationDbId = expenseMapping?.columnMapping?.categoryRelationDataSourceId
      const incomeRelationDbId = incomeMapping?.columnMapping?.categoryRelationDataSourceId

      const expenseRelationLookup = expenseRelationDbId
        ? await buildRelationLookup(config.notionToken, expenseRelationDbId)
        : undefined
      const incomeRelationLookup = incomeRelationDbId
        ? await buildRelationLookup(config.notionToken, incomeRelationDbId)
        : undefined

      try {
        const expenseRes = await fetch(`/api/notion/databases/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: config.notionToken, databaseId: expenseCfg.databaseId }),
        })
        const expenseData = await expenseRes.json()
        const { normalizePageToTransaction } = await import('@/lib/notion-properties')
        const pages = [...(expenseData.results || [])]
        for (const p of pages) {
          if ((p as Record<string, unknown>).id === id) {
            const txn = normalizePageToTransaction(
              p as never, expenseCfg.databaseId, 'expense',
              {
                titleColumn: expenseCfg.titleColumn,
                amountColumn: expenseCfg.amountColumn,
                dateColumn: expenseCfg.dateColumn,
                categoryColumn: expenseCfg.categoryColumn || null,
                metadataColumn: expenseCfg.metadataColumn || null,
              },
              expenseRelationLookup
            )
            setTransaction(txn)
            setLoading(false)
            return
          }
        }
        const incomeRes = await fetch(`/api/notion/databases/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: config.notionToken, databaseId: incomeCfg.databaseId }),
        })
        const incomeData = await incomeRes.json()
        for (const p of (incomeData.results || [])) {
          if ((p as Record<string, unknown>).id === id) {
            const txn = normalizePageToTransaction(
              p as never, incomeCfg.databaseId, 'income',
              {
                titleColumn: incomeCfg.titleColumn,
                amountColumn: incomeCfg.amountColumn,
                dateColumn: incomeCfg.dateColumn,
                categoryColumn: incomeCfg.categoryColumn || null,
                metadataColumn: null,
              },
              incomeRelationLookup
            )
            setTransaction(txn)
            setLoading(false)
            return
          }
        }
        setLoading(false)
      } catch {
        setLoading(false)
      }
    })()
  }, [params.id, state.expenses, state.incomes, router])

  if (loading) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <h1 className="text-[#EDE1D1] text-2xl font-bold mb-6">Edit Transaction</h1>
        <LoadingSpinner />
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <h1 className="text-[#EDE1D1] text-2xl font-bold mb-6">Edit Transaction</h1>
        <p className="text-[#9B8778] text-sm">Transaction not found</p>
      </div>
    )
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[#EDE1D1] text-2xl font-bold">Edit Transaction</h1>
        <span className="text-[#9B8778] text-xs">{transaction.databaseRole === 'expense' ? 'Expense' : 'Income'}</span>
      </div>
      <TransactionForm existing={transaction} />
    </div>
  )
}
