
import { Navigate } from 'react-router-dom'

// Protect pages that require login
function ProtectedRoute({ children }) {

  // Check whether JWT token exists
  const token = localStorage.getItem('access_token')

  // If token does not exist, redirect to Login
  if (!token) {
    return <Navigate to="/login" replace />
  }

  // If token exists, allow access to the page
  return children
}

export default ProtectedRoute
