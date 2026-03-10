import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY_FORM = { name: '', description: '', priceUYU: '', priceUSD: '' };

function DishForm({ initial, onSave, onCancel, exchangeRate }) {
  const [form, setForm] = useState(initial || EMPTY_FORM);
  const [autoUSD, setAutoUSD] = useState(!initial?.priceUSD);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (autoUSD && form.priceUYU) {
      const usd = (parseFloat(form.priceUYU) / exchangeRate).toFixed(2);
      setForm((f) => ({ ...f, priceUSD: usd }));
    }
  }, [form.priceUYU, autoUSD, exchangeRate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        name: form.name,
        description: form.description,
        priceUYU: parseFloat(form.priceUYU),
        priceUSD: form.priceUSD ? parseFloat(form.priceUSD) : null,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nombre *</label>
        <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div>
        <label className="label">Descripción</label>
        <textarea className="input resize-none" rows={2} value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label">Precio UYU *</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">$</span>
            <input
              type="number" min="0" step="0.01" className="input pl-7"
              value={form.priceUYU}
              onChange={(e) => setForm({ ...form, priceUYU: e.target.value })}
              required
            />
          </div>
        </div>
        <div>
          <label className="label">
            Precio USD
            <button type="button"
              className="ml-2 text-amber-600 hover:text-amber-700 text-xs normal-case"
              onClick={() => setAutoUSD(!autoUSD)}
            >
              {autoUSD ? '(auto ✓)' : '(manual)'}
            </button>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">U$S</span>
            <input
              type="number" min="0" step="0.01" className="input pl-10"
              value={form.priceUSD}
              readOnly={autoUSD}
              onChange={(e) => !autoUSD && setForm({ ...form, priceUSD: e.target.value })}
            />
          </div>
          {autoUSD && (
            <p className="text-xs text-stone-400 mt-1">TC: {exchangeRate} UYU/USD</p>
          )}
        </div>
      </div>
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando...' : 'Guardar plato'}
        </button>
      </div>
    </form>
  );
}

export default function Dishes() {
  const [dishes, setDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // null | 'create' | dish object
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [search, setSearch] = useState('');
  const [exchangeRate, setExchangeRate] = useState(40);

  useEffect(() => {
    api.get('/settings/exchangeRate').then((r) => setExchangeRate(r.data.value)).catch(() => {});
    loadDishes();
  }, []);

  const loadDishes = async () => {
    try {
      const res = await api.get('/dishes');
      setDishes(res.data);
    } catch {
      toast.error('Error al cargar platos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await api.post('/dishes', data);
      setDishes([res.data, ...dishes]);
      setModal(null);
      toast.success('Plato creado');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al crear');
    }
  };

  const handleEdit = async (data) => {
    try {
      const res = await api.put(`/dishes/${modal._id}`, data);
      setDishes(dishes.map((d) => (d._id === modal._id ? res.data : d)));
      setModal(null);
      toast.success('Plato actualizado');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al editar');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/dishes/${deleteTarget._id}`);
      setDishes(dishes.filter((d) => d._id !== deleteTarget._id));
      toast.success('Plato eliminado');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  const filtered = dishes.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-heading text-stone-800">Platos</h1>
          <p className="text-stone-500 text-sm mt-1 font-body">{dishes.length} platos en total</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('create')}>
          + Nuevo plato
        </button>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          className="input max-w-xs"
          placeholder="🔍 Buscar platos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-stone-400">Cargando...</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-stone-400">
          <div className="text-4xl mb-3">🍽️</div>
          <p className="font-body">{search ? 'Sin resultados' : 'No hay platos. ¡Creá el primero!'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((dish) => (
            <div key={dish._id} className="card p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-stone-800">{dish.name}</p>
                {dish.description && (
                  <p className="text-sm text-stone-500 truncate font-body mt-0.5">{dish.description}</p>
                )}
              </div>
              <div className="flex items-center gap-4 flex-shrink-0">
                <div className="text-right">
                  <p className="font-medium text-stone-800 text-sm">
                    ${dish.priceUYU.toLocaleString('es-UY')}
                  </p>
                  {dish.priceUSD != null && (
                    <p className="text-xs text-stone-400">U$S {dish.priceUSD.toFixed(2)}</p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setModal(dish)}
                    className="btn-ghost p-2 text-base"
                    title="Editar"
                  >✏️</button>
                  <button
                    onClick={() => setDeleteTarget(dish)}
                    className="btn-ghost p-2 text-base hover:text-red-500"
                    title="Eliminar"
                  >🗑️</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Modal */}
      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Nuevo plato' : 'Editar plato'}
      >
        {modal && (
          <DishForm
            initial={modal === 'create' ? null : modal}
            onSave={modal === 'create' ? handleCreate : handleEdit}
            onCancel={() => setModal(null)}
            exchangeRate={exchangeRate}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar plato"
        message={`¿Estás seguro de eliminar "${deleteTarget?.name}"? Esta acción no se puede deshacer.`}
      />
    </div>
  );
}
