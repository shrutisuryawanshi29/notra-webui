'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadSetupState, saveSetupState, DatabaseRole, DiscoveredDatabase, DatabaseMappingData } from '@/lib/setup-state'
import { isSetupComplete } from '@/lib/config'
import Card from '@/components/Card'
import StepIndicator from '@/components/setup/StepIndicator'

const STEPS = ['Token', 'Pages', 'Roles', 'Mapping']
const ROLES: DatabaseRole[] = ['expense', 'income', 'ignore']

interface DatabaseEntry {
  id: string
  title: string
  role: DatabaseRole
  properties: Record<string, { name: string; type: string; relationDataSourceId?: string }>
}

export default function RolesStep() {
  const router = useRouter()
  const [databases, setDatabases] = useState<DatabaseEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [permissionInfo, setPermissionInfo] = useState('')

  useEffect(() => {
    if (isSetupComplete()) {
      router.replace('/dashboard')
      return
    }
    const s = loadSetupState()
    if (!s?.notionToken) {
      router.replace('/setup/token')
      return
    }
    if (!s.selectedPageId) {
      router.replace('/setup/pages')
      return
    }
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/notion/discover', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: s.notionToken,
            pageId: s.selectedPageId,
          }),
        })
        const data = await res.json()
        const dbs = (data.databases || []) as DatabaseEntry[]

        if (data.error) {
          setError(data.error)
          if (dbs.length === 0) {
            setPermissionInfo(
              'Make sure your Notion integration is connected to:\n' +
              '• The selected parent page\n' +
              '• Your Expense database\n' +
              '• Your Income database\n' +
              '• Related category/month databases (if used)'
            )
          }
        }

        if (dbs.length === 0 && !data.error) {
          setError('No databases found under selected page')
          setPermissionInfo(
            'Make sure your Notion page contains databases, and your Notion ' +
            'integration has been granted access to them.'
          )
        }

        setDatabases(dbs.map(db => ({
          ...db,
          role: 'ignore' as DatabaseRole,
        })))
      } catch {
        setError('Failed to load databases. Please check your connection and try again.')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const setRole = (dbId: string, role: DatabaseRole) => {
    setDatabases(prev =>
      prev.map(db => db.id === dbId ? { ...db, role } : db)
    )
  }

  const handleContinue = () => {
    const state = loadSetupState()
    if (!state) return

    const expenseDBs = databases.filter(d => d.role === 'expense')
    const incomeDBs = databases.filter(d => d.role === 'income')

    if (expenseDBs.length === 0 && incomeDBs.length === 0) {
      setError('Please assign at least one database as Expense or Income.')
      return
    }

    setSaving(true)

    const mappingData: Record<string, DatabaseMappingData> = {}
    for (const db of databases) {
      if (db.role === 'ignore') continue
      mappingData[db.id] = {
        databaseId: db.id,
        databaseTitle: db.title,
        role: db.role,
        columnMapping: null,
        categoryType: null,
        categoryValuesJSON: null,
      }
    }

    state.databaseMappings = mappingData
    state.discoveredDatabases = databases.map(d => ({
      id: d.id,
      title: d.title,
      properties: d.properties,
    }))
    saveSetupState(state)

    const target = expenseDBs[0] || incomeDBs[0]
    router.push(`/setup/mapping/${target.id}`)
  }

  return (
    <div>
      <StepIndicator steps={STEPS} currentStep="Roles" />
      <Card className="p-6 space-y-4">
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <h2 className="text-[#F4EDE3] text-lg font-semibold">Assign Database Roles</h2>
            <p className="text-[#9B8778] text-xs mt-1">
              Tell Notra how to categorize each database in your page
            </p>
          </div>
        </div>

        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-[#D49A4A] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && (
          <p className="text-[#D8755D] text-xs whitespace-pre-line">{error}</p>
        )}

        {permissionInfo && (
          <div className="bg-[#35281F] rounded-xl p-3 border border-[#5A4638]">
            <p className="text-[#B8A99A] text-xs whitespace-pre-line">{permissionInfo}</p>
          </div>
        )}

        {!loading && databases.length === 0 && !error && (
          <p className="text-[#9B8778] text-xs">
            No databases found. Make sure your Notion page contains databases.
          </p>
        )}

        {!loading && databases.length > 0 && (
          <div className="space-y-2">
            {databases.map(db => (
              <div key={db.id} className="bg-[#35281F] rounded-xl p-3 border border-[#5A4638]">
                <p className="text-[#F4EDE3] text-sm font-medium mb-2 truncate">{db.title}</p>
                <div className="flex gap-1.5">
                  {ROLES.map(role => (
                    <button
                      key={role}
                      onClick={() => setRole(db.id, role)}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        db.role === role
                          ? role === 'expense'
                            ? 'bg-[#D8755D] text-white'
                            : role === 'income'
                            ? 'bg-[#93B889] text-white'
                            : 'bg-[#5A4638] text-[#B8A99A]'
                          : 'bg-[#403027] text-[#9B8778] hover:text-[#B8A99A]'
                      }`}
                    >
                      {role === 'expense' ? 'Expense' : role === 'income' ? 'Income' : 'Ignore'}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={loading || saving || databases.length === 0}
          className="w-full bg-[#D49A4A] text-white rounded-xl py-3 text-base font-semibold hover:bg-[#C1883A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {saving ? 'Saving...' : 'Continue'}
        </button>
      </Card>
    </div>
  )
}
