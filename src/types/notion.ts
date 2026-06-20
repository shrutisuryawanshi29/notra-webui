export interface NotionPage {
  id: string
  created_time: string
  last_edited_time: string
  parent: NotionParent
  url: string
  properties: Record<string, NotionPropertyValue> | null
  archived: boolean
  object?: string
}

export interface NotionParent {
  type: string
  database_id?: string
  page_id?: string
}

export type NotionPropertyValue =
  | { type: 'title'; title: Array<{ plain_text: string }>; id?: string }
  | { type: 'rich_text'; rich_text: Array<{ plain_text: string }>; id?: string }
  | { type: 'number'; number: number | null; id?: string }
  | { type: 'select'; select: { name: string; id: string } | null; id?: string }
  | { type: 'multi_select'; multi_select: Array<{ name: string; id: string }>; id?: string }
  | { type: 'date'; date: { start: string; end: string | null } | null; id?: string }
  | { type: 'relation'; relation: Array<{ id: string }>; id?: string }
  | { type: 'checkbox'; checkbox: boolean; id?: string }
  | { type: 'url'; url: string | null; id?: string }
  | { type: 'email'; email: string | null; id?: string }
  | { type: 'phone_number'; phone_number: string | null; id?: string }
  | { type: 'status'; status: { name: string } | null; id?: string }

export interface NotionDatabase {
  id: string
  title: Array<{ plain_text: string }>
  properties: Record<string, NotionPropertyType>
}

export interface NotionPropertyType {
  id: string
  name: string
  type: string
  [key: string]: unknown
}

export interface NotionQueryResult {
  results: NotionPage[]
  has_more: boolean
  next_cursor: string | null
}

export interface NotionUser {
  id: string
  name?: string
  type?: string
}

export interface NotionSearchResult {
  results: NotionPage[]
  has_more: boolean
  next_cursor: string | null
}
