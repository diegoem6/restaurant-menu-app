import { useState, useEffect } from 'react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import api from '../api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import SortableItem from '../components/SortableItem';

function CategoryForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({ name: initial?.name || '', description: initial?.description || '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try { await onSave(form); }
    finally { setLoading(false); }
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
      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando...' : 'Guardar categoría'}
        </button>
      </div>
    </form>
  );
}

function ManageDishesModal({ category, allDishes, onClose, onSave }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // Build current ordered dishes list
  const sorted = [...(category.dishes || [])].sort((a, b) => a.order - b.order);
  const [selected, setSelected] = useState(sorted.map((d) => d.dish._id || d.dish));
  const [saving, setSaving] = useState(false);

  const toggleDish = (dishId) => {
    setSelected((prev) =>
      prev.includes(dishId) ? prev.filter((id) => id !== dishId) : [...prev, dishId]
    );
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelected((items) => {
        const oldIdx = items.indexOf(active.id);
        const newIdx = items.indexOf(over.id);
        return arrayMove(items, oldIdx, newIdx);
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const dishes = selected.map((id, idx) => ({ dish: id, order: idx }));
      await onSave(dishes);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const inCategory = selected.length > 0;

  return (
    <div className="space-y-4">
      <p className="text-sm text-stone-500 font-body">
        Seleccioná los platos que pertenecen a esta categoría y arrastrá para cambiar el orden.
      </p>

      {/* All dishes - toggle */}
      <div>
        <p className="label mb-2">Todos los platos disponibles</p>
        <div className="space-y-1 max-h-40 overflow-y-auto border border-stone-200 rounded-lg p-2">
          {allDishes.length === 0 && (
            <p className="text-center text-stone-400 text-sm py-2">No hay platos creados</p>
          )}
          {allDishes.map((dish) => (
            <label key={dish._id}
              className="flex items-center gap-3 px-2 py-1.5 rounded hover:bg-stone-50 cursor-pointer">
              <input
                type="checkbox"
                checked={selected.includes(dish._id)}
                onChange={() => toggleDish(dish._id)}
                className="accent-amber-600"
              />
              <span className="text-sm text-stone-700">{dish.name}</span>
              <span className="ml-auto text-xs text-stone-400">${dish.priceUYU}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Ordered list */}
      {inCategory && (
        <div>
          <p className="label mb-2">Orden en la categoría (arrastrá para reordenar)</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={selected} strategy={verticalListSortingStrategy}>
              <div className="space-y-1 border border-stone-200 rounded-lg p-2">
                {selected.map((id) => {
                  const dish = allDishes.find((d) => d._id === id);
                  if (!dish) return null;
                  return (
                    <SortableItem key={id} id={id}>
                      <div className="flex items-center gap-2 px-2 py-1.5 bg-amber-50 rounded text-sm">
                        <span className="text-stone-700 font-medium">{dish.name}</span>
                        <span className="ml-auto text-stone-400 text-xs">${dish.priceUYU}</span>
                      </div>
                    </SortableItem>
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      <div className="flex gap-3 justify-end pt-2">
        <button onClick={onClose} className="btn-secondary">Cancelar</button>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Guardando...' : 'Guardar orden'}
        </button>
      </div>
    </div>
  );
}

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [allDishes, setAllDishes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [manageDishes, setManageDishes] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [cats, dishes] = await Promise.all([api.get('/categories'), api.get('/dishes')]);
      setCategories(cats.data);
      setAllDishes(dishes.data);
    } catch {
      toast.error('Error al cargar');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await api.post('/categories', data);
      setCategories([res.data, ...categories]);
      setModal(null);
      toast.success('Categoría creada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleEdit = async (data) => {
    try {
      const res = await api.put(`/categories/${modal._id}`, data);
      setCategories(categories.map((c) => (c._id === modal._id ? res.data : c)));
      setModal(null);
      toast.success('Categoría actualizada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleSaveDishes = async (dishes) => {
    try {
      const res = await api.put(`/categories/${manageDishes._id}/dishes`, { dishes });
      setCategories(categories.map((c) => (c._id === manageDishes._id ? res.data : c)));
      toast.success('Platos actualizados');
    } catch {
      toast.error('Error al guardar');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/categories/${deleteTarget._id}`);
      setCategories(categories.filter((c) => c._id !== deleteTarget._id));
      toast.success('Categoría eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-heading text-stone-800">Categorías</h1>
          <p className="text-stone-500 text-sm mt-1 font-body">{categories.length} categorías</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('create')}>
          + Nueva categoría
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-400">Cargando...</div>
      ) : categories.length === 0 ? (
        <div className="card p-10 text-center text-stone-400">
          <div className="text-4xl mb-3">🗂️</div>
          <p className="font-body">No hay categorías. ¡Creá la primera!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const sortedDishes = [...(cat.dishes || [])].sort((a, b) => a.order - b.order);
            return (
              <div key={cat._id} className="card p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-medium text-stone-800">{cat.name}</p>
                    {cat.description && (
                      <p className="text-sm text-stone-500 font-body mt-0.5">{cat.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => setManageDishes(cat)}
                      className="btn-ghost text-xs"
                      title="Gestionar platos"
                    >
                      🍽️ Platos ({sortedDishes.length})
                    </button>
                    <button onClick={() => setModal(cat)} className="btn-ghost p-2">✏️</button>
                    <button onClick={() => setDeleteTarget(cat)} className="btn-ghost p-2 hover:text-red-500">🗑️</button>
                  </div>
                </div>
                {sortedDishes.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {sortedDishes.map(({ dish }, i) => {
                      const d = typeof dish === 'object' ? dish : allDishes.find((x) => x._id === dish);
                      if (!d) return null;
                      return (
                        <span key={d._id}
                          className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-600 rounded-full text-xs font-body">
                          <span className="text-stone-400">{i + 1}.</span>
                          {d.name}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Nueva categoría' : 'Editar categoría'}
      >
        {modal && (
          <CategoryForm
            initial={modal === 'create' ? null : modal}
            onSave={modal === 'create' ? handleCreate : handleEdit}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      {/* Manage Dishes Modal */}
      <Modal
        isOpen={!!manageDishes}
        onClose={() => setManageDishes(null)}
        title={`Platos de "${manageDishes?.name}"`}
        size="lg"
      >
        {manageDishes && (
          <ManageDishesModal
            category={manageDishes}
            allDishes={allDishes}
            onClose={() => setManageDishes(null)}
            onSave={handleSaveDishes}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar categoría"
        message={`¿Eliminar "${deleteTarget?.name}"? Los platos no serán eliminados.`}
      />
    </div>
  );
}
