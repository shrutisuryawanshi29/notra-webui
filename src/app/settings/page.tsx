'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { loadConfig, clearConfig, isSetupComplete, NotraConfig, getExpenseConfig, getIncomeConfig, saveGeminiKey } from '@/lib/config'
import { GEMINI_AVAILABLE_MODELS, GEMINI_DEFAULT_MODEL, getStoredGeminiModel, saveStoredGeminiModel } from '@/lib/gemini-config'
import Card from '@/components/Card'
import { LogOut, Check, X, Loader } from 'lucide-react'

export default function SettingsPage() {
  const router = useRouter()
  const [config, setConfig] = useState<NotraConfig | null>(null)
  const [loaded, setLoaded] = useState(false)

  const [geminiKeyInput, setGeminiKeyInput] = useState('')
  const [showKeyInput, setShowKeyInput] = useState(false)
  const [testingKey, setTestingKey] = useState(false)
  const [testMsg, setTestMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [geminiModel, setGeminiModel] = useState(GEMINI_DEFAULT_MODEL)
  const hasKey = !!(config?.geminiKey)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- SSR hydration
    setConfig(loadConfig())
    setGeminiModel(getStoredGeminiModel())
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (loaded && !isSetupComplete()) {
      router.replace('/setup')
    }
  }, [loaded, router])

  const expenseCfg = config ? getExpenseConfig(config) : null
  const incomeCfg = config ? getIncomeConfig(config) : null

  const handleReset = () => {
    if (confirm('This will clear all configuration. Are you sure?')) {
      clearConfig()
      router.push('/setup')
    }
  }

  const maskedKey = useCallback(() => {
    const k = config?.geminiKey
    if (!k || k.length < 4) return null
    return '••••' + k.slice(-4)
  }, [config])

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
        const msg = data?.error || 'Connection failed'
        setTestMsg({ ok: false, text: msg })
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
        const msg = data?.error || 'Connection failed'
        setTestMsg({ ok: false, text: msg })
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
    setConfig(prev => prev ? { ...prev, geminiKey: '' } : prev)
  }, [])

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
          Gemini AI — Receipt Scanning
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2">
            <div>
              <span className="text-[#B8A99A] text-xs">API Key</span>
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
                    <span className="flex items-center gap-1.5">
                      <Loader size={14} className="animate-spin" />
                      Testing...
                    </span>
                  ) : (
                    'Save'
                  )}
                </button>
                <button
                  onClick={() => { setShowKeyInput(false); setGeminiKeyInput(hasKey ? config?.geminiKey || '' : ''); setTestMsg(null) }}
                  className="text-[#9B8778] px-3 py-1.5 text-sm hover:text-[#F4EDE3] transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {!showKeyInput && hasKey && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowKeyInput(true)}
                className="text-[#D49A4A] text-sm hover:text-[#C1883A] transition-colors"
              >
                Update Key
              </button>
              <button
                onClick={handleTestConnection}
                disabled={testingKey}
                className="text-[#D49A4A] text-sm hover:text-[#C1883A] transition-colors disabled:opacity-50"
              >
                {testingKey ? 'Testing...' : 'Test Connection'}
              </button>
              <button
                onClick={handleDeleteGeminiKey}
                className="text-[#D8755D] text-sm hover:text-red-400 transition-colors"
              >
                Delete Key
              </button>
            </div>
          )}

          {!showKeyInput && !hasKey && (
            <button
              onClick={() => setShowKeyInput(true)}
              className="text-[#D49A4A] text-sm hover:text-[#C1883A] transition-colors"
            >
              Set Up API Key
            </button>
          )}

          {testMsg && (
            <div className={`flex items-start gap-2 text-sm p-2.5 rounded-lg ${testMsg.ok ? 'bg-[#1B2A1B] text-[#93B889]' : 'bg-[#2A1B1B] text-[#D8755D]'}`}>
              {testMsg.ok ? <Check size={14} className="shrink-0 mt-0.5" /> : <X size={14} className="shrink-0 mt-0.5" />}
              <span>{testMsg.text}</span>
            </div>
          )}

          <div>
            <label className="text-[#B8A99A] text-xs block mb-1">Model</label>
            <select
              value={geminiModel}
              onChange={e => setGeminiModel(e.target.value)}
              className="w-full bg-[#1B120E] text-[#F4EDE3] border border-[#5A4638] rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#D49A4A]"
            >
              {GEMINI_AVAILABLE_MODELS.map(m => (
                <option key={m.modelID} value={m.modelID}>{m.displayName}</option>
              ))}
            </select>
          </div>

          <p className="text-[#6A5140] text-xs">
            Get a free API key from{' '}
            <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener noreferrer"
               className="text-[#D49A4A] hover:underline">
              Google AI Studio
            </a>. Used for OCR and structured receipt parsing.
          </p>
        </div>
      </Card>

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
