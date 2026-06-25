'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadSetupState, saveSetupState, SetupState } from '@/lib/setup-state'
import { isSetupComplete } from '@/lib/config'
import Card from '@/components/Card'
import StepIndicator from '@/components/setup/StepIndicator'

const STEPS = ['Token', 'Pages', 'Roles', 'Mapping']

export default function TokenStep() {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle')
  const [testMessage, setTestMessage] = useState('')

  useEffect(() => {
    if (isSetupComplete()) {
      router.replace('/dashboard')
      return
    }
    const state = loadSetupState()
    if (state?.notionToken) {
      router.replace('/setup/pages')
    }
  }, [router])

  const handleTest = async () => {
    const cleaned = token.replace(/[^\x20-\x7E]/g, '').trim()
    if (!cleaned) return
    setTesting(true)
    setTestResult('idle')
    setTestMessage('')
    try {
      const res = await fetch('/api/notion/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleaned }),
      })
      const data = await res.json()
      if (data.valid) {
        setTestResult('success')
        setTestMessage(`Connected as ${data.user.name}`)
      } else {
        setTestResult('error')
        setTestMessage(data.error || 'Invalid token')
      }
    } catch {
      setTestResult('error')
      setTestMessage('Failed to reach server')
    } finally {
      setTesting(false)
    }
  }

  const handleContinue = () => {
    const cleaned = token.replace(/[^\x20-\x7E]/g, '').trim()
    if (cleaned.length !== token.trim().length) {
      setTestResult('error')
      setTestMessage('Token contained invisible characters and was cleaned. Please re-paste your token to avoid issues.')
      return
    }
    if (!cleaned.startsWith('ntn_') && !cleaned.startsWith('secret_')) {
      setTestResult('error')
      setTestMessage('Token should start with "ntn_" or "secret_". Please check your token.')
      return
    }
    const existing = loadSetupState() || {
      notionToken: '',
      selectedPageId: null,
      selectedPageTitle: null,
      discoveredDatabases: [],
      databaseMappings: {},
    }
    existing.notionToken = cleaned
    saveSetupState(existing)
    router.push('/setup/pages')
  }

  return (
    <div>
      <StepIndicator steps={STEPS} currentStep="Token" />
      <Card className="p-6 space-y-4">
        <h2 className="text-[#F4EDE3] text-lg font-semibold">Notion Integration Token</h2>
        <p className="text-[#9B8778] text-xs">
          Paste your Notion integration token to connect Notra.
        </p>
        <div>
          <input
            type="password"
            value={token}
            onChange={e => setToken(e.target.value)}
            placeholder="ntn_..."
            className="w-full bg-[#403027] text-[#F4EDE3] rounded-lg px-3 py-2.5 text-sm border border-[#5A4638] focus:outline-none focus:border-[#D49A4A] placeholder-[#9B8778]"
          />
          <button
            onClick={handleTest}
            disabled={testing || !token.trim()}
            className="mt-2 text-xs text-[#D49A4A] hover:text-[#C1883A] disabled:text-[#9B8778]"
          >
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          {testResult !== 'idle' && (
            <p className={`text-xs mt-1 ${testResult === 'success' ? 'text-[#93B889]' : 'text-[#D8755D]'}`}>
              {testMessage}
            </p>
          )}
        </div>
        <button
          onClick={handleContinue}
          disabled={!token.trim()}
          className="w-full bg-[#D49A4A] text-white rounded-xl py-3 text-base font-semibold hover:bg-[#C1883A] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </Card>
    </div>
  )
}
