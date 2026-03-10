import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';

function StatCard({ icon, label, value, to, color }) {
  return (
    <Link to={to} className="card p-5 flex items-center gap-4 group cursor-pointer">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-heading font-bold text-stone-800">{value}</p>
        <p className="text-stone-500 text-sm font-body">{label}</p>
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ menus: 0, categories: 0, dishes: 0, users: 0 });
  const [recentMenus, setRecentMenus] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [menus, cats, dishes] = await Promise.all([
          api.get('/menus'),
          api.get('/categories'),
          api.get('/dishes'),
        ]);
        setStats((s) => ({
          ...s,
          menus: menus.data.length,
          categories: cats.data.length,
          dishes: dishes.data.length,
        }));
        setRecentMenus(menus.data.slice(0, 5));
        if (user?.role === 'admin') {
          const users = await api.get('/users');
          setStats((s) => ({ ...s, users: users.data.length }));
        }
      } catch {}
    };
    load();
  }, [user]);

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-heading text-stone-800">
            Bienvenido, <span className="text-amber-700">{user?.username}</span>
          </h1>
          <p className="text-stone-500 text-sm mt-1 font-body">Panel de control</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon="📋" label="Cartas" value={stats.menus} to="/menus" color="bg-amber-50" />
        <StatCard icon="🗂️" label="Categorías" value={stats.categories} to="/categories" color="bg-stone-100" />
        <StatCard icon="🍽️" label="Platos" value={stats.dishes} to="/dishes" color="bg-orange-50" />
        {user?.role === 'admin' && (
          <StatCard icon="👥" label="Usuarios" value={stats.users} to="/users" color="bg-blue-50" />
        )}
      </div>

      {/* Recent menus */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-xl text-stone-700">Cartas recientes</h2>
          <Link to="/menus" className="text-amber-700 hover:text-amber-800 text-sm font-body font-medium">
            Ver todas →
          </Link>
        </div>

        {recentMenus.length === 0 ? (
          <div className="card p-10 text-center text-stone-400">
            <div className="text-4xl mb-3">📋</div>
            <p className="font-body">Todavía no hay cartas creadas.</p>
            <Link to="/menus" className="btn-primary mt-4 inline-flex">
              Crear primera carta
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {recentMenus.map((menu) => (
              <div key={menu._id} className="card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-lg flex-shrink-0">
                    📋
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium text-stone-800 truncate">{menu.name}</p>
                    <p className="text-xs text-stone-400 font-body">
                      {menu.categories?.length || 0} categorías ·{' '}
                      {new Date(menu.createdAt).toLocaleDateString('es-UY')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link to={`/menus/${menu._id}/edit`} className="btn-ghost text-xs px-3 py-1.5">
                    Editar
                  </Link>
                  <Link
                    to={`/menus/${menu._id}/print`}
                    target="_blank"
                    className="btn-secondary text-xs px-3 py-1.5"
                  >
                    🖨️ Imprimir
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
