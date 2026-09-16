import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  DndContext, closestCenter, PointerSensor, TouchSensor, KeyboardSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import api from '../api';
import toast from 'react-hot-toast';
import SortableItem from '../components/SortableItem';

const PRESETS = {
  white: '#ffffff', cream: '#fef9f0', dark: '#1c1917',
  forest: '#1a2e1a', wine: '#3b0a0a', slate: '#1e293b',
};

// A category's dishes can live directly on it or inside its subcategories
const totalDishCount = (cat) =>
  (cat.dishes?.length || 0) +
  (cat.subcategories || []).reduce((sum, s) => sum + (s.dishes?.length || 0), 0);

export default function MenuEditor() {
  const { id } = useParams();
  const [menu, setMenu] = useState(null);
  const [allCategories, setAllCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // selectedIds = ordered array of category IDs currently in the menu
  const [selectedIds, setSelectedIds] = useState([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    const load = async () => {
      try {
        const [menuRes, catRes] = await Promise.all([
          api.get(`/menus/${id}`),
          api.get('/categories'),
        ]);
        setMenu(menuRes.data);
        setAllCategories(catRes.data);
        const sorted = [...(menuRes.data.categories || [])]
          .sort((a, b) => a.order - b.order)
          .map((c) => c.category?._id || c.category);
        setSelectedIds(sorted);
      } catch {
        toast.error('Error al cargar la carta');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const toggleCategory = (catId) => {
    setSelectedIds((prev) =>
      prev.includes(catId) ? prev.filter((x) => x !== catId) : [...prev, catId]
    );
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSelectedIds((items) => {
        const oldIdx = items.indexOf(active.id);
        const newIdx = items.indexOf(over.id);
        return arrayMove(items, oldIdx, newIdx);
      });
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const categories = selectedIds.map((catId, idx) => ({ category: catId, order: idx }));
      const res = await api.put(`/menus/${id}/categories`, { categories });
      setMenu(res.data);
      toast.success('Categorías guardadas');
    } catch {
      toast.error('Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="text-center py-12 text-stone-400">Cargando...</div>
  );

  if (!menu) return (
    <div className="text-center py-12 text-stone-400">Carta no encontrada</div>
  );

  const bgColor = menu.backgroundTemplate?.type === 'custom' && menu.backgroundTemplate.customImage
    ? null
    : PRESETS[menu.backgroundTemplate?.preset || 'cream'];

  return (
    <div>
      {/* Header */}
      <div className="page-header flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/menus" className="text-stone-400 hover:text-stone-600 transition-colors">←</Link>
          <div>
            <h1 className="text-3xl font-heading text-stone-800 truncate">{menu.name}</h1>
            <p className="text-stone-500 text-sm font-body">Editor de categorías</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/menus/${id}/print`}
            target="_blank"
            className="btn-secondary"
          >
            🖨️ Vista previa
          </Link>
          <button onClick={handleSave} disabled={saving} className="btn-primary">
            {saving ? 'Guardando...' : '💾 Guardar'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: available categories */}
        <div>
          <h2 className="font-heading text-xl text-stone-700 mb-3">Categorías disponibles</h2>
          <p className="text-sm text-stone-500 font-body mb-3">
            Seleccioná las categorías que forman parte de esta carta.
          </p>
          {allCategories.length === 0 ? (
            <div className="card p-6 text-center text-stone-400">
              <p className="font-body text-sm">No hay categorías creadas.</p>
              <Link to="/categories" className="text-amber-700 hover:underline text-sm mt-1 inline-block">
                Crear categorías →
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {allCategories.map((cat) => {
                const isIn = selectedIds.includes(cat._id);
                const dishCount = totalDishCount(cat);
                return (
                  <label key={cat._id}
                    className={`card p-3 flex items-center gap-3 cursor-pointer transition-all ${
                      isIn ? 'border-amber-300 bg-amber-50' : ''
                    }`}>
                    <input
                      type="checkbox"
                      checked={isIn}
                      onChange={() => toggleCategory(cat._id)}
                      className="accent-amber-600 w-4 h-4"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-stone-800 text-sm">{cat.name}</p>
                      {cat.description && (
                        <p className="text-xs text-stone-400 truncate">{cat.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-stone-400 flex-shrink-0">
                      {dishCount} plato{dishCount !== 1 ? 's' : ''}
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: ordered list */}
        <div>
          <h2 className="font-heading text-xl text-stone-700 mb-3">
            Orden en la carta
            <span className="text-base font-body font-normal text-stone-400 ml-2">
              ({selectedIds.length} categorías)
            </span>
          </h2>
          <p className="text-sm text-stone-500 font-body mb-3">
            Arrastrá para cambiar el orden. Cada categoría empezará en una nueva página al imprimir.
          </p>

          {selectedIds.length === 0 ? (
            <div className="card p-6 text-center text-stone-400 border-dashed">
              <p className="font-body text-sm">Seleccioná categorías de la lista de la izquierda.</p>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={selectedIds} strategy={verticalListSortingStrategy}>
                <div className="space-y-2">
                  {selectedIds.map((catId, idx) => {
                    const cat = allCategories.find((c) => c._id === catId);
                    if (!cat) return null;
                    const sortedDishes = [...(cat.dishes || [])].sort((a, b) => a.order - b.order);
                    return (
                      <SortableItem key={catId} id={catId}>
                        <div className="card p-3 border-l-4 border-amber-400">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-amber-600 font-heading font-bold text-sm w-5 flex-shrink-0">
                                {idx + 1}
                              </span>
                              <p className="font-medium text-stone-800 text-sm truncate">{cat.name}</p>
                            </div>
                            <button
                              onClick={() => toggleCategory(catId)}
                              className="text-stone-300 hover:text-red-400 transition-colors text-sm ml-2 flex-shrink-0"
                              title="Quitar"
                            >✕</button>
                          </div>
                          {sortedDishes.length > 0 && (
                            <p className="text-xs text-stone-400 mt-1 ml-7 font-body">
                              {sortedDishes
                                .map(({ dish }) => (typeof dish === 'object' ? dish?.name : dish))
                                .filter(Boolean)
                                .join(', ')}
                            </p>
                          )}
                          {(() => {
                            const subsWithDishes = (cat.subcategories || []).filter((s) => s.dishes?.length);
                            if (!subsWithDishes.length) return null;
                            const subDishCount = subsWithDishes.reduce((n, s) => n + s.dishes.length, 0);
                            return (
                              <p className="text-xs text-stone-400 mt-1 ml-7 font-body italic">
                                {subDishCount} plato{subDishCount !== 1 ? 's' : ''} en {subsWithDishes.length} subcategoría{subsWithDishes.length !== 1 ? 's' : ''}
                              </p>
                            );
                          })()}
                        </div>
                      </SortableItem>
                    );
                  })}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      {/* Mini preview */}
      {menu.logo || menu.name ? (
        <div className="mt-6">
          <h2 className="font-heading text-xl text-stone-700 mb-3">Vista previa del encabezado</h2>
          <div
            className="rounded-xl overflow-hidden h-32 flex flex-col items-center justify-center"
            style={{
              background: menu.backgroundTemplate?.type === 'custom' && menu.backgroundTemplate.customImage
                ? `url(${menu.backgroundTemplate.customImage}) center/cover`
                : bgColor,
            }}
          >
            {menu.logo && (
              <img src={menu.logo} alt="logo" className="h-14 object-contain mb-1" />
            )}
            <p className="font-heading text-2xl" style={{ fontFamily: menu.font }}>
              {menu.name}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
