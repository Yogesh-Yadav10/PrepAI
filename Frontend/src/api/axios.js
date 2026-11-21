
import axios from 'axios'

const api = axios.create({
  baseURL: 'http://127.0.0.1:8000',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('access_token')

    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error)
)

let isSessionExpired = false

// Response Interceptor
api.interceptors.response.use(
  (response) => response,

  (error) => {
    if (error.response?.status === 401) {
      const token = localStorage.getItem('access_token')
      const isLoginRequest = error.config?.url?.includes('/login')

      if (token && !isLoginRequest && !isSessionExpired) {
        isSessionExpired = true

        localStorage.removeItem('access_token')
        localStorage.removeItem('user')

        window.dispatchEvent(new Event('session-expired'))
      }
    }

    return Promise.reject(error)
  }
)

export default api
