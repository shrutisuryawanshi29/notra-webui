'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadConfig, clearConfig, isSetupComplete, NotraConfig, getExpenseConfig, getIncomeConfig } from '@/lib/config'
import Card from '@/components/Card'
import { LogOut } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [config] = useState<NotraConfig | null>(() => {
    if (typeof window === 'undefined') return null
    return loadConfig()
  })

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  const expenseCfg = config ? getExpenseConfig(config) : null
  const incomeCfg = config ? getIncomeConfig(config) : null

  const handleReset = () => {
    if (confirm('This will clear all configuration. Are you sure?')) {
      clearConfig()
      router.push('/setup')
    }
  }

  if (!config) {
    return (
      <div className="p-5 max-w-3xl mx-auto">
        <h1 className="text-[#EDE1D1] text-2xl font-bold mb-6">Settings</h1>
        <p className="text-[#9B8778] text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <h1 className="text-[#EDE1D1] text-2xl font-bold mb-6">Settings</h1>

      <Card className="mb-4">
        <h2 className="text-[#F4E9DA] text-sm font-semibold mb-3">
          Notion Configuration
        </h2>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Token</span>
            <span className="text-[#9B8778]">
              {config.notionToken
                ? `${config.notionToken.substring(0, 8)}...`
                : 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Expense Database</span>
            <span className="text-[#9B8778] font-mono text-[10px]">
              {expenseCfg?.databaseId || 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Income Database</span>
            <span className="text-[#9B8778] font-mono text-[10px]">
              {incomeCfg?.databaseId || 'Not set'}
            </span>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-[#F4E9DA] text-sm font-semibold mb-3">
          Column Mappings — Expenses
        </h2>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Title</span>
            <span className="text-[#9B8778]">{expenseCfg?.titleColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Amount</span>
            <span className="text-[#9B8778]">{expenseCfg?.amountColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Date</span>
            <span className="text-[#9B8778]">{expenseCfg?.dateColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Category</span>
            <span className="text-[#9B8778]">{expenseCfg?.categoryColumn || 'None'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Split Details</span>
            <span className="text-[#9B8778]">{expenseCfg?.metadataColumn || 'None'}</span>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-[#F4E9DA] text-sm font-semibold mb-3">
          Column Mappings — Income
        </h2>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Title</span>
            <span className="text-[#9B8778]">{incomeCfg?.titleColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Amount</span>
            <span className="text-[#9B8778]">{incomeCfg?.amountColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Date</span>
            <span className="text-[#9B8778]">{incomeCfg?.dateColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#CBB9A7]">Type/Category</span>
            <span className="text-[#9B8778]">{incomeCfg?.categoryColumn || 'None'}</span>
          </div>
        </div>
      </Card>

      <button
        onClick={handleReset}
        className="flex items-center justify-center gap-2 w-full bg-[#40342B] text-[#C7745A] rounded-xl py-3 text-sm font-semibold border border-[#4C4036] hover:bg-[#C7745A] hover:text-white transition-colors"
      >
        <LogOut size={16} />
        Reset Setup
      </button>
    </div>
  )
}
