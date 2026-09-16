import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';

const FONTS = [
  'Playfair Display', 'Lora', 'Cormorant Garamond',
  'Montserrat', 'Raleway', 'Great Vibes', 'Josefin Sans',
];

const PRESETS = [
  { id: 'white', label: 'Blanco', bg: '#ffffff', text: '#1c1917' },
  { id: 'cream', label: 'Crema', bg: '#fef9f0', text: '#1c1917' },
  { id: 'dark', label: 'Oscuro', bg: '#1c1917', text: '#fafaf9' },
  { id: 'forest', label: 'Bosque', bg: '#1a2e1a', text: '#f0fdf4' },
  { id: 'wine', label: 'Vino', bg: '#3b0a0a', text: '#fef2f2' },
  { id: 'slate', label: 'Pizarra', bg: '#1e293b', text: '#f8fafc' },
];

function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

function MenuForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState({
    name: initial?.name || '',
    font: initial?.font || 'Playfair Display',
    bgType: initial?.backgroundTemplate?.type || 'preset',
    bgPreset: initial?.backgroundTemplate?.preset || 'cream',
    bgCustom: initial?.backgroundTemplate?.customImage || null,
    logo: initial?.logo || null,
    titleFontColor: initial?.titleFontColor || null,
    categoryFontColor: initial?.categoryFontColor || null,
    dishFontColor: initial?.dishFontColor || null,
    categoryFontSize: initial?.categoryFontSize || 'medium',
    dishFontSize: initial?.dishFontSize || 'medium',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSave({
        name: form.name,
        font: form.font,
        backgroundTemplate: {
          type: form.bgType,
          preset: form.bgPreset,
          customImage: form.bgType === 'custom' ? form.bgCustom : null,
        },
        logo: form.logo,
        titleFontColor: form.titleFontColor,
        categoryFontColor: form.categoryFontColor,
        dishFontColor: form.dishFontColor,
        categoryFontSize: form.categoryFontSize,
        dishFontSize: form.dishFontSize,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="label">Nombre de la carta *</label>
        <input className="input" value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })} required />
      </div>

      <div>
        <label className="label">Fuente</label>
        <select className="input" value={form.font}
          onChange={(e) => setForm({ ...form, font: e.target.value })}>
          {FONTS.map((f) => (
            <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
          ))}
        </select>
        <p className="text-sm mt-1.5 text-stone-500 font-body" style={{ fontFamily: form.font }}>
          Vista previa: Menú del Restaurante
        </p>
      </div>

      <div>
        <label className="label">Color de fuente — Nombre de la carta</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.titleFontColor || '#1c1917'}
            onChange={(e) => setForm({ ...form, titleFontColor: e.target.value })}
            className="h-9 w-14 rounded cursor-pointer border border-stone-200 p-0.5"
          />
          <span className="text-sm text-stone-500 font-mono">
            {form.titleFontColor || 'Color del tema'}
          </span>
          {form.titleFontColor && (
            <button
              type="button"
              onClick={() => setForm({ ...form, titleFontColor: null })}
              className="text-xs text-stone-400 hover:text-stone-600 underline"
            >
              Usar color del tema
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label">Color de fuente — Categorías</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.categoryFontColor || '#1c1917'}
            onChange={(e) => setForm({ ...form, categoryFontColor: e.target.value })}
            className="h-9 w-14 rounded cursor-pointer border border-stone-200 p-0.5"
          />
          <span className="text-sm text-stone-500 font-mono">
            {form.categoryFontColor || 'Color del tema'}
          </span>
          {form.categoryFontColor && (
            <button
              type="button"
              onClick={() => setForm({ ...form, categoryFontColor: null })}
              className="text-xs text-stone-400 hover:text-stone-600 underline"
            >
              Usar color del tema
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label">Color de fuente — Platos</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={form.dishFontColor || '#1c1917'}
            onChange={(e) => setForm({ ...form, dishFontColor: e.target.value })}
            className="h-9 w-14 rounded cursor-pointer border border-stone-200 p-0.5"
          />
          <span className="text-sm text-stone-500 font-mono">
            {form.dishFontColor || 'Color del tema'}
          </span>
          {form.dishFontColor && (
            <button
              type="button"
              onClick={() => setForm({ ...form, dishFontColor: null })}
              className="text-xs text-stone-400 hover:text-stone-600 underline"
            >
              Usar color del tema
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="label">Tamaño de fuente — Categorías</label>
        <div className="flex gap-2">
          {[['small', 'Chico'], ['medium', 'Medio'], ['large', 'Grande']].map(([val, label]) => (
            <button key={val} type="button"
              onClick={() => setForm({ ...form, categoryFontSize: val })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                form.categoryFontSize === val
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'border-stone-300 text-stone-600 hover:bg-stone-50'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Tamaño de fuente — Platos</label>
        <div className="flex gap-2">
          {[['small', 'Chico'], ['medium', 'Medio'], ['large', 'Grande']].map(([val, label]) => (
            <button key={val} type="button"
              onClick={() => setForm({ ...form, dishFontSize: val })}
              className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                form.dishFontSize === val
                  ? 'bg-amber-700 text-white border-amber-700'
                  : 'border-stone-300 text-stone-600 hover:bg-stone-50'
              }`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label">Fondo</label>
        <div className="flex gap-2 mb-3">
          <button type="button"
            onClick={() => setForm({ ...form, bgType: 'preset' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              form.bgType === 'preset'
                ? 'bg-amber-700 text-white border-amber-700'
                : 'border-stone-300 text-stone-600 hover:bg-stone-50'
            }`}>
            Preestablecido
          </button>
          <button type="button"
            onClick={() => setForm({ ...form, bgType: 'custom' })}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
              form.bgType === 'custom'
                ? 'bg-amber-700 text-white border-amber-700'
                : 'border-stone-300 text-stone-600 hover:bg-stone-50'
            }`}>
            Imagen personalizada
          </button>
        </div>

        {form.bgType === 'preset' ? (
          <div className="grid grid-cols-3 gap-2">
            {PRESETS.map((p) => (
              <button key={p.id} type="button"
                onClick={() => setForm({ ...form, bgPreset: p.id })}
                className={`h-12 rounded-lg border-2 transition-all text-xs font-medium ${
                  form.bgPreset === p.id ? 'border-amber-500 scale-105' : 'border-transparent'
                }`}
                style={{ background: p.bg, color: p.text }}>
                {p.label}
              </button>
            ))}
          </div>
        ) : (
          <div>
            <input type="file" accept="image/*" className="input text-sm"
              onChange={async (e) => {
                const f = e.target.files[0];
                if (f) setForm({ ...form, bgCustom: await toBase64(f) });
              }} />
            {form.bgCustom && (
              <img src={form.bgCustom} alt="preview"
                className="mt-2 h-20 w-full object-cover rounded-lg" />
            )}
          </div>
        )}
      </div>

      <div>
        <label className="label">Logo del restaurante</label>
        <input type="file" accept="image/*" className="input text-sm"
          onChange={async (e) => {
            const f = e.target.files[0];
            if (f) setForm({ ...form, logo: await toBase64(f) });
          }} />
        {form.logo && (
          <div className="mt-2 flex items-center gap-3">
            <img src={form.logo} alt="logo" className="h-12 w-12 object-contain rounded" />
            <button type="button" onClick={() => setForm({ ...form, logo: null })}
              className="text-xs text-red-500 hover:text-red-700">Eliminar logo</button>
          </div>
        )}
      </div>

      <div className="flex gap-3 justify-end pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="btn-primary">
          {loading ? 'Guardando...' : 'Guardar carta'}
        </button>
      </div>
    </form>
  );
}

const presetBg = (id) => PRESETS.find((p) => p.id === id)?.bg || '#fef9f0';

export default function Menus() {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => { loadMenus(); }, []);

  const loadMenus = async () => {
    try {
      const res = await api.get('/menus');
      setMenus(res.data);
    } catch {
      toast.error('Error al cargar cartas');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (data) => {
    try {
      const res = await api.post('/menus', data);
      setMenus([res.data, ...menus]);
      setModal(null);
      toast.success('Carta creada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleEdit = async (data) => {
    try {
      const res = await api.put(`/menus/${modal._id}`, data);
      setMenus(menus.map((m) => (m._id === modal._id ? res.data : m)));
      setModal(null);
      toast.success('Carta actualizada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/menus/${deleteTarget._id}`);
      setMenus(menus.filter((m) => m._id !== deleteTarget._id));
      toast.success('Carta eliminada');
    } catch {
      toast.error('Error al eliminar');
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-heading text-stone-800">Cartas</h1>
          <p className="text-stone-500 text-sm mt-1 font-body">{menus.length} cartas</p>
        </div>
        <button className="btn-primary" onClick={() => setModal('create')}>
          + Nueva carta
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-stone-400">Cargando...</div>
      ) : menus.length === 0 ? (
        <div className="card p-10 text-center text-stone-400">
          <div className="text-4xl mb-3">📋</div>
          <p className="font-body">No hay cartas. ¡Creá la primera!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {menus.map((menu) => {
            const bg = menu.backgroundTemplate?.type === 'custom' && menu.backgroundTemplate.customImage
              ? menu.backgroundTemplate.customImage
              : null;
            const bgColor = presetBg(menu.backgroundTemplate?.preset || 'cream');

            return (
              <div key={menu._id} className="card overflow-hidden flex flex-col">
                {/* Preview header */}
                <div
                  className="h-24 flex items-center justify-center relative"
                  style={{
                    background: bg ? `url(${bg}) center/cover` : bgColor,
                  }}
                >
                  {menu.logo ? (
                    <img src={menu.logo} alt="logo" className="h-14 object-contain" />
                  ) : (
                    <p className="font-heading text-xl opacity-60" style={{ fontFamily: menu.font }}>
                      {menu.name}
                    </p>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <h3 className="font-medium text-stone-800 mb-1">{menu.name}</h3>
                  <p className="text-xs text-stone-400 font-body mb-3">
                    {menu.categories?.length || 0} categorías · {menu.font}
                  </p>

                  <div className="mt-auto flex gap-2">
                    <Link to={`/menus/${menu._id}/edit`} className="btn-primary flex-1 justify-center text-xs">
                      ✏️ Editar
                    </Link>
                    <Link
                      to={`/menus/${menu._id}/print`}
                      target="_blank"
                      className="btn-secondary px-3 text-xs"
                      title="Imprimir"
                    >
                      🖨️
                    </Link>
                    <button
                      onClick={() => setModal(menu)}
                      className="btn-secondary px-3 text-xs"
                      title="Configuración"
                    >
                      ⚙️
                    </button>
                    <button
                      onClick={() => setDeleteTarget(menu)}
                      className="btn-ghost px-3 text-xs hover:text-red-500"
                      title="Eliminar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={!!modal}
        onClose={() => setModal(null)}
        title={modal === 'create' ? 'Nueva carta' : 'Configurar carta'}
        size="lg"
      >
        {modal && (
          <MenuForm
            initial={modal === 'create' ? null : modal}
            onSave={modal === 'create' ? handleCreate : handleEdit}
            onCancel={() => setModal(null)}
          />
        )}
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Eliminar carta"
        message={`¿Eliminar la carta "${deleteTarget?.name}"? Las categorías y platos no serán eliminados.`}
      />
    </div>
  );
}
