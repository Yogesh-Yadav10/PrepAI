
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import api from '../api/axios'

function Register() {
  const navigate = useNavigate()

  // Store all registration form values
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  })

  // Store error, success and loading messages
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  // Handle input changes
  function handleChange(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    })

    setError('')
    setSuccess('')
  }

  // Handle registration form submission
  async function handleSubmit(e) {
    e.preventDefault()

    setError('')
    setSuccess('')

    // Validate full name
    if (!formData.name.trim()) {
      setError('Please enter your full name.')
      return
    }

    // Validate email
    if (!formData.email.trim()) {
      setError('Please enter your email.')
      return
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address.')
      return
    }

    // Validate password length
    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    // Check uppercase letter
    if (!/[A-Z]/.test(formData.password)) {
      setError('Password must contain an uppercase letter.')
      return
    }

    // Check lowercase letter
    if (!/[a-z]/.test(formData.password)) {
      setError('Password must contain a lowercase letter.')
      return
    }

    // Check number
    if (!/[0-9]/.test(formData.password)) {
      setError('Password must contain a number.')
      return
    }

    // Check special character
    if (!/[^A-Za-z0-9]/.test(formData.password)) {
      setError('Password must contain a special character.')
      return
    }

    // Check confirm password
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    try {
      setLoading(true)

      // Send registration details to FastAPI
      const response = await api.post('/users', {
        name: formData.name.trim(),
        email: formData.email.trim(),
        password: formData.password
      })

      // Show success message
      setSuccess(
        typeof response.data === 'string'
          ? response.data
          : response.data.message || 'Account created successfully!'
      )

      // Redirect to Login page after successful registration
      navigate('/login', {
        state: { registrationSuccess: true }
      })

    } catch (err) {
      // Get error message from backend
      const detail = err.response?.data?.detail

      // Handle string or validation error responses
      let message = 'Registration failed. Please try again.'

      if (typeof detail === 'string') {
        message = detail
      } else if (Array.isArray(detail)) {
        message = detail
          .map((item) => item.msg)
          .join(', ')
      } else if (err.response?.data?.message) {
        message = err.response.data.message
      }

      setError(message)

    } finally {
      // Stop loading after API request
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">

      <div className="relative w-full max-w-md">

        {/* Background Glow */}
        <div className="absolute -inset-2 bg-linear-to-r from-blue-600 via-cyan-500 to-purple-600 rounded-3xl blur-2xl opacity-25"></div>

        {/* Register Card */}
        <div className="relative bg-slate-900 border border-slate-700 rounded-xl p-7 sm:p-9">

          {/* Brand */}
          <div className="text-center mb-7">
            <h1 className="text-4xl font-bold text-white">
              Prep<span className="text-blue-500">AI</span>
            </h1>

            <p className="text-slate-400 mt-3">
              Create your account and start preparing smarter.
            </p>
          </div>

          {/* Registration Form */}
          <form
            onSubmit={handleSubmit}
            noValidate
            autoComplete="off"
            className="space-y-4"
          >

            {/* Full Name */}
            <div>
              <label className="block text-slate-300 text-sm mb-2">
                Full Name
              </label>

              <input
                name="name"
                type="text"
                autoComplete="off"
                value={formData.name}
                onChange={handleChange}
                placeholder="Enter your full name"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Email */}
            <div>
              <label className="block text-slate-300 text-sm mb-2">
                Email Address
              </label>

              <input
                name="email"
                type="email"
                autoComplete="off"
                value={formData.email}
                onChange={handleChange}
                placeholder="Enter your email"
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white outline-none focus:border-blue-500"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-slate-300 text-sm mb-2">
                Password
              </label>

              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="off"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
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

            {/* Confirm Password */}
            <div>
              <label className="block text-slate-300 text-sm mb-2">
                Confirm Password
              </label>

              <div className="relative">
                <input
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="off"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 pr-12 text-white outline-none focus:border-blue-500"
                />

                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
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

            {/* Create Account Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-lg transition"
            >
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            </button>

          </form>

          {/* Login Link */}
          <p className="text-center text-slate-400 text-sm mt-7">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 underline">
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </div>
  )
}

export default Register
