import { stablePersonId } from './notion-properties'
import { NormalizedTransaction } from '@/types/transaction'

export interface StoredPerson {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

const STORAGE_KEY = 'notra-split-people'

function nowISO(): string {
  return new Date().toISOString()
}

function storageAvailable(): boolean {
  return typeof window !== 'undefined' && typeof localStorage !== 'undefined'
}

export function getSplitPeople(): StoredPerson[] {
  if (!storageAvailable()) return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      console.log('[SplitPeople:load] rawCount=0')
      return []
    }
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      console.log('[SplitPeople:load] rawCount=0')
      return []
    }
    console.log(`[SplitPeople:load] rawCount=${parsed.length}`)

    // Phase 1: migrate random/UUID ids to stable name-based ids, merge by stable id
    const seen = new Map<string, StoredPerson>() // canonicalId → merged person
    let migratedCount = 0
    for (const p of parsed) {
      if (!p || !p.name) continue
      const newId = stablePersonId(p.name)
      if (!newId || newId === 'unknown') continue
      if (p.id !== newId) {
        migratedCount++
        console.log(`[SplitPeople:migrate] oldId=${p.id} newId=${newId}`)
      }
      if (seen.has(newId)) {
        // Duplicate: keep the first name, use latest createdAt
        const existing = seen.get(newId)!
        if (p.createdAt && p.createdAt < existing.createdAt) {
          existing.createdAt = p.createdAt
        }
      } else {
        seen.set(newId, {
          id: newId,
          name: p.name,
          createdAt: p.createdAt || nowISO(),
          updatedAt: nowISO(),
        })
      }
    }

    const merged = Array.from(seen.values())
    const beforeCount = parsed.length
    const afterCount = merged.length
    if (beforeCount !== afterCount || migratedCount > 0) {
      console.log(`[SplitPeople:dedupe] before=${beforeCount} after=${afterCount}`)
      saveSplitPeople(merged)
    }
    console.log(`[SplitPeople:render] count=${merged.length}`)
    return merged
  } catch {
    return []
  }
}

function saveSplitPeople(people: StoredPerson[]): void {
  if (!storageAvailable()) return
  const seen = new Map<string, StoredPerson>()
  for (const p of people) {
    if (!p || !p.name) continue
    const id = stablePersonId(p.name)
    if (!id || id === 'unknown') continue
    if (!seen.has(id)) {
      seen.set(id, { ...p, id })
    }
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(seen.values())))
}

export function addSplitPerson(name: string): StoredPerson | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const id = stablePersonId(trimmed)
  if (!id || id === 'unknown') return null

  const stored = getSplitPeople()
  const existing = stored.find(p => p.id === id)
  if (existing) {
    console.log(`[SplitPeople] duplicate ignored id=${id}`)
    return existing
  }

  const person: StoredPerson = {
    id,
    name: trimmed,
    createdAt: nowISO(),
    updatedAt: nowISO(),
  }
  saveSplitPeople([...stored, person])
  console.log(`[SplitPeople] added id=${id}`)
  return person
}

export function removeSplitPerson(id: string): void {
  const stored = getSplitPeople()
  saveSplitPeople(stored.filter(p => p.id !== id))
}

export function renameSplitPerson(id: string, newName: string): StoredPerson | null {
  const trimmed = newName.trim()
  if (!trimmed) return null
  const stored = getSplitPeople()
  const existing = stored.find(p => p.id === id)
  if (!existing) return null
  removeSplitPerson(id)
  return addSplitPerson(trimmed)
}

export function clearSplitPeople(): void {
  if (!storageAvailable()) return
  localStorage.removeItem(STORAGE_KEY)
  console.log('[SplitPeople] cleared all')
}

export function hydrateFromTransactions(
  transactions: NormalizedTransaction[]
): StoredPerson[] {
  const stored = getSplitPeople()
  const seen = new Set(stored.map(p => p.id))
  const additions: StoredPerson[] = []

  for (const t of transactions) {
    if (!t.splitMetadata?.split.enabled) continue
    for (const p of t.splitMetadata.split.participants) {
      if (!p.name) continue
      const id = stablePersonId(p.name)
      if (!id || id === 'unknown' || seen.has(id)) continue
      seen.add(id)
      additions.push({
        id,
        name: p.name,
        createdAt: nowISO(),
        updatedAt: nowISO(),
      })
    }
  }

  console.log(`[SplitPeople:hydrate] incoming=${additions.length}`)

  if (additions.length > 0) {
    saveSplitPeople([...stored, ...additions])
  }

  const result = [...stored, ...additions]
  console.log(`[SplitPeople:hydrate] merged=${result.length}`)
  return result
}
