import { Navigate, Route, Routes } from 'react-router-dom'
import { ProtectedRoute } from './components/ProtectedRoute'
import { CashPage } from './pages/CashPage'
import { LoginPage } from './pages/LoginPage'
import { ReportsPage } from './pages/ReportsPage'

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
        path="/reports"
        element={
          <ProtectedRoute>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/cash" replace />} />
    </Routes>
  )
}

export default App
