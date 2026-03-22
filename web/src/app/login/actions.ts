'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

import { FRONTEND_SESSION_COOKIE_OPTIONS, verifyPasswordWithBackend } from '../../lib/backend'
import type { LoginState } from '../../lib/types'

export async function submitPassword(_previousState: LoginState, formData: FormData): Promise<LoginState> {
  const password = formData.get('password')

  if (typeof password !== 'string' || password.trim().length === 0) {
    return {
      error: 'Password is required',
    }
  }

  const result = await verifyPasswordWithBackend(password)

  if (!result.ok) {
    return {
      error: result.error,
    }
  }

  const cookieStore = await cookies()
  cookieStore.set(result.cookie.name, result.cookie.value, FRONTEND_SESSION_COOKIE_OPTIONS)

  redirect('/')
}
