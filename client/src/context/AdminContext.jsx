import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { adminApi } from '../utils/api'

const AdminContext = createContext(null)

const getStoredAdmin = () => {
  const savedAdmin = localStorage.getItem('digital-heroes-admin')

  if (!savedAdmin) {
    return null
  }

  try {
    return JSON.parse(savedAdmin)
  } catch {
    localStorage.removeItem('digital-heroes-admin')
    return null
  }
}

const getStoredAdminToken = () => localStorage.getItem('digital-heroes-admin-token')

const AdminProvider = ({ children }) => {
  const [currentAdmin, setCurrentAdmin] = useState(() => {
    const savedAdmin = getStoredAdmin()

    return savedAdmin
  })
  const [isAdminSessionLoading, setIsAdminSessionLoading] = useState(() => Boolean(getStoredAdminToken()))
  const [adminSessionNotice, setAdminSessionNotice] = useState('')

  const persistAdmin = useCallback((admin) => {
    setCurrentAdmin(admin)
    localStorage.setItem('digital-heroes-admin', JSON.stringify(admin))
  }, [])

  const saveAdminSession = useCallback((admin, token) => {
    persistAdmin(admin)
    setAdminSessionNotice('')

    if (token) {
      localStorage.setItem('digital-heroes-admin-token', token)
    }
  }, [persistAdmin])

  const clearAdminSession = useCallback(({ preserveNotice = false } = {}) => {
    setCurrentAdmin(null)

    if (!preserveNotice) {
      setAdminSessionNotice('')
    }

    localStorage.removeItem('digital-heroes-admin')
    localStorage.removeItem('digital-heroes-admin-token')
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
