
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import api from '../api/axios'

function Login() {
  const navigate = useNavigate()

  // Form input states
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  // Message and loading states
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Handle login form submission
  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')
    setSuccess('')

    // Check email
    if (!email.trim()) {
      setError('Please enter your email address.')
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address.')
      return
    }

    // Check password
    if (!password) {
      setError('Please enter your password.')
      return
    }

    try {
      setLoading(true)

      // Send login credentials to FastAPI backend
      const response = await api.post('/login', {
        email: email.trim(),
        password: password,
      })

      // Get data returned by backend
      const data = response.data

      // Save JWT token in localStorage
      localStorage.setItem('access_token', data.access_token)

      // Save basic user information
      localStorage.setItem(
        'user',
        JSON.stringify({
          user_id: data.user_id,
          name: data.name,
          email: data.email,
        })
      )

      // Show successful login message
      setSuccess('Login successful! Redirecting...')

      // Redirect to Dashboard
      navigate('/dashboard')

    } catch (err) {
      // Handle errors returned by backend
      const message =
        err.response?.data?.detail ||
        err.response?.data?.message ||
        'Login failed. Please check your credentials.'

      setError(
        typeof message === 'string'
          ? message
          : 'Login failed. Please check your credentials.'
      )

    } finally {
      // Stop loading after API request
      setLoading(false)
    }
  }

  // Clear messages when email changes
  const handleEmailChange = (e) => {
    setEmail(e.target.value)
    setError('')
    setSuccess('')
  }

  // Clear messages when password changes
  const handlePasswordChange = (e) => {
    setPassword(e.target.value)
    setError('')
    setSuccess('')
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="relative w-full max-w-md">

        {/* Background Glow */}
        <div className="absolute -inset-2 bg-linear-to-r from-blue-600 via-cyan-500 to-purple-600 rounded-3xl blur-2xl opacity-25"></div>

        {/* Login Card */}
        <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-7 sm:p-9">

          {/* Brand */}
          <div className="text-center mb-10">
            <h1 className="text-4xl font-bold text-white tracking-wide">
              Prep<span className="text-blue-500">AI</span>
            </h1>
          </div>


          {/* Login Form */}
          <form
            onSubmit={handleSubmit}
            noValidate
            autoComplete="off"
            className="space-y-5"
          >

            {/* Email */}
            <div>
              <label className="block text-slate-300 text-sm mb-2">
                Email Address
              </label>

              <input
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={handleEmailChange}
                placeholder="Enter your email"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between mb-2">
                <label className="text-slate-300 text-sm">
                  Password
                </label>
              </div>

              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter your password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 pr-12 text-white outline-none focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            {/* Success Message */}
            {success && (
              <p className="text-green-400 text-sm">{success}</p>
            )}

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? 'SIGNING IN...' : 'SIGN IN'}
            </button>

          </form>

          {/* Register Link */}
          <p className="text-center text-slate-400 text-sm mt-8">
            Don't have an account?{' '}
            <Link to="/register" className="text-blue-400 underline">
              Sign up
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}

export default Login
