import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import MoneyFlow from './pages/MoneyFlow';
import Customers from './pages/Customers';
import Dealers from './pages/Dealers';
import Expenses from './pages/Expenses';
import StaffPage from './pages/Staff';
import Loans from './pages/Loans';
import Receipts from './pages/Receipts';
import Reminders from './pages/Reminders';
import Reports from './pages/Reports';
import AuditLogs from './pages/AuditLogs';
import Settings from './pages/Settings';

const ProtectedRoute: React.FC<{ children: React.ReactNode; roles?: string[] }> = ({
  children,
  roles,
}) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-slate-900 text-white text-sm">
        Authenticating session...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <Routes>
            <Route path="/login" element={<Login />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Dashboard />} />
              <Route path="money-flow" element={<MoneyFlow />} />
              <Route path="customers" element={<Customers />} />
              <Route path="dealers" element={<Dealers />} />
              <Route path="expenses" element={<Expenses />} />
              <Route
                path="staff"
                element={
                  <ProtectedRoute roles={['OWNER', 'MANAGER']}>
                    <StaffPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="loans"
                element={
                  <ProtectedRoute roles={['OWNER', 'MANAGER']}>
                    <Loans />
                  </ProtectedRoute>
                }
              />
              <Route path="receipts" element={<Receipts />} />
              <Route path="reminders" element={<Reminders />} />
              <Route
                path="reports"
                element={
                  <ProtectedRoute roles={['OWNER', 'MANAGER']}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
              <Route
                path="audit-logs"
                element={
                  <ProtectedRoute roles={['OWNER']}>
                    <AuditLogs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="settings"
                element={
                  <ProtectedRoute roles={['OWNER']}>
                    <Settings />
                  </ProtectedRoute>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
