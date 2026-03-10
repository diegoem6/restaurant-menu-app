import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const NavItem = ({ to, icon, label, onClick }) => {
  const base = 'flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-150';
  const active = 'bg-amber-700 text-white shadow-sm';
  const inactive = 'text-stone-400 hover:text-white hover:bg-white/10';

  if (onClick) {
    return (
      <button onClick={onClick} className={`${base} ${inactive} w-full`}>
        <span className="text-lg">{icon}</span>
        <span>{label}</span>
      </button>
    );
  }

  return (
    <NavLink to={to} className={({ isActive }) => `${base} ${isActive ? active : inactive}`}>
      <span className="text-lg">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
};

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLinks = [
    { to: '/', icon: '📊', label: 'Dashboard' },
    { to: '/menus', icon: '📋', label: 'Cartas' },
    { to: '/categories', icon: '🗂️', label: 'Categorías' },
    { to: '/dishes', icon: '🍽️', label: 'Platos' },
    ...(user?.role === 'admin' ? [{ to: '/users', icon: '👥', label: 'Usuarios' }] : []),
  ];

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 py-6 border-b border-white/10">
        <h1 className="font-heading text-2xl text-white tracking-wide">Carta Digital</h1>
        <p className="text-stone-400 text-xs mt-0.5 font-body">Gestión de menús</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map((link) => (
          <NavItem key={link.to} {...link} onClick={undefined} />
        ))}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10">
        <div className="px-4 py-2 mb-2">
          <p className="text-white text-sm font-medium">{user?.username}</p>
          <span className={`badge text-xs mt-0.5 ${
            user?.role === 'admin'
              ? 'bg-amber-600/30 text-amber-300'
              : 'bg-stone-600/30 text-stone-400'
          }`}>
            {user?.role === 'admin' ? 'Administrador' : 'Propietario'}
          </span>
        </div>
        <NavItem icon="🚪" label="Cerrar sesión" onClick={handleLogout} />
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-stone-50">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-stone-900 flex-col flex-shrink-0">
        <SidebarContent />
      </aside>

      {/* Mobile Sidebar Overlay */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 bg-stone-900 flex flex-col z-10">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 text-stone-400 hover:text-white text-xl"
            >✕</button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-stone-900 border-b border-stone-800">
          <button onClick={() => setMobileOpen(true)} className="text-white text-xl p-1">☰</button>
          <h1 className="font-heading text-lg text-white">Carta Digital</h1>
          <div className="w-8" />
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
