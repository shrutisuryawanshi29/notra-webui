import { NormalizedTransaction } from '@/types/transaction'
import { getSplitSubtitle } from '@/lib/split-metadata'
import Card from './Card'
import { Pencil, Trash2 } from 'lucide-react'

interface TransactionRowProps {
  transaction: NormalizedTransaction
  onEdit?: (t: NormalizedTransaction) => void
  onDelete?: (t: NormalizedTransaction) => void
}

const SPLIT_COLORS = { pending: '#C49A5A', settled: '#8CA37D' }

export default function TransactionRow({ transaction, onEdit, onDelete }: TransactionRowProps) {
  const isExpense = transaction.databaseRole === 'expense'
  const accentColor = isExpense ? '#C7745A' : '#8CA37D'
  const color = isExpense ? 'text-[#C7745A]' : 'text-[#8CA37D]'

  const subtitle = transaction.splitMetadata
    ? getSplitSubtitle(transaction.splitMetadata)
    : null

  const splitStatus = transaction.splitMetadata?.split.status
  const splitColor = splitStatus ? SPLIT_COLORS[splitStatus] : null

  return (
    <Card className="flex items-center justify-between group">
      <div className="flex-1 min-w-0">
        <p className="text-[#F4E9DA] text-sm font-medium truncate">
          {transaction.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {transaction.category && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
              style={{ backgroundColor: accentColor }}
            >
              {transaction.category}
            </span>
          )}
          {splitColor && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: `${splitColor}20`, color: splitColor }}
            >
              Split
            </span>
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
        <div className="flex gap-1.5">
          {onEdit && (
            <button
              onClick={() => onEdit(transaction)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#C99152] text-white hover:bg-[#DBA860] transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(transaction)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#C7745A] text-white hover:bg-[#E0876A] transition-colors"
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
