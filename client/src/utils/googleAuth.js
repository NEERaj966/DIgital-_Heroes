const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client'

let googleScriptPromise

export const getGoogleClientId = () => import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

export const loadGoogleIdentityScript = () => {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Identity Services is only available in the browser'))
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google)
  }

  if (!googleScriptPromise) {
    googleScriptPromise = new Promise((resolve, reject) => {
      const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`)

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(window.google))
        existingScript.addEventListener('error', () => reject(new Error('Unable to load Google Identity Services')))
        return
      }

      const script = document.createElement('script')
      script.src = GOOGLE_SCRIPT_SRC
      script.async = true
      script.defer = true
      script.onload = () => resolve(window.google)
      script.onerror = () => reject(new Error('Unable to load Google Identity Services'))
      document.body.appendChild(script)
    })
  }

  return googleScriptPromise
}

export const decodeGoogleCredential = (credential) => {
  const parts = String(credential || '').split('.')

  if (parts.length !== 3) {
    throw new Error('Google credential is invalid')
  }

  const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
  const json = decodeURIComponent(
    atob(payload)
      .split('')
      .map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join('')
  )

  return JSON.parse(json)
}
