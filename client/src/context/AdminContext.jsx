import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../utils/api'

const AdminContext = createContext(null)
const ADMIN_STORAGE_KEY = 'digital-heroes-admin'
const ADMIN_TOKEN_STORAGE_KEY = 'digital-heroes-admin-token'

const getStoredAdmin = () => {
  const savedToken = localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)

  if (!savedToken) {
    localStorage.removeItem(ADMIN_STORAGE_KEY)
    return null
  }

  const savedAdmin = localStorage.getItem(ADMIN_STORAGE_KEY)

  if (!savedAdmin) {
    return null
  }

  try {
    return JSON.parse(savedAdmin)
  } catch {
    localStorage.removeItem(ADMIN_STORAGE_KEY)
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
    return null
  }
}

const getStoredAdminToken = () => localStorage.getItem(ADMIN_TOKEN_STORAGE_KEY)

const AdminProvider = ({ children }) => {
  const [currentAdmin, setCurrentAdmin] = useState(() => {
    const savedAdmin = getStoredAdmin()

    return savedAdmin
  })
  const [isAdminSessionLoading, setIsAdminSessionLoading] = useState(() => Boolean(getStoredAdminToken()))
  const [adminSessionNotice, setAdminSessionNotice] = useState('')

  const persistAdmin = useCallback((admin) => {
    setCurrentAdmin(admin)
    localStorage.setItem(ADMIN_STORAGE_KEY, JSON.stringify(admin))
  }, [])

  const saveAdminSession = useCallback((admin, token) => {
    persistAdmin(admin)
    setAdminSessionNotice('')

    if (token) {
      localStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, token)
    }
  }, [persistAdmin])

  const clearAdminSession = useCallback(({ preserveNotice = false } = {}) => {
    setCurrentAdmin(null)

    if (!preserveNotice) {
      setAdminSessionNotice('')
    }

    localStorage.removeItem(ADMIN_STORAGE_KEY)
    localStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY)
  }, [])

  const refreshAdminSession = useCallback(async () => {
    const savedToken = getStoredAdminToken()

    if (!savedToken) {
      setIsAdminSessionLoading(false)
      return null
    }

    setIsAdminSessionLoading(true)

    try {
      const response = await adminApi.get('/admins/adminProfile')
      const freshAdmin = response.data?.data

      if (!freshAdmin) {
        clearAdminSession()
        return null
      }

      persistAdmin(freshAdmin)
      setAdminSessionNotice('')
      return freshAdmin
    } catch (error) {
      const status = error.response?.status
      const message = error.response?.data?.message

      if (status === 401 || status === 403) {
        setAdminSessionNotice(message || 'Please sign in again as admin to continue.')
        clearAdminSession({ preserveNotice: true })
        return null
      }

      throw error
    } finally {
      setIsAdminSessionLoading(false)
    }
  }, [clearAdminSession, persistAdmin])

  useEffect(() => {
    if (!getStoredAdminToken()) {
      setCurrentAdmin(null)
      setIsAdminSessionLoading(false)
      return
    }

    refreshAdminSession().catch(() => {
      setIsAdminSessionLoading(false)
    })
  }, [refreshAdminSession])

  const value = useMemo(
    () => ({
      currentAdmin,
      isAdminSessionLoading,
      adminSessionNotice,
      saveAdminSession,
      clearAdminSession,
      refreshAdminSession,
    }),
    [adminSessionNotice, clearAdminSession, currentAdmin, isAdminSessionLoading, refreshAdminSession, saveAdminSession],
  )

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

const useAdmin = () => {
  const context = useContext(AdminContext)

  if (!context) {
    throw new Error('useAdmin must be used within AdminProvider')
  }

  return context
}

export { AdminProvider, useAdmin }
