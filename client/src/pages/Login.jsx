import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function Login() {
  const [form, setForm] = useState({ username: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.username, form.password);
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Credenciales inválidas');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-stone-900">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 bg-stone-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `repeating-linear-gradient(45deg, #d97706 0, #d97706 1px, transparent 0, transparent 50%)`,
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative">
          <h1 className="font-heading text-5xl text-white leading-tight">
            Carta<br />
            <span className="text-amber-500">Digital</span>
          </h1>
          <p className="text-stone-400 mt-4 font-body text-lg leading-relaxed">
            Gestión profesional de menús para restaurantes. Creá, editá e imprimí tus cartas con facilidad.
          </p>
        </div>
        <div className="relative flex gap-4 text-stone-600 text-sm font-body">
          <span>🍽️ Platos</span>
          <span>🗂️ Categorías</span>
          <span>📋 Cartas</span>
          <span>🖨️ Impresión</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="mb-10 text-center lg:text-left">
            <div className="text-4xl mb-3 lg:hidden">🍽️</div>
            <h2 className="font-heading text-3xl text-white">Iniciar sesión</h2>
            <p className="text-stone-400 text-sm mt-1 font-body">Ingresá con tus credenciales</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">
                Usuario
              </label>
              <input
                type="text"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-4 py-3 text-white text-sm font-body focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all placeholder-stone-600"
                placeholder="usuario"
                required
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-400 uppercase tracking-wider mb-1.5">
                Contraseña
              </label>
              <input
                type="password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-4 py-3 text-white text-sm font-body focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all placeholder-stone-600"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white py-3 rounded-lg font-body font-medium transition-all duration-200 mt-2"
            >
              {loading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
