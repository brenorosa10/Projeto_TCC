const TOKEN_KEY = "astro_access_token"

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearAccessToken() {
  localStorage.removeItem(TOKEN_KEY)
}

export function consumeTokenFromUrl(): string | null {
  const hash = window.location.hash.startsWith("#")
    ? new URLSearchParams(window.location.hash.slice(1))
    : new URLSearchParams()
  const query = new URLSearchParams(window.location.search)
  const token = hash.get("access_token") ?? query.get("access_token")
  if (!token) {
    return null
  }

  hash.delete("access_token")
  query.delete("access_token")
  const nextQuery = query.toString()
  const nextHash = hash.toString()
  const url = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}${nextHash ? `#${nextHash}` : ""}`
  window.history.replaceState(null, "", url)
  return token
}

export function getAuthErrorFromUrl(): string | null {
  return new URLSearchParams(window.location.search).get("error")
}
