import { NormalizedTransaction } from '@/types/transaction'
import { getSplitSubtitle } from '@/lib/split-metadata'
import Card from './Card'
import { ChevronRight, Pencil, Trash2 } from 'lucide-react'

interface TransactionRowProps {
  transaction: NormalizedTransaction
  onEdit?: (t: NormalizedTransaction) => void
  onDelete?: (t: NormalizedTransaction) => void
  onView?: (t: NormalizedTransaction) => void
}

const SPLIT_COLORS = { pending: '#D49A4A', settled: '#93B889' }

export default function TransactionRow({ transaction, onEdit, onDelete, onView }: TransactionRowProps) {
  const isExpense = transaction.databaseRole === 'expense'
  const accentColor = isExpense ? '#D8755D' : '#93B889'
  const color = isExpense ? 'text-[#D8755D]' : 'text-[#93B889]'

  const subtitle = transaction.splitMetadata
    ? getSplitSubtitle(transaction.splitMetadata)
    : null

  const splitStatus = transaction.splitMetadata?.split.status
  const splitColor = splitStatus ? SPLIT_COLORS[splitStatus] : null

  return (
    <Card
      className="flex items-center justify-between group"
      onClick={onView ? () => onView(transaction) : undefined}
    >
      <div className="flex-1 min-w-0">
        <p className="text-[#F4EDE3] text-sm font-medium truncate">
          {transaction.title}
        </p>
        <div className="flex items-center gap-2 mt-1">
          {transaction.category && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold text-white"
              style={{ backgroundColor: accentColor }}
            >
              {transaction.category}
            </span>
          )}
          {splitColor && (
            <span
              className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: `${splitColor}20`, color: splitColor }}
            >
              Split
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[#B8A99A] text-xs mt-0.5">{subtitle}</p>
        )}
        {transaction.paidAmount && (
          <p className="text-[#B8A99A] text-xs mt-0.5">
            Paid: ${transaction.paidAmount.toFixed(2)}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 ml-3">
        <div className="text-right">
          <p className={`${color} text-base font-semibold tracking-tight`}>
            {isExpense ? '-' : '+'}${transaction.amount.toFixed(2)}
          </p>
        </div>
        {onView && (
          <ChevronRight size={14} className="text-[#5A4638] group-hover:text-[#9B8778] transition-colors shrink-0" />
        )}
        <div className="flex gap-1.5">
          {onEdit && (
            <button
              onClick={() => onEdit(transaction)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#D49A4A] text-white hover:bg-[#C1883A] transition-colors"
              title="Edit"
            >
              <Pencil size={14} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(transaction)}
              className="w-8 h-8 rounded-full flex items-center justify-center bg-[#D8755D] text-white hover:bg-[#B05E4A] transition-colors"
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
