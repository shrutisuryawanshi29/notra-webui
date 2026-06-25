'use client'

import Card from '@/components/Card'
import EmptyState from './EmptyState'
import { BiggestTransaction, formatCurrency, formatDate } from '@/lib/analytics'

interface BiggestTransactionsProps {
  biggestExpense: BiggestTransaction | null
  biggestIncome: BiggestTransaction | null
}

function BiggestTransactionCard({ type, data }: { type: 'expense' | 'income'; data: BiggestTransaction | null }) {
  const isExpense = type === 'expense'
  const dotColor = isExpense ? '#D8755D' : '#93B889'
  const title = isExpense ? 'Biggest Expense' : 'Biggest Income'

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dotColor }} />
        <h3 className="text-[#F4EDE3] text-sm font-semibold">{title}</h3>
      </div>
      {!data ? (
        <EmptyState title={isExpense ? 'No expenses yet' : 'No income yet'} />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 py-1">
            <span className="text-[#B8A99A] text-xs w-12">Title</span>
            <span className="text-[#F4EDE3] text-sm">{data.title}</span>
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="text-[#B8A99A] text-xs w-12">Category</span>
            <span className="text-[#F4EDE3] text-sm">{data.category ?? 'Uncategorized'}</span>
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="text-[#B8A99A] text-xs w-12">Amount</span>
            <span className="text-sm font-medium" style={{ color: dotColor }}>{formatCurrency(data.amount)}</span>
          </div>
          <div className="flex items-center gap-2 py-1">
            <span className="text-[#B8A99A] text-xs w-12">Date</span>
            <span className="text-[#F4EDE3] text-sm">{formatDate(data.date)}</span>
          </div>
        </div>
      )}
    </Card>
  )
}

export default function BiggestTransactions({ biggestExpense, biggestIncome }: BiggestTransactionsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <BiggestTransactionCard type="expense" data={biggestExpense} />
      <BiggestTransactionCard type="income" data={biggestIncome} />
    </div>
  )
}

BiggestTransactions.displayName = 'BiggestTransactions'
