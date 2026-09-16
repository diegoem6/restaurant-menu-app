import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Dishes from './pages/Dishes';
import ImportDishes from './pages/ImportDishes';
import Categories from './pages/Categories';
import Menus from './pages/Menus';
import MenuEditor from './pages/MenuEditor';
import PrintMenu from './pages/PrintMenu';
import Users from './pages/Users';

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-stone-50">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">🍽️</div>
        <p className="text-stone-400 font-body text-sm">Cargando...</p>
      </div>
    </div>
  );
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/menus/:id/print" element={
        <ProtectedRoute><PrintMenu /></ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute><Layout /></ProtectedRoute>
      }>
        <Route index element={<Dashboard />} />
        <Route path="dishes" element={<Dishes />} />
        <Route path="import" element={<ImportDishes />} />
        <Route path="categories" element={<Categories />} />
        <Route path="menus" element={<Menus />} />
        <Route path="menus/:id/edit" element={<MenuEditor />} />
        <Route path="users" element={
          <ProtectedRoute adminOnly><Users /></ProtectedRoute>
        } />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
        <Toaster
          position="top-right"
          toastOptions={{
            style: { fontFamily: 'DM Sans, sans-serif', fontSize: '14px' },
            success: { iconTheme: { primary: '#92400e', secondary: '#fff' } },
          }}
        />
      </BrowserRouter>
    </AuthProvider>
  );
}
