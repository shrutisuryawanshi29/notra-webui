'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { NormalizedTransaction, SplitPerson } from '@/types/transaction'
import { loadConfig, getExpenseConfig, getIncomeConfig, getExpenseMapping, getIncomeMapping } from '@/lib/config'
import { stablePersonId } from '@/lib/notion-properties'
import {
  calculateSplit,
  inferMethodFromType,
  legacyTypeToMethod,
  SplitMethodType,
  ManualSplitInput,
} from '@/lib/split-calc'
import { buildNotionProperties, buildSplitDetailsJson } from '@/lib/notion-payload'
import Card from '@/components/Card'
import Chip from '@/components/Chip'

interface TransactionFormProps {
  existing?: NormalizedTransaction
}

interface SplitCalcState {
  myShare: number
  theyOwe: number
  participants: Array<{ id: string; name: string; owes: number }>
}

export default function TransactionForm({ existing }: TransactionFormProps) {
  const router = useRouter()
  const isEdit = !!existing

  const [role, setRole] = useState<'expense' | 'income'>(existing?.databaseRole || 'expense')
  const [title, setTitle] = useState(existing?.title || '')
  const [amount, setAmount] = useState(() => {
    if (!existing) return ''
    if (existing.splitMetadata?.split.enabled) {
      return String(existing.splitMetadata.split.paidAmount)
    }
    return String(existing.amount)
  })
  const [date, setDate] = useState(existing?.date || new Date().toISOString().split('T')[0])
  const [category, setCategory] = useState(existing?.category || '')

  const [isSplit, setIsSplit] = useState(!!existing?.splitMetadata?.split.enabled)
  const [people, setPeople] = useState<SplitPerson[]>(() => {
    if (existing?.splitMetadata?.split.enabled) {
      return existing.splitMetadata.split.participants.map(p => ({
        id: p.id,
        name: p.name,
      }))
    }
    return []
  })
  const [newPersonName, setNewPersonName] = useState('')

  const [splitMethod, setSplitMethod] = useState<SplitMethodType>(() => {
    if (existing?.splitMetadata?.split.enabled) {
      return inferMethodFromType(existing.splitMetadata.split.type)
    }
    return 'equal'
  })

  const [percentMode, setPercentMode] = useState<'myPercent' | 'theirPercent'>('myPercent')
  const [myPercent, setMyPercent] = useState(() => {
    const inp = existing?.splitMetadata?.split.inputs
    return inp && typeof inp.myPercent === 'number' ? String(inp.myPercent) : ''
  })
  const [theirPercent, setTheirPercent] = useState(() => {
    const inp = existing?.splitMetadata?.split.inputs
    return inp && typeof inp.theirPercent === 'number' ? String(inp.theirPercent) : ''
  })

  const [exactMode, setExactMode] = useState<'theyOwe' | 'myShare'>(
    () => (existing?.splitMetadata?.split.inputs?.entryMode as 'theyOwe' | 'myShare') || 'theyOwe'
  )
  const [customAmount, setCustomAmount] = useState(() => {
    const inp = existing?.splitMetadata?.split.inputs
    return inp && typeof inp.customAmount === 'number' ? String(inp.customAmount) : ''
  })

  const [hhsMode, setHhsMode] = useState<'iPayExtra' | 'extraTheyPay'>(
    () => (existing?.splitMetadata?.split.inputs?.entryMode as 'iPayExtra' | 'extraTheyPay') || 'iPayExtra'
  )
  const [extraAmount, setExtraAmount] = useState(() => {
    const inp = existing?.splitMetadata?.split.inputs
    return inp && typeof inp.extraAmount === 'number' ? String(inp.extraAmount) : ''
  })

  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const paidAmount = parseFloat(amount) || 0

  const splitInput: ManualSplitInput = useMemo(() => ({
    paidAmount,
    selectedPeople: people,
  }), [paidAmount, people])

  const splitExtra = useMemo(() => {
    switch (splitMethod) {
      case 'percent':
        return {
          entryMode: percentMode,
          myPercent: parseFloat(myPercent) || 0,
          theirPercent: parseFloat(theirPercent) || 0,
        }
      case 'exact':
        return {
          entryMode: exactMode,
          customAmount: parseFloat(customAmount) || 0,
        }
      case 'hhs':
        return {
          entryMode: hhsMode,
          extraAmount: parseFloat(extraAmount) || 0,
        }
      default:
        return {}
    }
  }, [splitMethod, percentMode, myPercent, theirPercent, exactMode, customAmount, hhsMode, extraAmount])

  const splitResult = useMemo<SplitCalcState>(() => {
    if (!isSplit || people.length === 0 || paidAmount <= 0) {
      return { myShare: 0, theyOwe: 0, participants: [] }
    }
    return calculateSplit(splitMethod, splitInput, splitExtra as Record<string, unknown>)
  }, [isSplit, splitMethod, splitInput, splitExtra, people.length, paidAmount])

  const notionAmount = isSplit ? splitResult.myShare : paidAmount

  const addPerson = useCallback(() => {
    const name = newPersonName.trim()
    if (!name) return
    const id = stablePersonId(name)
    if (people.some(p => p.id === id)) return
    setPeople(prev => [...prev, { id, name }])
    setNewPersonName('')
  }, [newPersonName, people])

  const removePerson = useCallback((id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id))
  }, [])

  const handleSubmit = async () => {
    const config = loadConfig()
    if (!config) return
    const expenseCfg = getExpenseConfig(config)
    const incomeCfg = getIncomeConfig(config)

    setSaving(true)
    try {
      let splitMetadata = null
      let finalAmount = parseFloat(amount) || 0

      if (isSplit && people.length > 0) {
        splitMetadata = buildSplitDetailsJson(
          paidAmount,
          splitResult.myShare,
          splitResult.theyOwe,
          legacyTypeToMethod(splitMethod),
          splitResult.participants,
          splitExtra as Record<string, unknown>
        )
        finalAmount = splitResult.myShare
      }

      const mapping = role === 'expense' ? getExpenseMapping(config) : getIncomeMapping(config)
      const categoryType = mapping?.categoryType
      const properties = buildNotionProperties(config, role, {
        title: title || `${role === 'expense' ? 'Expense' : 'Income'} - ${date}`,
        amount: finalAmount,
        date,
        category: category || null,
        splitMetadata,
      }, categoryType)

      if (isEdit && existing) {
        const res = await fetch(`/api/notion/pages/${existing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: config.notionToken, properties }),
        })
        if (!res.ok) throw new Error('Failed to update')
      } else {
        const res = await fetch('/api/notion/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: config.notionToken,
            databaseId: role === 'expense' ? expenseCfg.databaseId : incomeCfg.databaseId,
            properties,
          }),
        })
        if (!res.ok) throw new Error('Failed to create')
      }

      router.push(role === 'expense' ? '/expenses' : '/income')
    } catch (e) {
      alert('Failed to save transaction')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    const config = loadConfig()
    if (!config || !existing) return

    setSaving(true)
    try {
      const res = await fetch(`/api/notion/pages/${existing.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: config.notionToken }),
      })
      if (!res.ok) throw new Error('Failed to delete')
      router.push(existing.databaseRole === 'expense' ? '/expenses' : '/income')
    } catch {
      alert('Failed to delete transaction')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <Card className="p-6 space-y-5">
        {!isEdit && (
          <div>
            <label className="text-[#CBB9A7] text-xs font-medium block mb-2">Type</label>
            <div className="flex gap-2">
              <button
                onClick={() => { setRole('expense'); setIsSplit(false) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  role === 'expense'
                    ? 'bg-[#C7745A] text-white'
                    : 'bg-[#40342B] text-[#9B8778]'
                }`}
              >
                Expense
              </button>
              <button
                onClick={() => { setRole('income'); setIsSplit(false) }}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  role === 'income'
                    ? 'bg-[#8CA37D] text-white'
                    : 'bg-[#40342B] text-[#9B8778]'
                }`}
              >
                Income
              </button>
            </div>
          </div>
        )}

        <div>
          <label className="text-[#CBB9A7] text-xs font-medium block mb-1.5">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={role === 'expense' ? 'Lunch at Cafe' : 'Freelance Payment'}
            className="w-full bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2.5 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152] placeholder-[#9B8778]"
          />
        </div>

        <div>
          <label className="text-[#CBB9A7] text-xs font-medium block mb-1.5">
            Amount {isSplit ? '(paid amount)' : ''}
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2.5 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152] placeholder-[#9B8778]"
          />
          {isSplit && people.length > 0 && paidAmount > 0 && (
            <div className="mt-2 space-y-1 text-xs">
              <p className="text-[#8CA37D]">My share: ${splitResult.myShare.toFixed(2)}</p>
              <p className="text-[#C7745A]">They owe: ${splitResult.theyOwe.toFixed(2)}</p>
              {splitResult.participants.map(p => (
                <p key={p.id} className="text-[#9B8778] pl-3">
                  {p.name}: ${p.owes.toFixed(2)}
                </p>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="text-[#CBB9A7] text-xs font-medium block mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="w-full bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2.5 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152]"
          />
        </div>

        <div>
          <label className="text-[#CBB9A7] text-xs font-medium block mb-1.5">Category</label>
          <input
            type="text"
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="e.g. Food, Transport"
            className="w-full bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2.5 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152] placeholder-[#9B8778]"
          />
        </div>

        {role === 'expense' && (
          <>
            <div className="border-t border-[#4C4036] pt-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setIsSplit(!isSplit)}
                  className={`w-10 h-5 rounded-full transition-colors relative ${
                    isSplit ? 'bg-[#C99152]' : 'bg-[#40342B]'
                  }`}
                >
                  <div
                    className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${
                      isSplit ? 'translate-x-5' : 'translate-x-1'
                    }`}
                  />
                </div>
                <span className="text-[#CBB9A7] text-sm">Split expense</span>
              </label>
            </div>

            {isSplit && (
              <div className="space-y-4 border-t border-[#4C4036] pt-4">
                <div>
                  <label className="text-[#CBB9A7] text-xs font-medium block mb-2">People</label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {people.map(p => (
                      <Chip
                        key={p.id}
                        selected
                        onClick={() => removePerson(p.id)}
                        variant="pending"
                      >
                        {p.name} ✕
                      </Chip>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newPersonName}
                      onChange={e => setNewPersonName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPerson() } }}
                      placeholder="Add person..."
                      className="flex-1 bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152] placeholder-[#9B8778]"
                    />
                    <button
                      onClick={addPerson}
                      disabled={!newPersonName.trim()}
                      className="bg-[#C99152] text-white px-3 rounded-lg text-sm disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[#CBB9A7] text-xs font-medium block mb-2">Split Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {(['equal', 'percent', 'exact', 'hhs'] as SplitMethodType[]).map(m => (
                      <button
                        key={m}
                        onClick={() => setSplitMethod(m)}
                        className={`py-2 rounded-xl text-xs font-medium transition-colors ${
                          splitMethod === m
                            ? 'bg-[#C99152] text-white'
                            : 'bg-[#40342B] text-[#9B8778]'
                        }`}
                      >
                        {m === 'equal' ? 'Equal' : m === 'percent' ? 'Percent' : m === 'exact' ? 'Exact' : 'Adjust'}
                      </button>
                    ))}
                  </div>
                </div>

                {splitMethod === 'percent' && (
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Chip selected={percentMode === 'myPercent'} onClick={() => setPercentMode('myPercent')}>My %</Chip>
                      <Chip selected={percentMode === 'theirPercent'} onClick={() => setPercentMode('theirPercent')}>Their %</Chip>
                    </div>
                    {percentMode === 'myPercent' ? (
                      <div>
                        <label className="text-[#CBB9A7] text-xs block mb-1">My percent</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={myPercent}
                          onChange={e => setMyPercent(e.target.value)}
                          className="w-full bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152]"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-[#CBB9A7] text-xs block mb-1">Their total percent</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={theirPercent}
                          onChange={e => setTheirPercent(e.target.value)}
                          className="w-full bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152]"
                        />
                      </div>
                    )}
                  </div>
                )}

                {splitMethod === 'exact' && (
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Chip selected={exactMode === 'theyOwe'} onClick={() => setExactMode('theyOwe')}>They owe</Chip>
                      <Chip selected={exactMode === 'myShare'} onClick={() => setExactMode('myShare')}>My share</Chip>
                    </div>
                    <div>
                      <label className="text-[#CBB9A7] text-xs block mb-1">
                        {exactMode === 'theyOwe' ? 'Total they owe' : 'My share amount'}
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={customAmount}
                        onChange={e => setCustomAmount(e.target.value)}
                        className="w-full bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152]"
                      />
                    </div>
                  </div>
                )}

                {splitMethod === 'hhs' && (
                  <div>
                    <div className="flex gap-2 mb-2">
                      <Chip selected={hhsMode === 'iPayExtra'} onClick={() => setHhsMode('iPayExtra')}>I pay extra</Chip>
                      <Chip selected={hhsMode === 'extraTheyPay'} onClick={() => setHhsMode('extraTheyPay')}>They pay extra</Chip>
                    </div>
                    <div>
                      <label className="text-[#CBB9A7] text-xs block mb-1">Extra amount</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={extraAmount}
                        onChange={e => setExtraAmount(e.target.value)}
                        className="w-full bg-[#40342B] text-[#F4E9DA] rounded-lg px-3 py-2 text-sm border border-[#4C4036] focus:outline-none focus:border-[#C99152]"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        <div className="pt-2 space-y-3">
          <button
            onClick={handleSubmit}
            disabled={saving || !amount || parseFloat(amount) <= 0 || (isSplit && people.length === 0)}
            className="w-full bg-[#C99152] text-white rounded-xl py-3 text-base font-semibold hover:bg-[#A97845] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : isEdit ? 'Update' : `Add ${role === 'expense' ? 'Expense' : 'Income'}`}
          </button>

          {isEdit && (
            <>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="w-full bg-[#40342B] text-[#C7745A] rounded-xl py-3 text-sm font-semibold border border-[#4C4036] hover:bg-[#C7745A] hover:text-white transition-colors"
                >
                  Delete
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setConfirmDelete(false)}
                    className="flex-1 bg-[#40342B] text-[#CBB9A7] rounded-xl py-2.5 text-sm border border-[#4C4036]"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleDelete}
                    className="flex-1 bg-[#C7745A] text-white rounded-xl py-2.5 text-sm font-semibold"
                  >
                    Confirm Delete
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </Card>
    </div>
  )
}
