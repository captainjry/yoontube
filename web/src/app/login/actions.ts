'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createSessionToken, getSessionSecret, getSharedPassword, SESSION_COOKIE_NAME } from '@/lib/auth'

export type LoginState = { error: string | null }

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get('password')

  if (typeof password !== 'string' || !password) {
    return { error: 'Password is required' }
  }

  if (password !== getSharedPassword()) {
    return { error: 'Incorrect password' }
  }

  const token = createSessionToken(getSessionSecret())
  const cookieStore = await cookies()

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  redirect('/')
}
