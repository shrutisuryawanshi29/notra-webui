'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { loadSetupState, SetupState, getCurrentSetupStep } from '@/lib/setup-state'
import { isSetupComplete } from '@/lib/config'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function SetupRouter() {
  const router = useRouter()

  useEffect(() => {
    if (isSetupComplete()) {
      router.replace('/dashboard')
      return
    }

    const state = loadSetupState()
    if (!state) {
      router.replace('/setup/token')
      return
    }

    const step = getCurrentSetupStep(state)
    switch (step) {
      case 'token':
        router.replace('/setup/token')
        break
      case 'pages':
        router.replace('/setup/pages')
        break
      case 'roles':
        router.replace('/setup/roles')
        break
      case 'mapping':
        router.replace('/setup/mapping')
        break
      case 'complete':
        router.replace('/dashboard')
        break
    }
  }, [router])

  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>
  )
}
