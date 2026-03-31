import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { userApi } from '../utils/api'

const UserContext = createContext(null)
const USER_STORAGE_KEY = 'digital-heroes-user'
const USER_TOKEN_STORAGE_KEY = 'digital-heroes-token'

const getStoredUser = () => {
  const savedToken = localStorage.getItem(USER_TOKEN_STORAGE_KEY)

  if (!savedToken) {
    localStorage.removeItem(USER_STORAGE_KEY)
    return null
  }

  const savedUser = localStorage.getItem(USER_STORAGE_KEY)

  if (!savedUser) {
    return null
  }

  try {
    return JSON.parse(savedUser)
  } catch {
    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(USER_TOKEN_STORAGE_KEY)
    return null
  }
}

const getStoredToken = () => localStorage.getItem(USER_TOKEN_STORAGE_KEY)

const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = getStoredUser()

    return savedUser
  })
  const [isSessionLoading, setIsSessionLoading] = useState(() => Boolean(getStoredToken()))
  const [sessionNotice, setSessionNotice] = useState('')

  const persistUser = useCallback((user) => {
    setCurrentUser(user)
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user))
  }, [])

  const saveUserSession = useCallback((user, token) => {
    persistUser(user)
    setSessionNotice('')

    if (token) {
      localStorage.setItem(USER_TOKEN_STORAGE_KEY, token)
    }
  }, [persistUser])

  const clearUserSession = useCallback(({ preserveNotice = false } = {}) => {
    setCurrentUser(null)

    if (!preserveNotice) {
      setSessionNotice('')
    }

    localStorage.removeItem(USER_STORAGE_KEY)
    localStorage.removeItem(USER_TOKEN_STORAGE_KEY)
  }, [])

  const refreshUserSession = useCallback(async () => {
    const savedToken = getStoredToken()

    if (!savedToken) {
      setIsSessionLoading(false)
      return null
    }

    setIsSessionLoading(true)

    try {
      const response = await userApi.get('/users/userProfile')
      const freshUser = response.data?.data

      if (!freshUser) {
        clearUserSession()
        return null
      }

      persistUser(freshUser)
      setSessionNotice('')
      return freshUser
    } catch (error) {
      const status = error.response?.status
      const message = error.response?.data?.message

      if (status === 401) {
        setSessionNotice(message || 'Please sign in again to continue.')
        clearUserSession({ preserveNotice: true })
        return null
      }

      if (status === 403) {
        setSessionNotice(message || 'Your subscription access could not be verified right now.')
        return getStoredUser()
      }

      throw error
    } finally {
      setIsSessionLoading(false)
    }
  }, [clearUserSession, persistUser])

  useEffect(() => {
    if (!getStoredToken()) {
      setCurrentUser(null)
      setIsSessionLoading(false)
      return
    }

    refreshUserSession().catch(() => {
      setIsSessionLoading(false)
    })
  }, [refreshUserSession])

  const value = useMemo(
    () => ({
      currentUser,
      isSessionLoading,
      sessionNotice,
      saveUserSession,
      clearUserSession,
      refreshUserSession,
    }),
    [clearUserSession, currentUser, isSessionLoading, refreshUserSession, saveUserSession, sessionNotice]
  )

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>
}

const useUser = () => {
  const context = useContext(UserContext)

  if (!context) {
    throw new Error('useUser must be used within UserProvider')
  }

  return context
}

export { UserProvider, useUser }
