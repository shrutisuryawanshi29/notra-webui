'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadSetupState, saveSetupState, SetupState } from '@/lib/setup-state'
import { isSetupComplete } from '@/lib/config'
import Card from '@/components/Card'
import StepIndicator from '@/components/setup/StepIndicator'

const STEPS = ['Token', 'Pages', 'Roles', 'Mapping']

interface NotionPageResult {
  id: string
  title: string
  icon?: string
}

export default function PagesStep() {
  const router = useRouter()
  const [pages, setPages] = useState<NotionPageResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [error, setError] = useState('')

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
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/notion/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: s.notionToken,
            filter: { value: 'page', property: 'object' },
          }),
        })
        const data = await res.json()
        const allPages = (data.results || []) as Array<Record<string, unknown>>
        const workspacePages = allPages.filter(p => {
          const parent = p.parent as Record<string, unknown> | undefined
          return parent?.type === 'workspace'
        })
        const results = workspacePages
          .map((p: Record<string, unknown>) => ({
            id: p.id as string,
            title: extractPageTitle(p),
            icon: extractPageIcon(p),
          }))
          .sort((a, b) => a.title.toLowerCase().localeCompare(b.title.toLowerCase()))
        setPages(results)
      } catch {
        setError('Failed to load pages')
      } finally {
        setLoading(false)
      }
    })()
  }, [router])

  const handleContinue = () => {
    if (!selectedId) return
    const state = loadSetupState()
    if (!state) return
    const page = pages.find(p => p.id === selectedId)
    state.selectedPageId = selectedId
    state.selectedPageTitle = page?.title || null
    saveSetupState(state)
    router.push('/setup/roles')
  }

  return (
    <div>
      <StepIndicator steps={STEPS} currentStep="Pages" />
      <Card className="p-6 space-y-4">
        <h2 className="text-[#F4E9DA] text-lg font-semibold">Select a Page</h2>
        <p className="text-[#9B8778] text-xs">
          Choose the Notion page that contains your finance databases.
        </p>

        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-[#C99152] border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {error && <p className="text-[#C7745A] text-xs">{error}</p>}

        {!loading && pages.length === 0 && !error && (
          <p className="text-[#9B8778] text-xs">No pages found. Make sure your integration has access to pages.</p>
        )}

        {!loading && pages.length > 0 && (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            {pages.map(page => (
              <button
                key={page.id}
                onClick={() => setSelectedId(page.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                  selectedId === page.id
                    ? 'bg-[#C99152]/10 border border-[#C99152]'
                    : 'bg-[#40342B] border border-transparent hover:border-[#4C4036]'
                }`}
              >
                <span className="text-lg">{page.icon || '📄'}</span>
                <span className="text-[#F4E9DA] text-sm truncate flex-1">{page.title}</span>
              </button>
            ))}
          </div>
        )}

        <button
          onClick={handleContinue}
          disabled={!selectedId}
          className="w-full bg-[#C99152] text-white rounded-xl py-3 text-base font-semibold hover:bg-[#A97845] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Continue
        </button>
      </Card>
    </div>
  )
}

function extractPageTitle(page: Record<string, unknown>): string {
  const props = page.properties as Record<string, unknown> | undefined
  if (!props) return 'Untitled'
  const titleProp = Object.values(props).find(
    (v: unknown) => (v as Record<string, unknown>).type === 'title'
  ) as Record<string, unknown> | undefined
  if (!titleProp) return 'Untitled'
  const title = titleProp.title as Array<{ plain_text: string }> | undefined
  if (!title) return 'Untitled'
  return title.map(t => t.plain_text).join('') || 'Untitled'
}

function extractPageIcon(page: Record<string, unknown>): string {
  const icon = page.icon as Record<string, unknown> | undefined
  if (!icon) return ''
  if (icon.type === 'emoji') return icon.emoji as string
  return ''
}
