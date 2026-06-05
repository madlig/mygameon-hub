'use client'

import { signIn } from 'next-auth/react'
import { Gamepad2 } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-8 text-[var(--text)]">
      {/* Glow blobs */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-72 w-72 rounded-full bg-[var(--primary)]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-[var(--accent)]/25 blur-[120px]" />

      <div className="fadeUp relative z-10 mb-8 text-center">
        <div className="glow-primary mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--primary-fg)]">
          <Gamepad2 size={32} strokeWidth={1.9} />
        </div>
        <h1 className="brand-wordmark text-3xl">
          <span className="gradient-text">MyGameON</span>
        </h1>
        <p className="mt-1.5 text-[12px] font-medium uppercase tracking-[0.2em] text-[var(--text-3)]">Hub · Admin Panel</p>
      </div>

      <div className="fadeUp relative z-10 w-full max-w-[340px] rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)]/80 p-6 backdrop-blur-xl" style={{ animationDelay: '0.06s' }}>
        <p className="mb-5 text-center text-[13px] leading-relaxed text-[var(--text-2)]">
          Masuk dengan akun Google yang terdaftar sebagai admin
        </p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="pressable flex w-full items-center justify-center gap-3 rounded-2xl bg-[var(--primary)] py-3.5 text-[14px] font-bold text-[var(--primary-fg)] transition-all hover:brightness-105 hover:shadow-[0_10px_30px_-12px_rgba(255,209,0,0.6)]"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#0a0b0f" opacity=".9" />
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#0a0b0f" opacity=".75" />
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#0a0b0f" opacity=".6" />
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#0a0b0f" opacity=".45" />
          </svg>
          Login dengan Google
        </button>
      </div>

      <p className="fadeUp relative z-10 mt-6 text-center text-[10px] text-[var(--text-3)]" style={{ animationDelay: '0.12s' }}>
        Akses dibatasi — hanya admin yang terdaftar
      </p>
    </div>
  )
}
