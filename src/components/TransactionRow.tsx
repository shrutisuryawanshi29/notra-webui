import { NormalizedTransaction } from '@/types/transaction'
import { getSplitSubtitle } from '@/lib/split-metadata'
import Card from './Card'
import Chip from './Chip'
import { Pencil, Trash2 } from 'lucide-react'

interface TransactionRowProps {
  transaction: NormalizedTransaction
  onEdit?: (t: NormalizedTransaction) => void
  onDelete?: (t: NormalizedTransaction) => void
}

export default function TransactionRow({ transaction, onEdit, onDelete }: TransactionRowProps) {
  const isExpense = transaction.databaseRole === 'expense'
  const color = isExpense ? 'text-[#C7745A]' : 'text-[#8CA37D]'

  const subtitle = transaction.splitMetadata
    ? getSplitSubtitle(transaction.splitMetadata)
    : null

  return (
    <Card className="flex items-center justify-between group">
      <div className="flex-1 min-w-0">
        <p className="text-[#F4E9DA] text-sm font-medium truncate">
          {transaction.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {transaction.category && (
            <span className="text-[#9B8778] text-xs">{transaction.category}</span>
          )}
          {transaction.splitMetadata && (
            <Chip variant={transaction.splitMetadata.split.status === 'settled' ? 'settled' : 'pending'}>
              Split
            </Chip>
          )}
        </div>
        {subtitle && (
          <p className="text-[#CBB9A7] text-xs mt-0.5">{subtitle}</p>
        )}
        {transaction.paidAmount && (
          <p className="text-[#9B8778] text-xs mt-0.5">
            Paid: ${transaction.paidAmount.toFixed(2)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 ml-3">
        <div className="text-right">
          <p className={`${color} text-base font-semibold`}>
            {isExpense ? '-' : '+'}${transaction.amount.toFixed(2)}
          </p>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={() => onEdit(transaction)}
              className="p-1.5 text-[#9B8778] hover:text-[#CBB9A7] transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(transaction)}
              className="p-1.5 text-[#9B8778] hover:text-[#C7745A] transition-colors"
              title="Delete"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
    </Card>
  )
}
