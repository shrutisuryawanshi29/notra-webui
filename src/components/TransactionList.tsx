import { NormalizedTransaction } from '@/types/transaction'
import { groupTransactionsByDate } from '@/lib/notion-properties'
import TransactionRow from './TransactionRow'

interface TransactionListProps {
  transactions: NormalizedTransaction[]
  title?: string
  onEdit?: (t: NormalizedTransaction) => void
  onDelete?: (t: NormalizedTransaction) => void
}

export default function TransactionList({ transactions, title, onEdit, onDelete }: TransactionListProps) {
  const groups = groupTransactionsByDate(transactions)

  if (groups.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#9B8778] text-sm">No transactions found</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {groups.map((group) => (
        <div key={group.date}>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-[#CBB9A7] text-sm font-medium">{group.displayDate}</h3>
            <span className="text-[#CBB9A7] text-xs">
              ${group.totalAmount.toFixed(2)}
            </span>
          </div>
          <div className="space-y-2">
            {group.transactions.map((t) => (
              <TransactionRow
                key={t.id}
                transaction={t}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
