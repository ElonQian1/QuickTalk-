import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from 'styled-components';
import { GlobalStyles, theme } from './styles/globalStyles';
import Layout from './components/Layout/Layout';
import LoginPage from './pages/LoginPage';
import ShopListPage from './pages/ShopListPage';
import CustomerListPage from './pages/CustomerListPage';
import ChatPage from './pages/ChatPage';
import { MessagesPage } from './pages/Messages';
import { ProfilePage } from './pages/Profile';
import { HomePage } from './pages/Home';
import { StatisticsPage } from './pages/Statistics';
import { useAuthStore } from './stores/authStore';

function App() {
  const { isAuthenticated, hydrated } = useAuthStore();

  if (!hydrated) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        <div style={{padding: 24}}>加载中…</div>
      </ThemeProvider>
    );
  }

  if (!isAuthenticated) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        <LoginPage />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route path="/home" element={<HomePage />} />
          <Route path="/shops" element={<ShopListPage />} />
          <Route path="/messages" element={<MessagesPage />} />
          <Route path="/statistics" element={<StatisticsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/shops/:shopId/customers" element={<CustomerListPage />} />
          <Route path="/chat/:sessionId" element={<ChatPage />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      </Layout>
    </ThemeProvider>
  );
}

export default App;