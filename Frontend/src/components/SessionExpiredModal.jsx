
import { useEffect, useState } from 'react'

export default function SessionExpiredModal() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handleSessionExpired = () => setShow(true)

    window.addEventListener('session-expired', handleSessionExpired)

    return () => {
      window.removeEventListener('session-expired', handleSessionExpired)
    }
  }, [])

  const handleLogin = () => {
    window.location.assign('/login')
  }

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111827] p-7 shadow-2xl">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10 text-3xl">
          🔒
        </div>

        <h2 className="mb-2 text-2xl font-bold text-white">
          Session Expired
        </h2>

        <p className="mb-7 text-gray-400">
          Your session has expired. Please login again to continue using PrepAI.
        </p>

        <button
          onClick={handleLogin}
          className="w-full rounded-xl bg-teal-400 px-5 py-3 font-semibold text-gray-900 transition hover:bg-teal-300"
        >
          Login Again
        </button>
      </div>
    </div>
  )
}
