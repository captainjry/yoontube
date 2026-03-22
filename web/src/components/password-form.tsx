'use client'

import React from 'react'
import { useActionState } from 'react'

import { submitPassword } from '../app/login/actions'
import { DEFAULT_LOGIN_STATE } from '../app/login/state'

export function PasswordForm() {
  const [state, formAction, isPending] = useActionState(submitPassword, DEFAULT_LOGIN_STATE)

  return (
    <form action={formAction} className="password-form">
      <div className="field-group">
        <label htmlFor="password" className="field-label">
          Shared password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="text-input"
          placeholder="Enter the library password"
        />
        <p className="field-note">Only people with the shared password can open this collection.</p>
      </div>
      <button type="submit" disabled={isPending} className="submit-button">
        {isPending ? 'Checking...' : 'Unlock library'}
      </button>
      {state.error ? <p className="error-message">{state.error}</p> : null}
    </form>
  )
}
