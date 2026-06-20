'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback, ReactNode } from 'react'
import { NormalizedTransaction, GroupedTransactionSection } from '@/types/transaction'
import { groupTransactionsByDate } from '@/lib/notion-properties'
import { loadConfig, getExpenseConfig, getIncomeConfig, getExpenseMapping, getIncomeMapping } from '@/lib/config'

interface CacheState {
  expenses: NormalizedTransaction[]
  incomes: NormalizedTransaction[]
  groupedExpenses: GroupedTransactionSection[]
  groupedIncomes: GroupedTransactionSection[]
  loading: boolean
  error: string | null
}

type CacheAction =
  | { type: 'SET_EXPENSES'; payload: NormalizedTransaction[] }
  | { type: 'SET_INCOMES'; payload: NormalizedTransaction[] }
  | { type: 'ADD_EXPENSE'; payload: NormalizedTransaction }
  | { type: 'ADD_INCOME'; payload: NormalizedTransaction }
  | { type: 'UPDATE_EXPENSE'; payload: NormalizedTransaction }
  | { type: 'UPDATE_INCOME'; payload: NormalizedTransaction }
  | { type: 'DELETE_EXPENSE'; payload: string }
  | { type: 'DELETE_INCOME'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

const initialState: CacheState = {
  expenses: [],
  incomes: [],
  groupedExpenses: [],
  groupedIncomes: [],
  loading: false,
  error: null,
}

function cacheReducer(state: CacheState, action: CacheAction): CacheState {
  switch (action.type) {
    case 'SET_EXPENSES': {
      const grouped = groupTransactionsByDate(action.payload)
      return { ...state, expenses: action.payload, groupedExpenses: grouped }
    }
    case 'SET_INCOMES': {
      const grouped = groupTransactionsByDate(action.payload)
      return { ...state, incomes: action.payload, groupedIncomes: grouped }
    }
    case 'ADD_EXPENSE': {
      const updated = [action.payload, ...state.expenses]
      return { ...state, expenses: updated, groupedExpenses: groupTransactionsByDate(updated) }
    }
    case 'ADD_INCOME': {
      const updated = [action.payload, ...state.incomes]
      return { ...state, incomes: updated, groupedIncomes: groupTransactionsByDate(updated) }
    }
    case 'UPDATE_EXPENSE': {
      const updated = state.expenses.map(e => e.id === action.payload.id ? action.payload : e)
      return { ...state, expenses: updated, groupedExpenses: groupTransactionsByDate(updated) }
    }
    case 'UPDATE_INCOME': {
      const updated = state.incomes.map(e => e.id === action.payload.id ? action.payload : e)
      return { ...state, incomes: updated, groupedIncomes: groupTransactionsByDate(updated) }
    }
    case 'DELETE_EXPENSE': {
      const updated = state.expenses.filter(e => e.id !== action.payload)
      return { ...state, expenses: updated, groupedExpenses: groupTransactionsByDate(updated) }
    }
    case 'DELETE_INCOME': {
      const updated = state.incomes.filter(e => e.id !== action.payload)
      return { ...state, incomes: updated, groupedIncomes: groupTransactionsByDate(updated) }
    }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_ERROR':
      return { ...state, error: action.payload }
    default:
      return state
  }
}

interface CacheContextValue {
  state: CacheState
  dispatch: React.Dispatch<CacheAction>
  loadData: () => Promise<void>
}

const CacheContext = createContext<CacheContextValue | null>(null)

export function CacheProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cacheReducer, initialState)

  const loadData = useCallback(async () => {
    const config = loadConfig()
    if (!config) return

    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const token = config.notionToken
      const expenseCfg = getExpenseConfig(config)
      const incomeCfg = getIncomeConfig(config)

      // Build relation category lookup if needed
      const expenseMapping = getExpenseMapping(config)
      const incomeMapping = getIncomeMapping(config)
      const relationDbId = expenseMapping?.columnMapping?.categoryRelationDataSourceId
        || incomeMapping?.columnMapping?.categoryRelationDataSourceId

      let relationCategoryLookup: Record<string, string> | undefined
      if (relationDbId) {
        try {
          const lookupRes = await fetch('/api/notion/databases/query', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, databaseId: relationDbId }),
          })
          if (lookupRes.ok) {
            const lookupData = await lookupRes.json()
            const { normalizePageToTransaction: norm } = await import('@/lib/notion-properties')
            relationCategoryLookup = {}
            for (const row of (lookupData.results || []) as Array<Record<string, unknown>>) {
              const props = (row.properties || {}) as Record<string, unknown>
              const titleProp = Object.values(props).find(
                (v: unknown) => (v as Record<string, unknown>).type === 'title'
              ) as Record<string, unknown> | undefined
              const titleArr = titleProp?.title as Array<{ plain_text: string }> | undefined
              const name = titleArr?.map(t => t.plain_text).join('').trim()
              if (name) {
                relationCategoryLookup[row.id as string] = name
              }
            }
          }
        } catch {
          // non-critical: relation categories won't resolve
        }
      }

      if (expenseCfg.databaseId) {
        const expenseRes = await fetch('/api/notion/databases/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            databaseId: expenseCfg.databaseId,
          }),
        })
        if (expenseRes.ok) {
          const expenseData = await expenseRes.json()
          const { normalizePageToTransaction } = await import('@/lib/notion-properties')
          const transactions = (expenseData.results as Array<Record<string, unknown>>).map(
            (page: Record<string, unknown>) =>
              normalizePageToTransaction(
                page as never,
                expenseCfg.databaseId,
                'expense',
                {
                  titleColumn: expenseCfg.titleColumn,
                  amountColumn: expenseCfg.amountColumn,
                  dateColumn: expenseCfg.dateColumn,
                  categoryColumn: expenseCfg.categoryColumn || null,
                  metadataColumn: expenseCfg.metadataColumn || null,
                },
                relationCategoryLookup
              )
          )
          dispatch({ type: 'SET_EXPENSES', payload: transactions })
        }
      }

      if (incomeCfg.databaseId) {
        const incomeRes = await fetch('/api/notion/databases/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token,
            databaseId: incomeCfg.databaseId,
          }),
        })
        if (incomeRes.ok) {
          const incomeData = await incomeRes.json()
          const { normalizePageToTransaction } = await import('@/lib/notion-properties')
          const transactions = (incomeData.results as Array<Record<string, unknown>>).map(
            (page: Record<string, unknown>) =>
              normalizePageToTransaction(
                page as never,
                incomeCfg.databaseId,
                'income',
                {
                  titleColumn: incomeCfg.titleColumn,
                  amountColumn: incomeCfg.amountColumn,
                  dateColumn: incomeCfg.dateColumn,
                  categoryColumn: incomeCfg.categoryColumn || null,
                  metadataColumn: null,
                },
                relationCategoryLookup
              )
          )
          dispatch({ type: 'SET_INCOMES', payload: transactions })
        }
      }
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to load data from Notion' })
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false })
    }
  }, [])

  useEffect(() => {
    if (loadConfig()) {
      loadData()
    }
  }, [loadData])

  return (
    <CacheContext.Provider value={{ state, dispatch, loadData }}>
      {children}
    </CacheContext.Provider>
  )
}

export function useCache() {
  const ctx = useContext(CacheContext)
  if (!ctx) throw new Error('useCache must be used within CacheProvider')
  return ctx
}

export type { CacheAction }
