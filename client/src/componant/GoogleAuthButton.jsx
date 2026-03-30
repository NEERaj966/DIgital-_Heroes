import { useEffect, useRef, useState } from 'react'
import { getGoogleClientId, loadGoogleIdentityScript } from '../utils/googleAuth'

const GoogleAuthButton = ({ onCredential, onError, contextLabel = 'continue', buttonText = 'continue_with' }) => {
  const buttonRef = useRef(null)
  const shellRef = useRef(null)
  const onCredentialRef = useRef(onCredential)
  const onErrorRef = useRef(onError)
  const [state, setState] = useState({ loading: true, message: '', width: 320 })

  useEffect(() => {
    onCredentialRef.current = onCredential
  }, [onCredential])

  useEffect(() => {
    onErrorRef.current = onError
  }, [onError])

  useEffect(() => {
    if (!shellRef.current || typeof window === 'undefined') {
      return
    }

    const updateWidth = () => {
      const nextWidth = Math.max(240, Math.min(shellRef.current?.offsetWidth || 320, 420))
      setState((prev) => (prev.width === nextWidth ? prev : { ...prev, width: nextWidth }))
    }

    updateWidth()

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth)
      return () => window.removeEventListener('resize', updateWidth)
    }

    const observer = new ResizeObserver(updateWidth)
    observer.observe(shellRef.current)

    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let cancelled = false

    const initializeGoogle = async () => {
      const clientId = getGoogleClientId()

      if (!clientId) {
        setState({
          loading: false,
          message: 'Set VITE_GOOGLE_CLIENT_ID in the client environment to enable Google auth.',
        })
        return
      }

      try {
        const google = await loadGoogleIdentityScript()

        if (cancelled || !buttonRef.current) {
          return
        }

        google.accounts.id.initialize({
          client_id: clientId,
          callback: ({ credential }) => {
            if (!credential) {
              onErrorRef.current?.(new Error('Google did not return a credential'))
              return
            }

            onCredentialRef.current?.(credential)
          },
        })

        buttonRef.current.innerHTML = ''
        google.accounts.id.renderButton(buttonRef.current, {
          theme: 'outline',
          size: 'large',
          width: state.width,
          shape: 'pill',
          text: buttonText,
          logo_alignment: 'left',
        })

        setState((prev) => ({ ...prev, loading: false, message: '' }))
      } catch (error) {
        if (cancelled) {
          return
        }

        setState((prev) => ({
          ...prev,
          loading: false,
          message: error.message || 'Unable to load Google auth right now.',
        }))
        onErrorRef.current?.(error)
      }
    }

    initializeGoogle()

    return () => {
      cancelled = true
    }
  }, [buttonText, state.width])

  return (
    <div className="relative overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-[0_18px_48px_rgba(15,23,42,0.22)]">
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
      <div className="absolute -right-10 top-5 h-20 w-20 rounded-full bg-amber-300/10 blur-3xl" />
      <div className="absolute -left-8 bottom-4 h-16 w-16 rounded-full bg-white/6 blur-3xl" />

      <div className="relative z-10">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.32em] text-amber-300">Google {contextLabel}</p>
            <h3 className="mt-2 text-lg font-semibold text-white">Use your Google account</h3>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300">
            Fast Access
          </div>
        </div>

        <p className="mt-3 text-sm leading-7 text-slate-300">
          Continue with the Google account connected to your platform access and keep the sign-in experience consistent with the rest of the dashboard.
        </p>

        <div ref={shellRef} className="mt-5 rounded-[24px] border border-white/10 bg-slate-950/20 p-4 backdrop-blur-sm">
          {state.loading ? <p className="text-sm text-slate-300">Loading Google sign-in...</p> : null}
          {!state.loading && state.message ? <p className="text-sm text-rose-200">{state.message}</p> : null}
          <div ref={buttonRef} className={state.loading || state.message ? 'hidden' : 'flex justify-center'} />
        </div>
      </div>
    </div>
  )
}

export default GoogleAuthButton
