'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadSetupState, getFirstUnmappedDatabase } from '@/lib/setup-state'
import { isSetupComplete } from '@/lib/config'
import LoadingSpinner from '@/components/LoadingSpinner'

export default function MappingRouter() {
  const router = useRouter()

  useEffect(() => {
    if (isSetupComplete()) {
      router.replace('/dashboard')
      return
    }

    const state = loadSetupState()
    if (!state?.notionToken) {
      router.replace('/setup/token')
      return
    }

    const first = getFirstUnmappedDatabase(state)
    if (first) {
      router.replace(`/setup/mapping/${first.mapping.databaseId}`)
    } else {
      const mappings = Object.values(state.databaseMappings)
      if (mappings.length === 0) {
        router.replace('/setup/roles')
      } else {
        router.replace('/dashboard')
      }
    }
  }, [router])

  return (
    <div className="flex items-center justify-center py-12">
      <LoadingSpinner />
    </div>
  )
}
