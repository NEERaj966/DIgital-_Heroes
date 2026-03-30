import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { userApi } from '../utils/api'

const UserContext = createContext(null)

const getStoredUser = () => {
  const savedUser = localStorage.getItem('digital-heroes-user')

  if (!savedUser) {
    return null
  }

  try {
    return JSON.parse(savedUser)
  } catch {
    localStorage.removeItem('digital-heroes-user')
    return null
  }
}

const getStoredToken = () => localStorage.getItem('digital-heroes-token')

const UserProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = getStoredUser()

    return savedUser
  })
  const [isSessionLoading, setIsSessionLoading] = useState(() => Boolean(getStoredToken()))
  const [sessionNotice, setSessionNotice] = useState('')

  const persistUser = useCallback((user) => {
    setCurrentUser(user)
    localStorage.setItem('digital-heroes-user', JSON.stringify(user))
  }, [])

  const saveUserSession = useCallback((user, token) => {
    persistUser(user)
    setSessionNotice('')

    if (token) {
      localStorage.setItem('digital-heroes-token', token)
    }
  }, [persistUser])

  const clearUserSession = useCallback(({ preserveNotice = false } = {}) => {
    setCurrentUser(null)

    if (!preserveNotice) {
      setSessionNotice('')
    }

    localStorage.removeItem('digital-heroes-user')
    localStorage.removeItem('digital-heroes-token')
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
