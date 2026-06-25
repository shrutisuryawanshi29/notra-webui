'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  loadSetupState,
  saveSetupState,
  getFirstUnmappedDatabase,
  DiscoveredDatabase,
  DatabaseMappingData,
  ColumnMapping,
  CategoryValue,
  COMPATIBLE_TYPES,
  autoSuggestMapping,
} from '@/lib/setup-state'
import { buildConfigFromSetupState, saveConfig } from '@/lib/config'
import { parseCategories } from '@/lib/category-parser'
import Card from '@/components/Card'
import StepIndicator from '@/components/setup/StepIndicator'
import ColumnPicker from '@/components/setup/ColumnPicker'

const STEPS = ['Token', 'Pages', 'Roles', 'Mapping']

interface MappingFieldConfig {
  key: keyof ColumnMapping
  label: string
  iconName: string
  iconColor: string
  compatibleTypes: string[]
  showInfo?: boolean
}

const FIELDS: MappingFieldConfig[] = [
  { key: 'titleColumn', label: 'Title', iconName: 'text-alignleft', iconColor: '#D49A4A', compatibleTypes: COMPATIBLE_TYPES.title },
  { key: 'amountColumn', label: 'Amount', iconName: 'dollarsign.circle', iconColor: '#D8755D', compatibleTypes: COMPATIBLE_TYPES.amount },
  { key: 'categoryColumn', label: 'Category', iconName: 'tag', iconColor: '#A88B73', compatibleTypes: COMPATIBLE_TYPES.category },
  { key: 'dateColumn', label: 'Date', iconName: 'calendar', iconColor: '#93B889', compatibleTypes: COMPATIBLE_TYPES.date },
  { key: 'monthClassificationColumn', label: 'Month Classification', iconName: 'calendar.clock', iconColor: '#6B9B8B', compatibleTypes: COMPATIBLE_TYPES.monthClassification, showInfo: false },
  { key: 'expenseAppMetadataProperty', label: 'Split Details', iconName: 'square.and.pencil', iconColor: '#9B8778', compatibleTypes: COMPATIBLE_TYPES.appMetadata, showInfo: true },
]

const FIELD_ICONS: Record<string, string> = {
  'text-alignleft': 'M3 4h18M3 8h12M3 12h18M3 16h12M3 20h18',
  'dollarsign.circle': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v12M9 9c0-1.1.9-2 2-2h2a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 0-2 2v0a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2',
  'tag': 'M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01',
  'calendar': 'M19 4H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2zM16 2v4M8 2v4M3 10h18',
  'calendar.clock': 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  'square.and.pencil': 'M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z',
}

