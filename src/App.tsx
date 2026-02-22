import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { CashPage } from './pages/CashPage'
import { CredentialsPage } from './pages/CredentialsPage'
import { LoginPage } from './pages/LoginPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/cash" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/cash"
        element={
          <ProtectedRoute>
            <CashPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/credentials"
        element={
          <ProtectedRoute>
            <CredentialsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/cash" replace />} />
    </Routes>
  )
}

export default App
