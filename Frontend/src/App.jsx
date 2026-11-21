
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'

import Home from './pages/Home'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import MCQTest from './pages/MCQTest'
import TextTest from './pages/TextTest'
import History from './pages/History'
import ResumeAnalyzer from './pages/ResumeAnalyzer'
import JDAnalyzer from './pages/JDAnalyzer'
import SessionExpiredModal from './components/SessionExpiredModal'
import ProtectedRoute from './components/ProtectedRoute'

function App() {

  // Restore saved theme
  useEffect(() => {
    const savedTheme = localStorage.getItem('prepai_theme') || 'dark'

    document.documentElement.setAttribute('data-theme', savedTheme)
  }, [])

  return (
    <BrowserRouter>

      <Routes>

        {/* Public Routes */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />


        {/* Test History */}
        <Route
          path="/history"
          element={
            <ProtectedRoute>
              <History />
            </ProtectedRoute>
          }
        />


        {/* Resume Analyzer */}
        <Route
          path="/resume-analyzer"
          element={
            <ProtectedRoute>
              <ResumeAnalyzer />
            </ProtectedRoute>
          }
        />


        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />


        {/* MCQ Test */}
        <Route
          path="/mcq-test"
          element={
            <ProtectedRoute>
              <MCQTest />
            </ProtectedRoute>
          }
        />


        {/* Text Based Test */}
        <Route
          path="/text-test"
          element={
            <ProtectedRoute>
              <TextTest />
            </ProtectedRoute>
          }
        />
        {/* Job Desc. analysis */}
        <Route
         path="/jd-analyzer"
         element={
        <ProtectedRoute>
         <JDAnalyzer />
        </ProtectedRoute>
          }
/>

      </Routes>

      {/* Session Expired Popup */}
      <SessionExpiredModal />

    </BrowserRouter>
  )
}

export default App
