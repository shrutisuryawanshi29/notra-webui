'use client'

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'
import TransactionForm from '@/components/TransactionForm'

function AddPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const defaultRole = (searchParams.get('role') as 'expense' | 'income') || 'expense'

  useEffect(() => {
    if (!isSetupComplete()) {
      router.replace('/setup')
    }
  }, [router])

  return (
      <div className="p-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[#F4EDE3] text-2xl font-bold">Add Transaction</h1>
        </div>
        <TransactionForm defaultRole={defaultRole} />
    </div>
  )
}

export default function AddPage() {
  return (
    <Suspense fallback={
      <div className="p-5 max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-[#F4EDE3] text-2xl font-bold">Add Transaction</h1>
        </div>
        <div className="text-[#B8A99A] text-sm">Loading...</div>
      </div>
    }>
      <AddPageContent />
    </Suspense>
  )
}
