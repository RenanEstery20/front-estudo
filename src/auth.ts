import { api } from './api'

const TOKEN_KEY = 'credentials-front.access-token'
const USER_KEY = 'credentials-front.user'

export type AuthUser = {
  id: string
  email: string
  name: string
  createdAt: string
}

type LoginResponse = {
  accessToken: string
  tokenType: 'Bearer'
  user: AuthUser
}

type RegisterResponse = {
  message: string
  user: AuthUser
}

type RegisterInput = {
  name: string
  email: string
  password: string
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function isAuthenticated(): boolean {
  return Boolean(getToken())
}

export function getCurrentUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as AuthUser
  } catch {
    localStorage.removeItem(USER_KEY)
    return null
  }
}

function setSession(accessToken: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, accessToken)
  localStorage.setItem(USER_KEY, JSON.stringify(user))
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await api.post<LoginResponse>('/login', { email, password })
  setSession(res.data.accessToken, res.data.user)
  return res.data.user
}

export async function register(input: RegisterInput): Promise<AuthUser> {
  const res = await api.post<RegisterResponse>('/register', input)
  return res.data.user
}

export function logout(): void {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
