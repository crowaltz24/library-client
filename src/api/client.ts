const configuredApiUrl = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/$/, '')
// Vite proxies /api during local development, avoiding browser CORS preflight.
const API_URL = import.meta.env.DEV ? '' : configuredApiUrl

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('library_token')
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(body || `Request failed (${response.status})`)
  }
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function saveToken(token: string): void { localStorage.setItem('library_token', token) }
export function clearToken(): void { localStorage.removeItem('library_token') }
export function hasToken(): boolean { return Boolean(localStorage.getItem('library_token')) }
