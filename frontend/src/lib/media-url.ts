import { getApiBaseUrl } from "@/lib/api"

const OWN_MEDIA = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const MAX_OPTION_IMAGE_BYTES = 3 * 1024 * 1024

export function isAcceptableImageUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed || trimmed.length > 2000) return false
  if (OWN_MEDIA.test(trimmed)) return true
  if (trimmed.startsWith("//") || /\s/.test(trimmed)) return false

  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return false
    if (url.username || url.password) return false
    return Boolean(url.hostname)
  } catch {
    return false
  }
}

export function resolveMediaUrl(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  if (trimmed.startsWith("/api/")) {
    const base = getApiBaseUrl().replace(/\/$/, "")
    return `${base}${trimmed}`
  }
  return trimmed
}
