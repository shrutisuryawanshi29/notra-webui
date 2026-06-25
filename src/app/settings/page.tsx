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
        <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight mb-6">Settings</h1>
        <p className="text-[#B8A99A] text-sm">Loading...</p>
      </div>
    )
  }

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight mb-6">Settings</h1>

      <Card className="mb-4">
        <h2 className="text-[#F4EDE3] text-sm font-semibold mb-3">
          Notion Configuration
        </h2>
        <div className="space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Token</span>
            <span className="text-[#B8A99A]">
              {config.notionToken
                ? `${config.notionToken.substring(0, 8)}...`
                : 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Expense Database</span>
            <span className="text-[#B8A99A] font-mono text-[10px]">
              {expenseCfg?.databaseId || 'Not set'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Income Database</span>
            <span className="text-[#B8A99A] font-mono text-[10px]">
              {incomeCfg?.databaseId || 'Not set'}
            </span>
          </div>
        </div>
      </Card>

      <Card className="mb-4">
        <h2 className="text-[#F4EDE3] text-sm font-semibold mb-3">
          Column Mappings — Expenses
        </h2>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Title</span>
            <span className="text-[#B8A99A]">{expenseCfg?.titleColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Amount</span>
            <span className="text-[#B8A99A]">{expenseCfg?.amountColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Date</span>
            <span className="text-[#B8A99A]">{expenseCfg?.dateColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Category</span>
            <span className="text-[#B8A99A]">{expenseCfg?.categoryColumn || 'None'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Split Details</span>
            <span className="text-[#B8A99A]">{expenseCfg?.metadataColumn || 'None'}</span>
          </div>
        </div>
      </Card>

      <Card className="mb-6">
        <h2 className="text-[#F4EDE3] text-sm font-semibold mb-3">
          Column Mappings — Income
        </h2>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Title</span>
            <span className="text-[#B8A99A]">{incomeCfg?.titleColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Amount</span>
            <span className="text-[#B8A99A]">{incomeCfg?.amountColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Date</span>
            <span className="text-[#B8A99A]">{incomeCfg?.dateColumn}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#B8A99A]">Type/Category</span>
            <span className="text-[#B8A99A]">{incomeCfg?.categoryColumn || 'None'}</span>
          </div>
        </div>
      </Card>

      <button
        onClick={handleReset}
        className="flex items-center justify-center gap-2 w-full bg-[#403027] text-[#D8755D] rounded-xl py-3 text-sm font-semibold border border-[#6B5847] hover:bg-[#D8755D] hover:text-white transition-colors"
      >
        <LogOut size={16} />
        Reset Setup
      </button>
    </div>
  )
}
