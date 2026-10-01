import { request, saveToken } from './client'

interface AuthResponse { access_token: string; token_type: string; user_id: number }

export async function login(identifier: string, password: string): Promise<void> {
  const result = await request<AuthResponse>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: identifier, password }) })
  saveToken(result.access_token)
}

export async function register(identifier: string, password: string): Promise<void> {
  await request('/api/auth/register', { method: 'POST', body: JSON.stringify({ username: identifier, password }) })
  await login(identifier, password)
}
