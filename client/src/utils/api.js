import axios from 'axios'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1'

const createScopedApi = (storageKey) => {
  const client = axios.create({
    baseURL,
    withCredentials: true,
  })

  client.interceptors.request.use((config) => {
    const token = storageKey ? localStorage.getItem(storageKey) : null

    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    } else if (config.headers?.Authorization) {
      delete config.headers.Authorization
    }

    return config
  })

  return client
}

const api = createScopedApi(null)
export const userApi = createScopedApi('digital-heroes-token')
export const adminApi = createScopedApi('digital-heroes-admin-token')

export default api
