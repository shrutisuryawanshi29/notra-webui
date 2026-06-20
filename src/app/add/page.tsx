'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'
import TransactionForm from '@/components/TransactionForm'

export default function AddPage() {
  const router = useRouter()

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  return (
    <div className="p-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-[#EDE1D1] text-2xl font-bold">Add Transaction</h1>
      </div>
      <TransactionForm />
    </div>
  )
}
