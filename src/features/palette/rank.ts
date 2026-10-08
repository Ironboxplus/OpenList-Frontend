// Fuzzy ranking for the command palette and the settings search box.
//
// Pure and dependency free. A query is split on whitespace; every token must
// match the title or one of the keywords. Matching is substring / subsequence
// based on single characters, so Chinese works per character ("新同" finds
// "新建同步作业"). Pinyin and pinyin initials are deliberately NOT supported:
// "xs" does not find "限速". Say so in the tests, not in the UI.

export interface Rankable {
  title: string
  keywords: readonly string[]
}

const EXACT = 100
const PREFIX = 80
const WORD_START = 60
const SUBSTRING = 40
const SUBSEQUENCE = 20
/** A keyword hit counts for less than the same hit in the title. */
const KEYWORD_WEIGHT = 0.7

const normalize = (s: string): string => s.normalize("NFKC").toLowerCase().trim()

const isWordBoundary = (text: string, i: number): boolean => {
  if (i === 0) return true
  return /[\s\-_./:#@]/.test(text[i - 1])
}

/** Score of one token against one (already normalised) field; 0 for no match. */
const scoreField = (token: string, field: string): number => {
  if (field === "") return 0
  if (field === token) return EXACT
  if (field.startsWith(token)) return PREFIX
  let at = field.indexOf(token)
  if (at >= 0) {
    // Prefer a hit at a word start over one in the middle of a word.
    while (at >= 0) {
      if (isWordBoundary(field, at)) return WORD_START
      at = field.indexOf(token, at + 1)
    }
    return SUBSTRING
  }
  if (token.length < 2) return 0
  // Subsequence: every char of the token, in order. Gaps cost points.
  let pos = -1
  let gaps = 0
  for (const ch of token) {
    const next = field.indexOf(ch, pos + 1)
    if (next < 0) return 0
    if (pos >= 0) gaps += next - pos - 1
    pos = next
  }
  return Math.max(1, SUBSEQUENCE - Math.min(gaps, SUBSEQUENCE - 1))
}

const scoreToken = (token: string, title: string, keywords: string[]): number => {
  let best = scoreField(token, title)
  for (const k of keywords) {
    const s = scoreField(token, k) * KEYWORD_WEIGHT
    if (s > best) best = s
  }
  return best
}

/**
 * 0 means "does not match". A blank query matches everything with a small
 * neutral score so callers need no special case.
 */
export const rank = (query: string, item: Rankable): number => {
  const tokens = normalize(query).split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 1
  const title = normalize(item.title)
  const keywords = item.keywords.map(normalize)
  let total = 0
  for (const token of tokens) {
    const s = scoreToken(token, title, keywords)
    if (s === 0) return 0
    total += s
  }
  return total
}

/** Matching items, best first; ties keep their input order. */
export const rankAll = <T extends Rankable>(query: string, items: readonly T[]): T[] =>
  items
    .map((item, index) => ({ item, index, score: rank(query, item) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((r) => r.item)
