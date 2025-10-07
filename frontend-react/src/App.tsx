import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import CustomerService from '@/pages/CustomerService'
import AdminDashboard from '@/pages/AdminDashboard'
import MobileAdmin from '@/pages/MobileAdmin'

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<CustomerService />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/mobile/admin" element={<MobileAdmin />} />
        </Routes>
      </div>
    </Router>
  )
}

export default App