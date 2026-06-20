'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { isSetupComplete } from '@/lib/config'

export default function Home() {
  const router = useRouter()

  useEffect(() => {
    if (isSetupComplete()) {
      router.replace('/dashboard')
    } else {
      router.replace('/setup')
    }
  }, [router])

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="w-8 h-8 border-2 border-[#C99152] border-t-transparent rounded-full animate-spin" />
    </div>
  )
}
