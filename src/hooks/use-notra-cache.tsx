'use client'

import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef, ReactNode } from 'react'
import { NormalizedTransaction, GroupedTransactionSection } from '@/types/transaction'
import { groupTransactionsByDate, safeExtractText } from '@/lib/notion-properties'
import { loadConfig, getExpenseConfig, getIncomeConfig, getExpenseMapping, getIncomeMapping } from '@/lib/config'

interface CacheState {
  expenses: NormalizedTransaction[]
  incomes: NormalizedTransaction[]
  groupedExpenses: GroupedTransactionSection[]
  groupedIncomes: GroupedTransactionSection[]
  loading: boolean
  error: string | null
  expenseRelationCategoryLookup: Record<string, string> | null
  incomeRelationCategoryLookup: Record<string, string> | null
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
  | { type: 'SET_EXPENSE_RELATION_LOOKUP'; payload: Record<string, string> | null }
  | { type: 'SET_INCOME_RELATION_LOOKUP'; payload: Record<string, string> | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }

const initialState: CacheState = {
  expenses: [],
  incomes: [],
  groupedExpenses: [],
  groupedIncomes: [],
  loading: false,
  error: null,
  expenseRelationCategoryLookup: null,
  incomeRelationCategoryLookup: null,
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
    case 'SET_EXPENSE_RELATION_LOOKUP':
      return { ...state, expenseRelationCategoryLookup: action.payload }
    case 'SET_INCOME_RELATION_LOOKUP':
      return { ...state, incomeRelationCategoryLookup: action.payload }
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

  const buildRelationLookup = async (
    token: string,
    role: string,
    relationDbId: string
  ): Promise<Record<string, string> | null> => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Category] lookup: building for ${role} with relationDbId=${relationDbId}`)
    }

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

    // Try 1: Query via Notion Databases API (works for database_id)
    try {
      const dbRes = await fetch('/api/notion/databases/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, databaseId: relationDbId }),
      })
      if (dbRes.ok) {
        const data = await dbRes.json()
        const lookup = extractLookup(data.results || [])
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Category] lookup: fetched ${data.results?.length || 0} rows via databases API, cached ${Object.keys(lookup).length} names`)
        }
        if (Object.keys(lookup).length > 0) return lookup
      }
    } catch {
      // fall through to data source query
    }

    // Try 2: Query via Notion Data Sources API (works for data_source_id)
    try {
      const dsRes = await fetch('/api/notion/data-sources/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, dataSourceId: relationDbId }),
      })
      if (dsRes.ok) {
        const data = await dsRes.json()
        const lookup = extractLookup(data.results || [])
        if (process.env.NODE_ENV === 'development') {
          console.log(`[Category] lookup: fetched ${data.results?.length || 0} rows via data sources API, cached ${Object.keys(lookup).length} names`)
        }
        if (Object.keys(lookup).length > 0) return lookup
      }
    } catch {
      // non-critical: relation categories won't resolve
    }

    if (process.env.NODE_ENV === 'development') {
      console.log(`[Category] lookup: FAILED for ${role} with relationDbId=${relationDbId}`)
    }
    return null
  }

  const loadData = useCallback(async () => {
    const config = loadConfig()
    if (!config) return

    dispatch({ type: 'SET_LOADING', payload: true })
    dispatch({ type: 'SET_ERROR', payload: null })

    try {
      const token = config.notionToken
      const expenseCfg = getExpenseConfig(config)
      const incomeCfg = getIncomeConfig(config)
      const expenseMapping = getExpenseMapping(config)
      const incomeMapping = getIncomeMapping(config)

      // Build separate relation lookups per role, cache them in state
      const expenseRelationDbId = expenseMapping?.columnMapping?.categoryRelationDataSourceId
      let expenseRelationCategoryLookup = state.expenseRelationCategoryLookup
      if (expenseRelationDbId && !expenseRelationCategoryLookup) {
        expenseRelationCategoryLookup = await buildRelationLookup(token, 'expense', expenseRelationDbId)
        dispatch({ type: 'SET_EXPENSE_RELATION_LOOKUP', payload: expenseRelationCategoryLookup })
      }

      const incomeRelationDbId = incomeMapping?.columnMapping?.categoryRelationDataSourceId
      let incomeRelationCategoryLookup = state.incomeRelationCategoryLookup
      if (incomeRelationDbId && !incomeRelationCategoryLookup) {
        incomeRelationCategoryLookup = await buildRelationLookup(token, 'income', incomeRelationDbId)
        dispatch({ type: 'SET_INCOME_RELATION_LOOKUP', payload: incomeRelationCategoryLookup })
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
                expenseRelationCategoryLookup ?? undefined
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
                incomeRelationCategoryLookup ?? undefined
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
  }, [state.expenseRelationCategoryLookup, state.incomeRelationCategoryLookup])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Retry once if config appears after initial mount (setup→dashboard redirect).
  // The initial loadData() may have returned early because config didn't exist yet.
  const retriedRef = useRef(false)

  useEffect(() => {
    if (retriedRef.current) return
    if (state.loading) return
    if (state.expenses.length > 0 || state.incomes.length > 0) return
    const cfg = loadConfig()
    if (!cfg) return
    retriedRef.current = true
    loadData()
  })

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