export default function MappingDetailPage() {
  const router = useRouter()
  const params = useParams()
  const dbId = params.id as string

  const [state, setState] = useState(() => loadSetupState())
  const [columnMapping, setColumnMapping] = useState<ColumnMapping | null>(() => {
    const s = loadSetupState()
    if (!s) return null
    const db = s.discoveredDatabases.find(d => d.id === dbId)
    if (!db) return null
    const md = s.databaseMappings[dbId]
    if (!md) return null
    if (md.columnMapping) return md.columnMapping as ColumnMapping
    return autoSuggestMapping(db.properties)
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pickerField, setPickerField] = useState<MappingFieldConfig | null>(null)
  const [showSplitInfo, setShowSplitInfo] = useState(false)

  const database = useMemo(() => {
    if (!state) return null
    return state.discoveredDatabases.find(d => d.id === dbId) || null
  }, [state, dbId])

  const mappingData = useMemo(() => {
    if (!state) return null
    return state.databaseMappings[dbId] || null
  }, [state, dbId])

  const role = mappingData?.role || 'expense'

  useEffect(() => {
    if (!state) {
      router.replace('/setup')
      return
    }
    if (!database || !mappingData) {
      router.replace('/setup/mapping')
      return
    }
  }, [state, database, mappingData, router])

  const updateMapping = (field: keyof ColumnMapping, value: string | null) => {
    setColumnMapping(prev => {
      if (!prev) return prev
      const next = { ...prev, [field]: value }
      if (field === 'categoryColumn' && value && database?.properties[value]?.type === 'relation') {
        next.categoryRelationDataSourceId = database.properties[value].relationDataSourceId || null
      }
      if (field === 'monthClassificationColumn' && value && database?.properties[value]) {
        next.monthClassificationType = database.properties[value].type || null
        if (database.properties[value].type === 'relation') {
          next.monthClassificationRelationDataSourceId = database.properties[value].relationDataSourceId || null
        }
      }
      return next
    })
  }

  const getPickerOptions = (field: MappingFieldConfig): string[] => {
    if (!database) return []
    const props = Object.entries(database.properties)
    const compatible = props.filter(([, p]) => field.compatibleTypes.includes(p.type))
    return compatible.map(([name]) => name).sort()
  }

  const handleSave = async () => {
    if (!state || !columnMapping || !database || !mappingData) return
    setSaving(true)
    setError('')

    try {
      const updatedMappings = { ...state.databaseMappings }
      updatedMappings[dbId] = {
        ...mappingData,
        columnMapping,
      }

      const updatedState = { ...state, databaseMappings: updatedMappings }
      saveSetupState(updatedState)
      setState(updatedState)

      // Parse categories if a category column is set
      if (columnMapping.categoryColumn) {
        try {
          const cats = await parseCategories(
            state.notionToken,
            dbId,
            columnMapping.categoryColumn,
          )
          updatedMappings[dbId] = {
            ...updatedMappings[dbId],
            categoryType: database.properties[columnMapping.categoryColumn]?.type || null,
            categoryValuesJSON: JSON.stringify(cats),
          }
          const finalState = { ...updatedState, databaseMappings: updatedMappings }
          saveSetupState(finalState)
          setState(finalState)
        } catch {
          // non-critical: categories parsed silently
        }
      }

      // Check for next unmapped database
      const next = getFirstUnmappedDatabase({ ...updatedState, databaseMappings: updatedMappings })
      if (next) {
        router.push(`/setup/mapping/${next.mapping.databaseId}`)
      } else {
        // All mapped - build config and go to dashboard
        const config = buildConfigFromSetupState(updatedState)
        saveConfig(config)
        router.push('/dashboard')
      }
    } catch {
      setError('Failed to save mapping')
    } finally {
      setSaving(false)
    }
  }

  if (!database || !columnMapping) {
    return (
      <div>
        <StepIndicator steps={STEPS} currentStep="Mapping" />
        <Card className="p-6">
          <p className="text-[#9B8778] text-sm text-center">Loading...</p>
        </Card>
      </div>
    )
  }

  const propertyNames = Object.keys(database.properties).sort()
  const emptyProps = propertyNames.length === 0

  return (
    <div>
      <StepIndicator steps={STEPS} currentStep="Mapping" />
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={role === 'expense' ? '#D8755D' : '#93B889'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={role === 'expense' ? 'M12 5v14M19 12l-7 7-7-7' : 'M12 19V5M5 12l7-7 7 7'} />
          </svg>
          <div>
            <h2 className="text-[#F4EDE3] text-lg font-semibold">
              Map {role === 'expense' ? 'Expense' : 'Income'} Columns
            </h2>
            <p className="text-[#9B8778] text-xs">{database.title}</p>
          </div>
        </div>

        <p className="text-[#9B8778] text-xs">
          Connect your Notion columns to Notra fields
        </p>

        {emptyProps ? (
          <p className="text-[#9B8778] text-xs">No properties found for this database.</p>
        ) : (
          <div className="space-y-1">
            {FIELDS.map(field => {
              const currentValue = columnMapping[field.key]
              return (
                <div key={field.key}>
                  <button
                    onClick={() => {
                      if (field.showInfo) setShowSplitInfo(true)
                      setPickerField(field)
                    }}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg bg-[#35281F] hover:bg-[#403027] transition-colors border border-[#5A4638]"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={field.iconColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <path d={FIELD_ICONS[field.iconName] || 'M12 5v14'} />
                    </svg>
                    <span className="text-[#F4EDE3] text-sm font-medium min-w-[80px] text-left">
                      {field.label}
                    </span>
                    {field.showInfo && (
                      <span
                        onClick={e => { e.stopPropagation(); setShowSplitInfo(true) }}
                        className="text-[#9B8778] hover:text-[#D49A4A] transition-colors flex-shrink-0 cursor-pointer"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><path d="M12 16v-4M12 8h.01" />
                        </svg>
                      </span>
                    )}
                    <span className={`flex-1 text-right text-sm truncate ${
                      currentValue ? 'text-[#F4EDE3]' : 'text-[#5C4D42]'
                    }`}>
                      {currentValue || 'Not selected'}
                    </span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#5C4D42" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                      <path d="M9 18l6-6-6-6" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>
        )}

        {error && <p className="text-[#D8755D] text-xs">{error}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 bg-[#D49A4A] text-white rounded-xl py-3 text-base font-semibold hover:bg-[#C1883A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
      </Card>

      {pickerField && (
        <ColumnPicker
          title={pickerField.label}
          options={getPickerOptions(pickerField)}
          emptyMessage={
            pickerField.key === 'expenseAppMetadataProperty'
              ? 'No Text columns found. Add a Text column named "Split Details" in your database, then restart setup.'
              : 'No compatible columns found for this field.'
          }
          currentValue={columnMapping[pickerField.key]}
          onSelect={value => updateMapping(pickerField.key, value)}
          onClose={() => setPickerField(null)}
        />
      )}

      {showSplitInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSplitInfo(false)} />
          <Card className="relative mx-4 p-6 max-w-sm space-y-3">
            <h3 className="text-[#F4EDE3] text-base font-semibold">Split Expense Details</h3>
            <p className="text-[#9B8778] text-xs leading-relaxed">
              Notra can track shared expenses. For example, if you pay $100 for groceries but your share is $50, Notra will count $50 toward your spending while remembering that you paid $100 total.
            </p>
            <p className="text-[#9B8778] text-xs leading-relaxed">
              To keep split details after the app restarts, add one optional Text column to your Expense database.
            </p>
            <p className="text-[#B8A99A] text-xs">
              Recommended: Column name: <span className="text-[#D49A4A] font-medium">Split Details</span>, Type: Text
            </p>
            <p className="text-[#9B8778] text-xs leading-relaxed">
              Notra stores small metadata in this column. You can hide this column in your Notion view.
            </p>
            <p className="text-[#9B8778] text-xs leading-relaxed">
              Without this column, your expense amount can still save as your share, but split details like paid amount and owed amount may not persist after reopening the app.
            </p>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { navigator.clipboard.writeText('Split Details'); setShowSplitInfo(false) }}
                className="flex-1 bg-[#403027] text-[#D49A4A] rounded-lg py-2 text-sm font-medium hover:bg-[#5A4638] transition-colors"
              >
                Copy &ldquo;Split Details&rdquo;
              </button>
              <button
                onClick={() => setShowSplitInfo(false)}
                className="flex-1 bg-[#D49A4A] text-white rounded-lg py-2 text-sm font-medium hover:bg-[#C1883A] transition-colors"
              >
                Got it
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
