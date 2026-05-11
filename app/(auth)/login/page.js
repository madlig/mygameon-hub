'use client'

import { signIn } from 'next-auth/react'
import { Gamepad2 } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[var(--bg)] px-8 text-[var(--text)]">
      <div className="mb-8 text-center">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--primary)] text-[var(--primary-fg)]"
          style={{ boxShadow: '0 8px 32px -8px rgba(245,158,11,.5)' }}
        >
          <Gamepad2 size={32} strokeWidth={1.75} />
        </div>
        <h1 className="text-[22px] font-semibold tracking-tight">
          MyGameON <span className="text-[var(--primary)]">Hub</span>
        </h1>
        <p className="mt-1 text-[12px] text-[var(--text-3)]">Admin panel</p>
      </div>

      <div className="w-full max-w-[320px] rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-6">
        <p className="mb-5 text-center text-[12px] leading-relaxed text-[var(--text-3)]">
          Login dengan akun Google yang terdaftar sebagai admin
        </p>
        <button
          onClick={() => signIn('google', { callbackUrl: '/' })}
          className="pressable flex w-full items-center justify-center gap-3 rounded-xl bg-[var(--primary)] py-3 text-[13px] font-semibold text-[var(--primary-fg)] transition-all hover:brightness-105"
        >
          <svg width="17" height="17" viewBox="0 0 18 18" fill="none" aria-hidden="true">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#1C1917" opacity=".9" />
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#1C1917" opacity=".75" />
            <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#1C1917" opacity=".6" />
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#1C1917" opacity=".45" />
          </svg>
          Login dengan Google
        </button>
      </div>

      <p className="mt-6 text-center text-[10px] text-[var(--text-3)]">
        Akses dibatasi - hanya admin yang terdaftar
      </p>
    </div>
  )
}
