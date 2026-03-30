import { ApiError } from './Apierror.js'

const GOOGLE_TOKENINFO_URL = 'https://oauth2.googleapis.com/tokeninfo'

const normalizeEmail = (email) => String(email || '').trim().toLowerCase()

export const verifyGoogleToken = async (idToken) => {
    const normalizedToken = String(idToken || '').trim()

    if (!normalizedToken) {
        throw new ApiError(400, 'Google credential is required')
    }

    const googleClientId = String(process.env.GOOGLE_CLIENT_ID || '').trim()

    if (!googleClientId) {
        throw new ApiError(500, 'Google authentication is not configured on the server')
    }

    const response = await fetch(`${GOOGLE_TOKENINFO_URL}?id_token=${encodeURIComponent(normalizedToken)}`)

    if (!response.ok) {
        throw new ApiError(401, 'Google credential could not be verified')
    }

    const payload = await response.json()
    const audience = payload.aud || payload.azp

    if (audience !== googleClientId) {
        throw new ApiError(401, 'Google credential is not valid for this application')
    }

    if (payload.email_verified !== 'true') {
        throw new ApiError(401, 'Google account email must be verified')
    }

    const email = normalizeEmail(payload.email)

    if (!email) {
        throw new ApiError(400, 'Google account email is not available')
    }

    return {
        googleId: String(payload.sub || '').trim(),
        email,
        name: String(payload.name || payload.given_name || email.split('@')[0] || 'Google User').trim(),
        avatar: String(payload.picture || '').trim()
    }
}
