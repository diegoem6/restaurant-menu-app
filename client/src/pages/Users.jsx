import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

function UserForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ username: initial?.username || '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!initial && !form.password) {
      toast.error('La contraseña es requerida');
      return;
    }
    setLoading(true);
    try { await onSave(form); }
    finally { setLoading(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Usuario *</label>
        <input className="input" value={form.username}
          onChange={(e) => setForm({ ...form, username: e.target.value })} required />
      </div>
      <div>
        <label className="label">{initial ? 'Nueva contraseña (dejar vacío para no cambiar)' : 'Contraseña *'}</label>
        <input type="password" className="input" value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          required={!initial}
          placeholder={initial ? '••••••••' : ''}
        />
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando...' : initial ? 'Actualizar usuario' : 'Crear usuario'}
        </button>
      </div>
    </form>
  );
}

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [exchangeRate, setExchangeRate] = useState('');
  const [rateInput, setRateInput] = useState('');
  const [savingRate, setSavingRate] = useState(false);

  useEffect(() => {
    loadUsers();
    api.get('/settings/exchangeRate').then((r) => {
      setExchangeRate(r.data.value);
      setRateInput(String(r.data.value));
    }).catch(() => {});
  }, []);

  const loadUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await api.post('/users', data);
      setUsers([res.data, ...users]);
      setModal(null);
      toast.success('Usuario creado');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleEdit = async (data) => {
    try {
      const payload = { username: data.username };
      if (data.password) payload.password = data.password;
      const res = await api.put(`/users/${modal._id}`, payload);
      setUsers(users.map((u) => (u._id === modal._id ? res.data : u)));
      setModal(null);
      toast.success('Usuario actualizado');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/users/${deleteTarget._id}`);
      setUsers(users.filter((u) => u._id !== deleteTarget._id));
      toast.success('Usuario eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const saveExchangeRate = async () => {
    setSavingRate(true);
    try {
      const res = await api.put('/settings/exchangeRate', { value: rateInput });
      setExchangeRate(res.data.value);
      toast.success('Tipo de cambio actualizado');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSavingRate(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-heading text-stone-800">Usuarios</h1>
          <p className="text-stone-500 text-sm mt-1 font-body">{users.length} propietarios registrados</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('create')}>
          + Nuevo usuario
        </button>
      </div>

      {/* Exchange rate setting */}
      <div className="card p-4 mb-6 flex flex-wrap items-center gap-4">
        <div>
          <p className="font-medium text-stone-700 text-sm">Tipo de cambio USD</p>
          <p className="text-xs text-stone-400 font-body">
            Actual: {exchangeRate} UYU por dólar. Se usa para calcular precios en USD automáticamente.
          </p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">UYU/USD</span>
            <input
              type="number" min="1" step="0.01"
              className="input pl-24 w-40"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
            />
          </div>
          <button onClick={saveExchangeRate} disabled={savingRate} className="btn-primary">
            {savingRate ? '...' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Users list */}
      {loading ? (
        <div className="text-center py-12 text-stone-400">Cargando...</div>
      ) : users.length === 0 ? (
        <div className="card p-10 text-center text-stone-400">
          <div className="text-4xl mb-3">👥</div>
          <p className="font-body">No hay propietarios registrados.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div key={user._id} className="card p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-lg flex-shrink-0">
                  👤
                </div>
                <div>
                  <p className="font-medium text-stone-800">{user.username}</p>
                  <p className="text-xs text-stone-400 font-body">
                    Creado: {new Date(user.createdAt).toLocaleDateString('es-UY')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => setModal(user)} className="btn-ghost p-2">✏️</button>
                <button onClick={() => setDeleteTarget(user)}
                  className="btn-ghost p-2 hover:text-red-500">🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Nuevo propietario' : 'Editar usuario'}
      >
        {modal && (
          <UserForm
            initial={modal === 'create' ? null : modal}
            onSave={modal === 'create' ? handleCreate : handleEdit}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar usuario"
        message={`¿Eliminar el usuario "${deleteTarget?.username}"? Sus cartas, categorías y platos no serán eliminados.`}
      />
    </div>
  );
}
