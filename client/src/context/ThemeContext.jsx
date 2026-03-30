import { createContext, useContext, useEffect, useMemo, useState } from 'react'

const THEME_STORAGE_KEY = 'digital-heroes-theme'
const ThemeContext = createContext(null)

const getStoredTheme = () => {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  return savedTheme === 'light' ? 'light' : 'dark'
}

const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getStoredTheme)

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
    document.documentElement.classList.toggle('light-theme', theme === 'light')
  }, [theme])

  const value = useMemo(
    () => ({
      theme,
      setTheme,
      toggleTheme: () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

const useTheme = () => {
  const context = useContext(ThemeContext)

  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }

  return context
}

export { ThemeProvider, useTheme }
