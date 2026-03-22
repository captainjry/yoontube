import React from 'react'

import { PasswordForm } from '../../components/password-form'

export default function LoginPage() {
  return (
    <main className="app-shell app-shell--narrow app-shell--centered">
      <section className="login-card">
        <div className="login-grid">
          <div className="page-stack">
            <div>
              <p className="eyebrow">Yoontube access</p>
              <h1 className="login-title">Enter the private screening room</h1>
              <p className="login-copy">
                Use the shared password to unlock the library, jump between photos and videos, and watch in a cleaner space than Drive preview.
              </p>
            </div>
            <PasswordForm />
          </div>

          <aside className="login-aside" aria-label="Library highlights">
            <div>
              <p className="section-label">Inside the archive</p>
              <p className="section-copy">A quieter way to browse shared uploads with dedicated viewing pages and clear folder context.</p>
            </div>
            <ul className="login-list">
              <li>Browse one mixed library for photos and videos.</li>
              <li>Open browser-playable media without relying on Drive preview alone.</li>
              <li>Keep folders as light context instead of heavy navigation.</li>
            </ul>
          </aside>
        </div>
      </section>
    </main>
  )
}
