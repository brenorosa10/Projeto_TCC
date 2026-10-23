import type { LiveSessionState } from "@/lib/types"

const STORAGE_KEY = "astro.live.student"

export type StoredLiveJoin = {
  pin: string
  userId: string
}

export function readStoredLiveJoin(): StoredLiveJoin | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredLiveJoin>
    if (!parsed.pin || parsed.pin.length !== 6 || !parsed.userId) return null
    return { pin: parsed.pin, userId: parsed.userId }
  } catch {
    return null
  }
}

export function writeStoredLiveJoin(value: StoredLiveJoin) {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
}

export function clearStoredLiveJoin() {
  sessionStorage.removeItem(STORAGE_KEY)
}

export function presentedQuestionCount(
  state: Pick<LiveSessionState, "phase" | "itemIndex" | "itemCount" | "presentedCount">
) {
  if (typeof state.presentedCount === "number") return state.presentedCount
  if (state.phase === "lobby" || state.itemIndex < 0) return 0
  return Math.min(state.itemCount, state.itemIndex + 1)
}
