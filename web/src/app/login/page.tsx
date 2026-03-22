'use client'

import { useActionState } from 'react'
import { login, type LoginState } from './actions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

const initialState: LoginState = { error: null }

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <div className="flex min-h-screen items-center justify-center">
      <form action={formAction} className="w-full max-w-sm space-y-4 p-4">
        <h1 className="text-2xl font-bold text-center">Yoontube</h1>
        <Input
          name="password"
          type="password"
          placeholder="Enter password"
          autoFocus
          required
        />
        {state.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? 'Signing in...' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
