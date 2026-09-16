import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { FONTS, BG_PRESETS, toBase64 } from '../lib/menuAssets';
import { deriveMenuTheme, fontSizesFor, buildCategoryUnits, CoverPage, CategoryPage } from '../components/CartaRender';

const PREVIEW_PAGE_WIDTH = 794;

// Renders `children` (one .pdf-page sized element) scaled down to fit the
// width of its container, so the live preview always shows a whole page.
function ScaledPreview({ children }) {
  const outerRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    const recompute = () => {
      if (!outerRef.current || !innerRef.current) return;
      const availableWidth = outerRef.current.clientWidth;
      setScale(availableWidth > 0 ? Math.min(availableWidth / PREVIEW_PAGE_WIDTH, 1) : 1);
      setContentHeight(innerRef.current.scrollHeight);
    };
    const ro = new ResizeObserver(recompute);
    if (outerRef.current) ro.observe(outerRef.current);
    if (innerRef.current) ro.observe(innerRef.current);
    recompute();
    return () => ro.disconnect();
  }, [children]);

  return (
    <div ref={outerRef} className="w-full rounded-xl shadow-lg border border-stone-200 overflow-hidden bg-white"
      style={{ height: contentHeight * scale || undefined }}>
      <div ref={innerRef} style={{ width: PREVIEW_PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {children}
      </div>
    </div>
  );
}

const formFromMenu = (m) => ({
  name: m.name || '',
  font: m.font || 'Playfair Display',
  bgType: m.backgroundTemplate?.type || 'preset',
  bgPreset: m.backgroundTemplate?.preset || 'cream',
  bgCustom: m.backgroundTemplate?.customImage || null,
  logo: m.logo || null,
  titleFontColor: m.titleFontColor || null,
  categoryFontColor: m.categoryFontColor || null,
  dishFontColor: m.dishFontColor || null,
  pdfTopMargin: m.pdfTopMargin ?? 0,
  pdfBottomMargin: m.pdfBottomMargin ?? 0,
  pdfLeftMargin: m.pdfLeftMargin ?? 0,
  pdfRightMargin: m.pdfRightMargin ?? 0,
  dishSpacing: m.dishSpacing ?? 16,
});

export default function MenuDesigner() {
  const { id } = useParams();
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [previewTarget, setPreviewTarget] = useState('cover'); // 'cover' | category id

  useEffect(() => {
    api.get(`/menus/${id}`)
      .then((res) => {
        setMenu(res.data);
        setForm(formFromMenu(res.data));
      })
      .catch(() => toast.error('Error al cargar la carta'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading || !menu || !form) return (
    <div className="text-center py-12 text-stone-400">Cargando...</div>
  );

  const sortedCategories = [...(menu.categories || [])]
    .sort((a, b) => a.order - b.order)
    .filter((c) => c.category);

  // Draft menu reflecting live (unsaved) form edits — feeds the same
  // rendering components PrintMenu.jsx uses, so the preview matches exactly.
  const draftMenu = {
    ...menu,
    name: form.name,
    font: form.font,
    logo: form.logo,
    titleFontColor: form.titleFontColor,
    categoryFontColor: form.categoryFontColor,
    dishFontColor: form.dishFontColor,
    pdfTopMargin: Number(form.pdfTopMargin) || 0,
    pdfBottomMargin: Number(form.pdfBottomMargin) || 0,
    pdfLeftMargin: Number(form.pdfLeftMargin) || 0,
    pdfRightMargin: Number(form.pdfRightMargin) || 0,
    dishSpacing: Number(form.dishSpacing) || 0,
    backgroundTemplate: {
      type: form.bgType,
      preset: form.bgPreset,
      customImage: form.bgType === 'custom' ? form.bgCustom : null,
    },
  };

  const theme = deriveMenuTheme(draftMenu);
  const previewCategory = previewTarget !== 'cover'
    ? sortedCategories.find((c) => c.category._id === previewTarget)?.category
    : null;

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.put(`/menus/${id}`, {
        name: form.name,
        font: form.font,
        backgroundTemplate: draftMenu.backgroundTemplate,
        logo: form.logo,
        titleFontColor: form.titleFontColor,
        categoryFontColor: form.categoryFontColor,
        dishFontColor: form.dishFontColor,
        pdfTopMargin: draftMenu.pdfTopMargin,
        pdfBottomMargin: draftMenu.pdfBottomMargin,
        pdfLeftMargin: draftMenu.pdfLeftMargin,
        pdfRightMargin: draftMenu.pdfRightMargin,
        dishSpacing: draftMenu.dishSpacing,
      });
      setMenu(res.data);
      setForm(formFromMenu(res.data));
      toast.success('Carta guardada');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="page-header flex-wrap gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/menus" className="text-stone-400 hover:text-stone-600 transition-colors">←</Link>
          <div>
            <h1 className="text-3xl font-heading text-stone-800 truncate">Diseñar carta</h1>
            <p className="text-stone-500 text-sm font-body">{menu.name}</p>
          </div>
        </div>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Guardando...' : '💾 Guardar cambios'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
        {/* Left: settings */}
        <div className="card p-5 space-y-5 lg:max-h-[calc(100vh-180px)] lg:overflow-y-auto">
          <div>
            <label className="label">Nombre de la carta</label>
            <input className="input" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <div>
            <label className="label">Fuente</label>
            <select className="input" value={form.font}
              onChange={(e) => setForm({ ...form, font: e.target.value })}>
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Color — Nombre de la carta</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.titleFontColor || '#1c1917'}
                onChange={(e) => setForm({ ...form, titleFontColor: e.target.value })}
                className="h-9 w-14 rounded cursor-pointer border border-stone-200 p-0.5" />
              {form.titleFontColor && (
                <button type="button" onClick={() => setForm({ ...form, titleFontColor: null })}
                  className="text-xs text-stone-400 hover:text-stone-600 underline">
                  Usar color del tema
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="label">Color — Categorías</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.categoryFontColor || '#1c1917'}
                onChange={(e) => setForm({ ...form, categoryFontColor: e.target.value })}
                className="h-9 w-14 rounded cursor-pointer border border-stone-200 p-0.5" />
              {form.categoryFontColor && (
                <button type="button" onClick={() => setForm({ ...form, categoryFontColor: null })}
                  className="text-xs text-stone-400 hover:text-stone-600 underline">
                  Usar color del tema
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="label">Color — Platos</label>
            <div className="flex items-center gap-3">
              <input type="color" value={form.dishFontColor || '#1c1917'}
                onChange={(e) => setForm({ ...form, dishFontColor: e.target.value })}
                className="h-9 w-14 rounded cursor-pointer border border-stone-200 p-0.5" />
              {form.dishFontColor && (
                <button type="button" onClick={() => setForm({ ...form, dishFontColor: null })}
                  className="text-xs text-stone-400 hover:text-stone-600 underline">
                  Usar color del tema
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="label">Fondo</label>
            <div className="flex gap-2 mb-3">
              <button type="button"
                onClick={() => setForm({ ...form, bgType: 'preset' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  form.bgType === 'preset' ? 'bg-amber-700 text-white border-amber-700' : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                }`}>
                Preestablecido
              </button>
              <button type="button"
                onClick={() => setForm({ ...form, bgType: 'custom' })}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  form.bgType === 'custom' ? 'bg-amber-700 text-white border-amber-700' : 'border-stone-300 text-stone-600 hover:bg-stone-50'
                }`}>
                Imagen personalizada
              </button>
            </div>

            {form.bgType === 'preset' ? (
              <div className="grid grid-cols-3 gap-2">
                {BG_PRESETS.map((p) => (
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

          <div>
            <label className="label">Márgenes del PDF</label>
            <p className="text-xs text-stone-400 font-body mb-2">
              Espacio en blanco alrededor de cada página al exportar/imprimir.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Superior (px)</label>
                <input type="number" min="0" max="300" className="input"
                  value={form.pdfTopMargin}
                  onChange={(e) => setForm({ ...form, pdfTopMargin: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Inferior (px)</label>
                <input type="number" min="0" max="300" className="input"
                  value={form.pdfBottomMargin}
                  onChange={(e) => setForm({ ...form, pdfBottomMargin: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Izquierdo (px)</label>
                <input type="number" min="0" max="300" className="input"
                  value={form.pdfLeftMargin}
                  onChange={(e) => setForm({ ...form, pdfLeftMargin: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-stone-500 mb-1 block">Derecho (px)</label>
                <input type="number" min="0" max="300" className="input"
                  value={form.pdfRightMargin}
                  onChange={(e) => setForm({ ...form, pdfRightMargin: e.target.value })} />
              </div>
            </div>
          </div>

          <div>
            <label className="label">Separación entre platos (px)</label>
            <input type="number" min="0" max="80" className="input w-32"
              value={form.dishSpacing}
              onChange={(e) => setForm({ ...form, dishSpacing: e.target.value })} />
          </div>

          <p className="text-xs text-stone-400 font-body pt-2 border-t border-stone-100">
            El tamaño de letra y la negrita se configuran por categoría, desde "Categorías".
          </p>
        </div>

        {/* Right: live preview */}
        <div className="lg:sticky lg:top-4">
          <div className="flex items-center justify-between mb-3">
            <label className="label mb-0">Vista previa</label>
            <select className="input w-auto text-sm py-1.5" value={previewTarget}
              onChange={(e) => setPreviewTarget(e.target.value)}>
              <option value="cover">Portada</option>
              {sortedCategories.map(({ category }) => (
                <option key={category._id} value={category._id}>{category.name}</option>
              ))}
            </select>
          </div>

          {sortedCategories.length === 0 && previewTarget === 'cover' && (
            <p className="text-xs text-stone-400 font-body mb-2">
              Esta carta todavía no tiene categorías — <Link to={`/menus/${id}/edit`} className="text-amber-700 hover:underline">agregalas acá</Link> para previsualizarlas.
            </p>
          )}

          <ScaledPreview>
            {previewCategory ? (
              <CategoryPage
                category={previewCategory}
                units={buildCategoryUnits(previewCategory)}
                font={draftMenu.font}
                logo={draftMenu.logo}
                exporting={false}
                {...theme}
                {...fontSizesFor(previewCategory)}
              />
            ) : (
              <CoverPage menu={draftMenu} theme={theme} />
            )}
          </ScaledPreview>
        </div>
      </div>
    </div>
  );
}
