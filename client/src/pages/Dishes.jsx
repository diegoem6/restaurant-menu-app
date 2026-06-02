import { useState, useEffect } from 'react';
import api from '../api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const EMPTY_PRICE = { label: '', priceUYU: '', priceUSD: '', autoUSD: true };

function DishForm({ initial, onSave, onCancel, exchangeRate }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    menuName: initial?.menuName || '',
    description: initial?.description || '',
  });
  const [prices, setPrices] = useState(
    initial?.prices?.length
      ? initial.prices.map((p) => ({
          label: p.label || '',
          priceUYU: String(p.priceUYU),
          priceUSD: p.priceUSD != null ? String(p.priceUSD) : '',
          autoUSD: false,
        }))
      : [{ ...EMPTY_PRICE }]
  );
  const [loading, setLoading] = useState(false);

  const updatePrice = (idx, field, value) => {
    setPrices((prev) => {
      const updated = [...prev];
      updated[idx] = { ...updated[idx], [field]: value };
      // Recalculate USD when priceUYU changes or autoUSD is toggled on
      if (
        (field === 'priceUYU' && updated[idx].autoUSD) ||
        (field === 'autoUSD' && value)
      ) {
        const uyu = field === 'priceUYU' ? parseFloat(value) : parseFloat(updated[idx].priceUYU);
        const usd = exchangeRate ? (uyu / exchangeRate).toFixed(2) : '';
        updated[idx].priceUSD = isNaN(usd) ? '' : usd;
      }
      return updated;
    });
  };

  const addPrice = () => setPrices((prev) => [...prev, { ...EMPTY_PRICE }]);
  const removePrice = (idx) => setPrices((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        ...form,
        prices: prices.map(({ label, priceUYU, priceUSD }) => ({
          label,
          priceUYU: parseFloat(priceUYU),
          priceUSD: priceUSD !== '' ? parseFloat(priceUSD) : null,
        })),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nombre interno *</label>
        <input className="input" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>
      <div>
        <label className="label">
          Nombre en carta
          <span className="ml-1 text-stone-400 font-normal text-xs">(si está vacío se usa el nombre interno)</span>
        </label>
        <input className="input" value={form.menuName}
          onChange={(e) => setForm({ ...form, menuName: e.target.value })}
          placeholder={form.name} />
      </div>
      <div>
        <label className="label">Descripción</label>
        <textarea className="input resize-none" rows={2} value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>

      {/* Prices */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Precios *</label>
          <button type="button" onClick={addPrice} className="btn-ghost text-xs py-0.5">
            + Agregar precio
          </button>
        </div>
        <div className="space-y-3">
          {prices.map((p, idx) => (
            <div key={idx} className="border border-stone-200 rounded-lg p-3 space-y-2 bg-stone-50">
              <div className="flex items-center gap-2">
                <input
                  className="input flex-1 text-sm"
                  placeholder="Etiqueta (ej. Chico, Grande, Porción...)"
                  value={p.label}
                  onChange={(e) => updatePrice(idx, 'label', e.target.value)}
                />
                {prices.length > 1 && (
                  <button type="button" onClick={() => removePrice(idx)}
                    className="btn-ghost p-1 text-stone-400 hover:text-red-500 text-sm flex-shrink-0">
                    ✕
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-stone-500 mb-1 block">Precio UYU *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">$</span>
                    <input type="number" min="0" step="0.01" className="input pl-6 text-sm"
                      value={p.priceUYU}
                      onChange={(e) => updatePrice(idx, 'priceUYU', e.target.value)}
                      required />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-stone-500 mb-1 flex items-center gap-1">
                    Precio USD
                    <button type="button"
                      className="text-amber-600 hover:text-amber-700 text-xs"
                      onClick={() => updatePrice(idx, 'autoUSD', !p.autoUSD)}>
                      {p.autoUSD ? '(auto ✓)' : '(manual)'}
                    </button>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-xs">U$S</span>
                    <input type="number" min="0" step="0.01" className="input pl-9 text-sm"
                      value={p.priceUSD}
                      readOnly={p.autoUSD}
                      onChange={(e) => !p.autoUSD && updatePrice(idx, 'priceUSD', e.target.value)} />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {prices.some((p) => p.autoUSD) && (
          <p className="text-xs text-stone-400 mt-1">TC: {exchangeRate} UYU/USD</p>
        )}
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
          {filtered.map((dish) => {
            const prices = dish.prices || [];
            return (
              <div key={dish._id} className="card p-4 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-stone-800">{dish.name}</p>
                  {dish.menuName && dish.menuName !== dish.name && (
                    <p className="text-xs text-amber-700 font-body mt-0.5">Carta: {dish.menuName}</p>
                  )}
                  {dish.description && (
                    <p className="text-sm text-stone-500 truncate font-body mt-0.5">{dish.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <div className="text-right space-y-0.5">
                    {prices.map((p, i) => (
                      <div key={i} className="flex items-baseline gap-1.5 justify-end">
                        {p.label && (
                          <span className="text-xs text-stone-400">{p.label}:</span>
                        )}
                        <span className="font-medium text-stone-800 text-sm">
                          ${p.priceUYU.toLocaleString('es-UY')}
                        </span>
                        {p.priceUSD != null && (
                          <span className="text-xs text-stone-400">/ U$S {p.priceUSD.toFixed(2)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setModal(dish)} className="btn-ghost p-2 text-base" title="Editar">✏️</button>
                    <button onClick={() => setDeleteTarget(dish)} className="btn-ghost p-2 text-base hover:text-red-500" title="Eliminar">🗑️</button>
                  </div>
                </div>
              </div>
            );
          })}
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
