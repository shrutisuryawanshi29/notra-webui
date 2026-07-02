'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { loadConfig, clearConfig, isSetupComplete, NotraConfig, getExpenseConfig, getIncomeConfig, getExpenseMapping, getIncomeMapping, saveGeminiKey } from '@/lib/config'
import { GEMINI_AVAILABLE_MODELS, GEMINI_DEFAULT_MODEL, getStoredGeminiModel, saveStoredGeminiModel } from '@/lib/gemini-config'
import { getSplitPeople, addSplitPerson, removeSplitPerson, renameSplitPerson, clearSplitPeople, StoredPerson } from '@/lib/split-people'
import { clearSetupState } from '@/lib/setup-state'
import Card from '@/components/Card'
import StyledSelect from '@/components/StyledSelect'
import { LogOut, Check, X, Loader, Pencil, Trash2, Plus, RefreshCw } from 'lucide-react'
import ConfirmDialog from '@/components/ConfirmDialog'
import Toast from '@/components/Toast'

type CheckStatus = 'pass' | 'warn' | 'fail' | 'unknown'

interface CheckItem {
  id: string
  label: string
  required: boolean
  status: CheckStatus
}

export default function SettingsPage() {
  const router = useRouter()
  const [config, setConfig] = useState<NotraConfig | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [geminiModel, setGeminiModel] = useState(GEMINI_DEFAULT_MODEL)
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmKeyDelete, setConfirmKeyDelete] = useState(false)

  const [people, setPeople] = useState<StoredPerson[]>([])
  const [showAddPerson, setShowAddPerson] = useState(false)
  const [personNameInput, setPersonNameInput] = useState('')
  const [editingPerson, setEditingPerson] = useState<StoredPerson | null>(null)
  const [renameInput, setRenameInput] = useState('')

  const hasKey = !!(config?.geminiKey)

  useEffect(() => {
    setConfig(loadConfig())
    setGeminiModel(getStoredGeminiModel())
    setPeople(getSplitPeople())
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded && !isSetupComplete()) {
      router.replace('/setup')
    }
  }, [loaded, router])

  const expenseCfg = config ? getExpenseConfig(config) : null
  const incomeCfg = config ? getIncomeConfig(config) : null
  const expenseMapping = config ? getExpenseMapping(config) : null
  const incomeMapping = config ? getIncomeMapping(config) : null

  const maskedKey = useCallback(() => {
    const k = config?.geminiKey
    if (!k || k.length < 4) return null
    return '••••' + k.slice(-4)
  }, [config])

  const handleReset = () => setConfirmReset(true)

  const confirmResetAction = () => {
    clearConfig()
    clearSetupState()
    clearSplitPeople()
    router.push('/setup')
  }

  const handleSaveGeminiKey = useCallback(async () => {
    const trimmed = geminiKeyInput.trim()
    if (!trimmed) return
    setTestingKey(true)
    setTestMsg(null)
    try {
      const res = await fetch('/api/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: trimmed, model: geminiModel || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        saveGeminiKey(trimmed)
        saveStoredGeminiModel(geminiModel)
        setConfig(prev => prev ? { ...prev, geminiKey: trimmed } : prev)
        setShowKeyInput(false)
        setTestMsg({ ok: true, text: 'Connection successful. Your Gemini key is working.' })
      } else {
        setTestMsg({ ok: false, text: data?.error || 'Connection failed' })
      }
    } catch {
      setTestMsg({ ok: false, text: 'Could not connect to Gemini. Check your internet connection.' })
    } finally {
      setTestingKey(false)
    }
  }, [geminiKeyInput, geminiModel])

  const handleTestConnection = useCallback(async () => {
    const key = config?.geminiKey
    if (!key) return
    setTestingKey(true)
    setTestMsg(null)
    try {
      const res = await fetch('/api/gemini/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key, model: geminiModel || undefined }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setTestMsg({ ok: true, text: 'Connection successful. Your Gemini key is working.' })
      } else {
        setTestMsg({ ok: false, text: data?.error || 'Connection failed' })
      }
    } catch {
      setTestMsg({ ok: false, text: 'Could not connect to Gemini. Check your internet connection.' })
    } finally {
      setTestingKey(false)
    }
  }, [config, geminiModel])

  const handleDeleteGeminiKey = useCallback(() => {
    saveGeminiKey('')
    setGeminiKeyInput('')
    setShowKeyInput(false)
    setTestMsg(null)
    setConfirmKeyDelete(false)
    setConfig(prev => prev ? { ...prev, geminiKey: '' } : prev)
  }, [])

  const handleAddPerson = useCallback(() => {
    const name = personNameInput.trim()
    if (!name) return
    const result = addSplitPerson(name)
    if (result) {
      setPeople(getSplitPeople())
      setPersonNameInput('')
      setShowAddPerson(false)
    }
  }, [personNameInput])

  const handleRenamePerson = useCallback(() => {
    if (!editingPerson) return
    const name = renameInput.trim()
    if (!name) return
    const result = renameSplitPerson(editingPerson.id, name)
    if (result) {
      setPeople(getSplitPeople())
      setEditingPerson(null)
      setRenameInput('')
    }
  }, [editingPerson, renameInput])

  const handleDeletePerson = useCallback((id: string) => {
    removeSplitPerson(id)
    setPeople(getSplitPeople())
  }, [])

  const handleRefreshData = useCallback(() => {
    localStorage.removeItem('notra-cache')
    setToastMsg('Cache cleared. Refresh your dashboard to reload data.')
  }, [])

  const handlePrintMappingSummary = useCallback(() => {
    const lines: string[] = []
    lines.push('=== Mapping Summary ===')
    if (expenseCfg) {
      lines.push(`Expense DB: ${expenseMapping?.databaseTitle || expenseCfg.databaseId}`)
      lines.push(`  Title: ${expenseCfg.titleColumn || '—'}`)
      lines.push(`  Amount: ${expenseCfg.amountColumn || '—'}`)
      lines.push(`  Date: ${expenseCfg.dateColumn || '—'}`)
      lines.push(`  Category: ${expenseCfg.categoryColumn || '—'}`)
      lines.push(`  Metadata: ${expenseCfg.metadataColumn || '—'}`)
    }
    if (incomeCfg) {
      lines.push(`Income DB: ${incomeMapping?.databaseTitle || incomeCfg.databaseId}`)
      lines.push(`  Title: ${incomeCfg.titleColumn || '—'}`)
      lines.push(`  Amount: ${incomeCfg.amountColumn || '—'}`)
      lines.push(`  Date: ${incomeCfg.dateColumn || '—'}`)
      lines.push(`  Category: ${incomeCfg.categoryColumn || '—'}`)
    }
    const text = lines.join('\n')
    console.log(text)
    setToastMsg('Mapping summary printed to console')
  }, [expenseCfg, incomeCfg, expenseMapping, incomeMapping])

  const handlePrintCacheSummary = useCallback(() => {
    const lines: string[] = []
    lines.push('=== Cache Summary ===')
    const cacheRaw = typeof window !== 'undefined' ? localStorage.getItem('notra-cache') : null
    if (cacheRaw) {
      try {
        const parsed = JSON.parse(cacheRaw)
        const expCount = parsed.expenses?.length ?? 0
        const incCount = parsed.income?.length ?? 0
        const budgetsCount = parsed.budgets?.length ?? 0
        lines.push(`Expenses: ${expCount}`)
        lines.push(`Income: ${incCount}`)
        lines.push(`Budgets: ${budgetsCount}`)
        lines.push(`Fetched: ${parsed.lastFetched || 'unknown'}`)
      } catch {
        lines.push('Failed to parse cache JSON')
      }
    } else {
      lines.push('No cache found')
    }
    const text = lines.join('\n')
    console.log(text)
    setToastMsg('Cache summary printed to console')
  }, [])

  const checklistItems = useCallback((): CheckItem[] => {
    const cmE = expenseCfg
    const cmI = incomeCfg
    return [
      { id: 'token', label: 'Notion token connected', required: true, status: config?.notionToken ? 'pass' : 'fail' },
      { id: 'page', label: 'Main page selected', required: true, status: config?.selectedPageId ? 'pass' : 'fail' },
      { id: 'expenseDb', label: 'Expense database assigned', required: true, status: expenseMapping ? 'pass' : 'fail' },
      { id: 'incomeDb', label: 'Income database assigned', required: true, status: incomeMapping ? 'pass' : 'fail' },
      { id: 'expenseTitle', label: 'Expense title mapped', required: true, status: cmE?.titleColumn ? 'pass' : 'fail' },
      { id: 'expenseAmount', label: 'Expense amount mapped', required: true, status: cmE?.amountColumn ? 'pass' : 'fail' },
      { id: 'expenseDate', label: 'Expense date mapped', required: true, status: cmE?.dateColumn ? 'pass' : 'fail' },
      { id: 'expenseCategory', label: 'Expense category mapped', required: true, status: cmE?.categoryColumn ? 'pass' : 'fail' },
      { id: 'incomeTitle', label: 'Income title mapped', required: true, status: cmI?.titleColumn ? 'pass' : 'fail' },
      { id: 'incomeAmount', label: 'Income amount mapped', required: true, status: cmI?.amountColumn ? 'pass' : 'fail' },
      { id: 'incomeDate', label: 'Income date mapped', required: true, status: cmI?.dateColumn ? 'pass' : 'fail' },
      { id: 'incomeSource', label: 'Income source mapped', required: true, status: cmI?.categoryColumn ? 'pass' : 'fail' },
      { id: 'categoryRelation', label: 'Expense category is relation (recommended)', required: false, status: expenseCfg?.categoryColumn && expenseMapping?.columnMapping?.categoryRelationDataSourceId ? 'pass' : 'warn' },
      { id: 'monthClassification', label: 'Month classification detected', required: false, status: expenseCfg?.monthClassificationColumn ? 'pass' : 'warn' },
      { id: 'relationOptions', label: 'Category relation data loaded', required: false, status: config && hasRelationOptions(config) ? 'pass' : 'warn' },
      { id: 'metadata', label: 'Split metadata column mapped', required: false, status: expenseCfg?.metadataColumn ? 'pass' : 'warn' },
    ]
  }, [config, expenseCfg, incomeCfg, expenseMapping, incomeMapping])

  const checks = checklistItems()
  const criticalFails = checks.filter(c => c.required && c.status === 'fail').length
  const warnings = checks.filter(c => c.status === 'warn').length
  const allPass = criticalFails === 0 && warnings === 0

  const renderCheckStatus = (status: CheckStatus) => {
    switch (status) {
      case 'pass': return <Check size={14} className="text-[#93B889]" />
      case 'warn': return <X size={14} className="text-[#D49A4A]" />
      case 'fail': return <X size={14} className="text-[#D8755D]" />
      default: return <span className="w-3.5 h-3.5 rounded-full border border-[#5A4638]" />
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
    <div className="p-5 max-w-3xl mx-auto space-y-4">
      <h1 className="text-[#F4EDE3] text-2xl font-bold tracking-tight">Settings</h1>

      {/* Setup Checklist */}
      <Card>
        <h2 className="text-[#F4EDE3] text-sm font-semibold mb-3">Setup Checklist</h2>
        <div className="space-y-1">
          {checks.map(c => (
            <div key={c.id} className="flex items-center gap-2 text-xs">
              {renderCheckStatus(c.status)}
              <span className={c.status === 'fail' ? 'text-[#D8755D]' : c.status === 'warn' ? 'text-[#D49A4A]' : 'text-[#B8A99A]'}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-xs text-[#6A5140]">
          {criticalFails > 0
            ? `${criticalFails} critical check${criticalFails > 1 ? 's' : ''} need attention`
            : warnings > 0
              ? `${warnings} warning${warnings > 1 ? 's' : ''} — all critical checks passed`
              : allPass
                ? 'All checks passed'
                : ''}
        </div>
      </Card>

      {/* Notion Connection */}
      <Card>
        <h2 className="text-[#F4EDE3] text-sm font-semibold mb-3">Notion Connection</h2>
        <div className="space-y-2 text-xs">
          <InfoRow label="Connected Page" value={config.selectedPageTitle || 'None'} />
          <InfoRow label="Token" value={config.notionToken ? `${config.notionToken.substring(0, 8)}...` : 'Not set'} />
          <InfoRow label="Expense Database" value={expenseMapping?.databaseTitle || expenseCfg?.databaseId || 'Not configured'} />
          <InfoRow label="Income Database" value={incomeMapping?.databaseTitle || incomeCfg?.databaseId || 'Not configured'} />
          <InfoRow label="Expense Mapping" value={
            expenseCfg
              ? ['Title', 'Amount', 'Date', 'Category']
                  .filter(f => expenseCfg[`${f.toLowerCase()}Column` as keyof typeof expenseCfg])
                  .join(' · ') || 'None'
              : 'None'
          } />
          <InfoRow label="Income Mapping" value={
            incomeCfg
              ? ['Title', 'Amount', 'Date', 'Category']
                  .filter(f => incomeCfg[`${f.toLowerCase()}Column` as keyof typeof incomeCfg])
                  .join(' · ') || 'None'
              : 'None'
          } />
        </div>
        <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[#3A2A22]">
          <ActionLink onClick={() => router.push('/setup/token')}>
            Reconnect Notion
          </ActionLink>
          <ActionLink onClick={() => router.push('/setup/pages')}>
            Re-run Database Discovery
          </ActionLink>
        </div>
      </Card>

      {/* AI Receipt Parser */}
      <Card>
        <h2 className="text-[#F4EDE3] text-sm font-semibold mb-3">AI Receipt Parser</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-1">
            <div>
              <span className="text-[#B8A99A] text-xs">Gemini API Key</span>
              <p className="text-sm mt-0.5">
                {hasKey ? (
                  <span className="flex items-center gap-1.5 text-[#93B889]">
                    <Check size={14} /> Connected {maskedKey()}
                  </span>
                ) : (
                  <span className="text-[#6A5140]">Not Connected — tap to set up</span>
                )}
              </p>
            </div>
          </div>

          {showKeyInput && (
            <div>
              <input
                type="password"
                value={geminiKeyInput}
                onChange={e => { setGeminiKeyInput(e.target.value); setTestMsg(null) }}
                className="w-full bg-[#1B120E] text-[#F4EDE3] border border-[#5A4638] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D49A4A] font-mono"
                placeholder="Paste your Gemini API key"
                autoFocus
              />
              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleSaveGeminiKey}
                  disabled={testingKey || !geminiKeyInput.trim()}
                  className="bg-[#D49A4A] text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-[#C1883A] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {testingKey ? (
                    <span className="flex items-center gap-1.5"><Loader size={14} className="animate-spin" />Testing...</span>
                  ) : 'Save'}
                </button>
                <button
                  onClick={() => { setShowKeyInput(false); setGeminiKeyInput(''); setTestMsg(null) }}
                  className="text-[#9B8778] px-3 py-1.5 text-sm hover:text-[#F4EDE3] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showKeyInput && hasKey && (
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              <ActionLink onClick={() => setShowKeyInput(true)}>Update Key</ActionLink>
              <ActionLink onClick={handleTestConnection} disabled={testingKey}>
                {testingKey ? 'Testing...' : 'Test Connection'}
              </ActionLink>
              <ActionLink onClick={() => setConfirmKeyDelete(true)} className="text-[#D8755D] hover:text-red-400">
                Delete Key
              </ActionLink>
            </div>
          )}

          {!showKeyInput && !hasKey && (
            <ActionLink onClick={() => setShowKeyInput(true)}>Set Up API Key</ActionLink>
          )}

          {testMsg && (
            <div className={`flex items-start gap-2 text-sm p-2.5 rounded-lg ${testMsg.ok ? 'bg-[#1B2A1B] text-[#93B889]' : 'bg-[#2A1B1B] text-[#D8755D]'}`}>
              {testMsg.ok ? <Check size={14} className="shrink-0 mt-0.5" /> : <X size={14} className="shrink-0 mt-0.5" />}
              <span>{testMsg.text}</span>
            </div>
          )}

          <div>
            <label className="text-[#B8A99A] text-xs block mb-1">Model</label>
            <StyledSelect
              value={geminiModel}
              onChange={setGeminiModel}
              options={GEMINI_AVAILABLE_MODELS.map(m => ({ value: m.modelID, label: m.displayName }))}
            />
          </div>

          <p className="text-[#6A5140] text-xs">
            Get a free API key from{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer" className="text-[#D49A4A] hover:underline">Google AI Studio</a>.
            Used by the receipt scanner for OCR and structured parsing.
          </p>
        </div>
      </Card>

      {/* Split People */}
      <Card>
        <h2 className="text-[#F4EDE3] text-sm font-semibold mb-3">Split People</h2>
        <div className="space-y-1.5">
          {people.map(p => (
            <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-[#3A2A22] last:border-0">
              {editingPerson?.id === p.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={renameInput}
                    onChange={e => setRenameInput(e.target.value)}
                    className="flex-1 bg-[#1B120E] text-[#F4EDE3] border border-[#5A4638] rounded px-2 py-1 text-sm focus:outline-none focus:border-[#D49A4A]"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleRenamePerson(); if (e.key === 'Escape') setEditingPerson(null) }}
                  />
                  <button onClick={handleRenamePerson} className="text-[#93B889] text-xs hover:text-[#7AA67A] transition-colors">Save</button>
                  <button onClick={() => setEditingPerson(null)} className="text-[#9B8778] text-xs hover:text-[#F4EDE3] transition-colors">Cancel</button>
                </div>
              ) : (
                <>
                  <span className="text-[#F4EDE3] text-sm">{p.name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { setEditingPerson(p); setRenameInput(p.name) }}
                      className="text-[#9B8778] hover:text-[#D49A4A] transition-colors"
                      title="Rename"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => handleDeletePerson(p.id)}
                      className="text-[#9B8778] hover:text-[#D8755D] transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {people.length === 0 && (
            <p className="text-[#6A5140] text-xs">No split people added yet.</p>
          )}
          {showAddPerson ? (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={personNameInput}
                onChange={e => setPersonNameInput(e.target.value)}
                className="flex-1 bg-[#1B120E] text-[#F4EDE3] border border-[#5A4638] rounded px-2 py-1 text-sm focus:outline-none focus:border-[#D49A4A]"
                placeholder="Enter person's name"
                autoFocus
                onKeyDown={e => { if (e.key === 'Enter') handleAddPerson(); if (e.key === 'Escape') { setShowAddPerson(false); setPersonNameInput('') } }}
              />
              <button onClick={handleAddPerson} disabled={!personNameInput.trim()} className="text-[#D49A4A] text-xs font-semibold hover:text-[#C1883A] transition-colors disabled:opacity-50">Add</button>
              <button onClick={() => { setShowAddPerson(false); setPersonNameInput('') }} className="text-[#9B8778] text-xs hover:text-[#F4EDE3] transition-colors">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddPerson(true)}
              className="flex items-center gap-1 text-[#D49A4A] text-sm hover:text-[#C1883A] transition-colors mt-1"
            >
              <Plus size={14} /> Add Person
            </button>
          )}
        </div>
      </Card>

      {/* Data */}
      <Card>
        <h2 className="text-[#F4EDE3] text-sm font-semibold mb-3">Data</h2>
        <div className="space-y-2 text-xs">
          <InfoRow label="Last Loaded Month" value="N/A (data reloads on dashboard visit)" />
        </div>
        <div className="mt-3 pt-3 border-t border-[#3A2A22]">
          <ActionLink onClick={handleRefreshData}>
            <RefreshCw size={12} /> Refresh Dashboard Data
          </ActionLink>
        </div>
      </Card>

      {/* Debug */}
      <Card>
        <h2 className="text-[#F4EDE3] text-sm font-semibold mb-3">Debug</h2>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <ActionLink onClick={handlePrintMappingSummary}>Print Mapping Summary</ActionLink>
          <ActionLink onClick={handlePrintCacheSummary}>Print Cache Summary</ActionLink>
        </div>
      </Card>

      {/* Danger Zone */}
      <button
        onClick={handleReset}
        className="flex items-center justify-center gap-2 w-full bg-[#403027] text-[#D8755D] rounded-xl py-3 text-sm font-semibold border border-[#6B5847] hover:bg-[#D8755D] hover:text-white transition-colors"
      >
        <LogOut size={16} />
        Reset Setup
      </button>

      <ConfirmDialog
        open={confirmReset}
        title="Reset Setup?"
        message="This will clear your Notion connection, database mappings, and split people. You'll need to set up again from the beginning."
        confirmLabel="Reset"
        destructive
        onConfirm={confirmResetAction}
        onCancel={() => setConfirmReset(false)}
      />

      <ConfirmDialog
        open={confirmKeyDelete}
        title="Delete Gemini Key?"
        message="AI receipt scanning will no longer work until you add a new key."
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteGeminiKey}
        onCancel={() => setConfirmKeyDelete(false)}
      />

      <Toast open={toastMsg !== null} message={toastMsg || ''} onClose={() => setToastMsg(null)} />
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-[#9B8778]">{label}</span>
      <span className="text-[#B8A99A] text-right max-w-[55%] truncate">{value}</span>
    </div>
  )
}

function hasRelationOptions(config: NotraConfig): boolean {
  if (config.categoryValues && Object.keys(config.categoryValues).length > 0) return true
  for (const mapping of Object.values(config.databaseMappings)) {
    if (mapping.categoryValuesJSON) {
      try {
        const parsed = JSON.parse(mapping.categoryValuesJSON)
        if (Array.isArray(parsed) && parsed.length > 0) return true
      } catch {
        // skip
      }
    }
  }
  return false
}

function ActionLink({ onClick, disabled, children, className }: {
  onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`text-[#D49A4A] text-sm hover:text-[#C1883A] transition-colors disabled:opacity-50 inline-flex items-center gap-1 ${className || ''}`}
    >
      {children}
    </button>
  )
}
