import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import CustomerService from '@/pages/CustomerService'
import AdminDashboard from '@/pages/AdminDashboard'
import MobileAdmin from '@/pages/MobileAdmin'
import LoginPage from '@/pages/LoginPage'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<CustomerService />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/login" element={<LoginPage />} />
          <Route path="/mobile/admin" element={<MobileAdmin />} />
          <Route path="/mobile/dashboard" element={<MobileAdmin />} />
          <Route path="/mobile/login" element={<LoginPage />} />
          {/* 404页面重定向到主页 */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App