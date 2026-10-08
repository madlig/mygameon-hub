'use client'

import { useState, useEffect, Suspense } from 'react'
import { signIn } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Gamepad2, Smartphone, KeyRound, Loader2, AlertCircle, ShieldCheck } from 'lucide-react'

function LoginContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState('pin') // 'pin' | 'google'

  useEffect(() => {
    const emailParam = searchParams.get('email')
    const pinParam = searchParams.get('pin')
    if (emailParam) setEmail(emailParam)
    if (pinParam) setPin(pinParam)

    // Jika keduanya disediakan (hasil scan QR Code desktop), langsung trigger login instan
    if (emailParam && pinParam) {
      handleLogin(emailParam, pinParam)
    }
  }, [searchParams])

  async function handleLogin(emailToUse = email, pinToUse = pin) {
    const cleanEmail = (emailToUse || '').trim()
    const cleanPin = (pinToUse || '').trim()

    if (!cleanEmail) {
      setError('Masukkan Email Admin')
      return
    }
    if (!cleanPin) {
      setError('Masukkan PIN Admin')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await signIn('credentials', {
        email: cleanEmail,
        pin: cleanPin,
        redirect: false,
        callbackUrl: '/'
      })

      if (res?.error || (res && !res.ok)) {
        setError('Email atau PIN Admin salah. Periksa kredensial di aplikasi desktop.')
        setLoading(false)
      } else {
        // Gunakan full page navigation agar Safari iOS mem-flush cookie sesi secara sinkron
        window.location.replace('/')
      }
    } catch (err) {
      setError(err.message || 'Gagal login ke studio')
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 sm:px-8 text-[var(--text)]">
      {/* Glow blobs */}
      <div className="pointer-events-none absolute -top-32 -left-24 h-72 w-72 rounded-full bg-[var(--primary)]/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-32 -right-24 h-72 w-72 rounded-full bg-[var(--accent)]/25 blur-[120px]" />

      <div className="fadeUp relative z-10 mb-6 text-center">
        <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-black/40 border border-white/10 p-2 shadow-xl shadow-amber-500/10">
          <img
            src="/brand/AMON_Shopee_Avatar_Circular_TransparentCorner.png"
            alt="MyGameON"
            className="h-full w-full object-contain"
          />
        </div>
        <h1 className="brand-wordmark text-2xl sm:text-3xl font-black">
          <span className="gradient-text">MyGameON</span>
        </h1>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--text-3)]">Hub · Admin Portal</p>
      </div>

      <div className="fadeUp relative z-10 w-full max-w-[360px] rounded-3xl border border-[var(--border-soft)] bg-[var(--surface)]/90 p-5 sm:p-6 backdrop-blur-xl shadow-2xl space-y-4">
        
        {/* Tab Switcher */}
        <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/10">
          <button
            type="button"
            onClick={() => setActiveTab('pin')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'pin'
                ? 'bg-gradient-to-r from-amber-500 to-amber-400 text-black shadow-md'
                : 'text-[var(--text-3)] hover:text-white'
            }`}
          >
            <Smartphone size={13} />
            <span>Akses HP / Mobile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('google')}
            className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'google'
                ? 'bg-white/15 text-white shadow-md'
                : 'text-[var(--text-3)] hover:text-white'
            }`}
          >
            <KeyRound size={13} />
            <span>Google Admin</span>
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-950/40 p-3 text-xs text-red-300 flex items-start gap-2">
            <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Tab 1: Email + PIN Login (Ideal for Smartphone) */}
        {activeTab === 'pin' && (
          <form onSubmit={(e) => { e.preventDefault(); handleLogin() }} className="space-y-3 pt-1">
            <p className="text-xs text-[var(--text-3)] leading-relaxed text-center">
              Masukkan Email Admin dan PIN untuk otentikasi ganda dari smartphone Anda.
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[var(--text-4)] font-bold block">
                Email Admin:
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@mygameon.store"
                autoComplete="email"
                className="w-full text-xs text-white bg-black/50 px-3 py-2.5 rounded-xl border border-white/15 focus:border-amber-400 focus:outline-none transition-all placeholder:text-[var(--text-4)]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-mono uppercase text-[var(--text-4)] font-bold block">
                PIN Admin:
              </label>
              <input
                type="password"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                placeholder="PIN Admin"
                autoComplete="current-password"
                className="w-full font-mono text-center tracking-widest text-sm text-white bg-black/50 px-3 py-2.5 rounded-xl border border-white/15 focus:border-amber-400 focus:outline-none transition-all placeholder:tracking-normal placeholder:text-xs placeholder:text-[var(--text-4)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="pressable w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 text-black font-extrabold text-xs flex items-center justify-center gap-2 hover:from-amber-400 hover:to-amber-300 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 cursor-pointer"
            >
              {loading ? <Loader2 size={16} className="animate-spin text-black" /> : <ShieldCheck size={16} />}
              <span>Masuk ke Dashboard Studio</span>
            </button>

            <p className="text-[10px] text-center text-[var(--text-4)] pt-1">
              💡 Scan QR Code di menu <b>Akses HP</b> aplikasi desktop untuk masuk otomatis 1-tap.
            </p>
          </form>
        )}

        {/* Tab 2: Google OAuth (Desktop / Localhost) */}
        {activeTab === 'google' && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-[var(--text-3)] leading-relaxed text-center">
              Login menggunakan akun Google resmi admin (khusus akses di PC atau domain resmi).
            </p>
            <button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="pressable flex w-full items-center justify-center gap-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 py-3 text-xs font-bold text-white transition-all cursor-pointer"
            >
              <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4" />
                <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853" />
                <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05" />
                <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335" />
              </svg>
              <span>Login dengan Google</span>
            </button>
          </div>
        )}

      </div>

      <p className="fadeUp relative z-10 mt-6 text-center text-[10px] text-[var(--text-4)]">
        Akses khusus Administrator MyGameON Hub
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#0a0b0f]">
        <Loader2 size={28} className="animate-spin text-amber-400" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
