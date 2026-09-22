import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { FONT_GROUPS, BG_PRESETS, toBase64 } from '../lib/menuAssets';
import { deriveMenuTheme, deriveMenuFonts, fontSizesFor, buildCategoryUnits, unitKey, resolveDishBoxes, CoverPage, CategoryPage, FreeElementView } from '../components/CartaRender';

const PREVIEW_PAGE_WIDTH = 794;
const isObjectId = (s) => /^[0-9a-fA-F]{24}$/.test(s || '');
const genTempId = () => `tmp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

// Renders <option>s grouped by style (Clásicas, Diseño gráfico, etc.).
function FontOptions() {
  return FONT_GROUPS.map((group) => (
    <optgroup key={group.label} label={group.label}>
      {group.fonts.map((f) => (
        <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
      ))}
    </optgroup>
  ));
}

// Human-readable label for a dish/subheader unit's overlay, from its box key.
const dishBoxLabel = (units, key) => {
  const unit = units.find((u) => unitKey(u) === key);
  if (!unit) return 'Plato';
  if (unit.type === 'subheader') return `Subtítulo: ${unit.sub.name}`;
  const dish = unit.entry.dish;
  return dish?.menuName || dish?.name || 'Plato';
};

// Renders one page (via `render(scale)`) scaled down to fit the width of its
// container, so the live preview always shows a whole page. `scale` is handed
// to the caller so overlaid interactive elements can convert screen-pixel
// drag deltas into page-space pixels.
function ScaledPreview({ render }) {
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
  }, []);

  return (
    <div ref={outerRef} className="w-full rounded-xl shadow-lg border border-stone-200 overflow-hidden bg-white"
      style={{ height: contentHeight * scale || undefined }}>
      <div ref={innerRef} style={{ width: PREVIEW_PAGE_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
        {render(scale)}
      </div>
    </div>
  );
}

// A free element rendered with drag-to-move / drag-to-resize handles.
function CanvasElement({ el, scale, selected, onSelect, onChange, defaultFont }) {
  const startDrag = (e) => {
    e.stopPropagation();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = el.x;
    const startTop = el.y;
    const onMove = (ev) => {
      onChange({
        x: Math.round(startLeft + (ev.clientX - startX) / scale),
        y: Math.round(startTop + (ev.clientY - startY) / scale),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResize = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = el.width;
    const startH = el.height;
    const onMove = (ev) => {
      onChange({
        width: Math.max(24, Math.round(startW + (ev.clientX - startX) / scale)),
        height: Math.max(20, Math.round(startH + (ev.clientY - startY) / scale)),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={startDrag}
      style={{
        position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height,
        cursor: 'move',
        outline: selected ? '2px solid #b45309' : '1px dashed rgba(180,83,9,0.5)',
        zIndex: selected ? 1003 : 1002,
      }}
    >
      <div style={{ width: '100%', height: '100%', pointerEvents: 'none' }}>
        <FreeElementView el={el} defaultFont={defaultFont} />
      </div>
      {selected && (
        <div
          onMouseDown={startResize}
          className="bg-amber-700 rounded-sm"
          style={{ position: 'absolute', right: -6, bottom: -6, width: 14, height: 14, cursor: 'nwse-resize' }}
        />
      )}
    </div>
  );
}

// A drag/resize handle for the title block or an individual dish/subheader
// box — the actual content is already drawn at this exact position by
// CategoryPage itself, so this overlay only needs a border + resize handle.
function BlockOverlay({ box, label, scale, selected, onSelect, onChange, color = '#2563eb' }) {
  const startDrag = (e) => {
    e.stopPropagation();
    onSelect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startLeft = box.x;
    const startTop = box.y;
    const onMove = (ev) => {
      onChange({
        x: Math.round(startLeft + (ev.clientX - startX) / scale),
        y: Math.round(startTop + (ev.clientY - startY) / scale),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResize = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = box.width;
    const startH = box.height;
    const onMove = (ev) => {
      onChange({
        width: Math.max(40, Math.round(startW + (ev.clientX - startX) / scale)),
        height: Math.max(24, Math.round(startH + (ev.clientY - startY) / scale)),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={startDrag}
      style={{
        position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height,
        cursor: 'move',
        outline: selected ? `2px solid ${color}` : `1px dashed ${color}80`,
        zIndex: selected ? 1001 : 1000,
      }}
    >
      <span className="text-white" style={{
        position: 'absolute', top: -20, left: 0, fontSize: 11, background: color,
        padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
      {selected && (
        <div
          onMouseDown={startResize}
          className="rounded-sm"
          style={{ position: 'absolute', right: -6, bottom: -6, width: 14, height: 14, cursor: 'nwse-resize', background: color }}
        />
      )}
    </div>
  );
}

// Same visual as BlockOverlay, but the drag start is driven entirely by the
// caller (onMouseDownDrag) instead of an internal onSelect+onChange pair —
// this is what lets MenuDesigner move every selected dish together as a
// group when several are shift-selected, rather than just this one box.
function DishBoxOverlay({ box, label, scale, selected, resizable, onMouseDownDrag, onResize, color }) {
  const startResize = (e) => {
    e.stopPropagation();
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = box.width;
    const startH = box.height;
    const onMove = (ev) => {
      onResize({
        width: Math.max(40, Math.round(startW + (ev.clientX - startX) / scale)),
        height: Math.max(24, Math.round(startH + (ev.clientY - startY) / scale)),
      });
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <div
      onMouseDown={onMouseDownDrag}
      style={{
        position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height,
        cursor: 'move',
        outline: selected ? `2px solid ${color}` : `1px dashed ${color}80`,
        zIndex: selected ? 1001 : 1000,
      }}
    >
      <span className="text-white" style={{
        position: 'absolute', top: -20, left: 0, fontSize: 11, background: color,
        padding: '1px 6px', borderRadius: 4, whiteSpace: 'nowrap', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis',
      }}>
        {label}
      </span>
      {selected && resizable && (
        <div
          onMouseDown={startResize}
          className="rounded-sm"
          style={{ position: 'absolute', right: -6, bottom: -6, width: 14, height: 14, cursor: 'nwse-resize', background: color }}
        />
      )}
    </div>
  );
}

const formFromMenu = (m) => ({
  name: m.name || '',
  font: m.font || 'Playfair Display',
  categoryFont: m.categoryFont || null,
  dishFont: m.dishFont || null,
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
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [blockLayout, setBlockLayout] = useState([]);
  const [selectedBlock, setSelectedBlock] = useState(null); // null | 'title'
  const [selectedDishKeys, setSelectedDishKeys] = useState([]); // shift-click to select several
  const [previewTarget, setPreviewTarget] = useState('cover'); // 'cover' | category id
  const titleRef = useRef(null);
  const unitRefsMap = useRef(new Map());
  const scaleRef = useRef(1);

  const registerUnitRef = (key, node) => {
    if (node) unitRefsMap.current.set(key, node);
    else unitRefsMap.current.delete(key);
  };

  useEffect(() => {
    api.get(`/menus/${id}`)
      .then((res) => {
        setMenu(res.data);
        setForm(formFromMenu(res.data));
        setElements(res.data.freeElements || []);
        setBlockLayout(res.data.blockLayout || []);
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
    categoryFont: form.categoryFont,
    dishFont: form.dishFont,
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
  const fonts = deriveMenuFonts(draftMenu);
  const previewCategory = previewTarget !== 'cover'
    ? sortedCategories.find((c) => c.category._id === previewTarget)?.category
    : null;

  const pageElements = elements.filter((el) => el.page === previewTarget);
  const selectedElement = elements.find((el) => el._id === selectedId) || null;
  const catLayout = previewCategory ? blockLayout.find((b) => b.category === previewTarget) : null;
  const previewUnits = previewCategory ? buildCategoryUnits(previewCategory) : [];
  const resolvedDishBoxes = catLayout ? resolveDishBoxes(previewUnits, catLayout.dishBoxes) : [];

  const selectPage = (target) => {
    setPreviewTarget(target);
    setSelectedId(null);
    setSelectedBlock(null);
    setSelectedDishKeys([]);
  };

  // Switches the current category from the automatic (classic) layout to a
  // custom one, capturing the title box and every dish/subheader unit's box
  // at their current rendered position/size so there's no visual jump —
  // from there each dish can be dragged independently.
  const customizeLayout = () => {
    if (!titleRef.current) return;
    const pageEl = titleRef.current.closest('.pdf-category-page');
    if (!pageEl) return;
    const pageRect = pageEl.getBoundingClientRect();
    const scale = scaleRef.current || 1;
    const toBox = (node) => {
      const r = node.getBoundingClientRect();
      return {
        x: Math.round((r.left - pageRect.left) / scale),
        y: Math.round((r.top - pageRect.top) / scale),
        width: Math.round(r.width / scale),
        height: Math.round(r.height / scale),
      };
    };
    const titleBox = toBox(titleRef.current);
    const dishBoxes = previewUnits
      .map((unit) => {
        const key = unitKey(unit);
        const node = unitRefsMap.current.get(key);
        return node ? { key, ...toBox(node) } : null;
      })
      .filter(Boolean);
    setBlockLayout((prev) => [
      ...prev.filter((b) => b.category !== previewTarget),
      { category: previewTarget, titleBox, dishBoxes },
    ]);
  };

  const resetLayout = () => {
    setBlockLayout((prev) => prev.filter((b) => b.category !== previewTarget));
    setSelectedBlock(null);
    setSelectedDishKeys([]);
  };

  const updateTitleBox = (patch) => {
    setBlockLayout((prev) => prev.map((b) => (
      b.category === previewTarget ? { ...b, titleBox: { ...b.titleBox, ...patch } } : b
    )));
  };

  // Upserts a single dish/subheader's box — the box may not exist yet in
  // saved state if it's a fallback-positioned unit (e.g. a dish added after
  // the category was customized) being dragged for the first time.
  const updateDishBox = (key, patch, fallbackBox) => {
    setBlockLayout((prev) => prev.map((b) => {
      if (b.category !== previewTarget) return b;
      const exists = (b.dishBoxes || []).some((db) => db.key === key);
      const dishBoxes = exists
        ? b.dishBoxes.map((db) => (db.key === key ? { ...db, ...patch } : db))
        : [...(b.dishBoxes || []), { ...fallbackBox, ...patch }];
      return { ...b, dishBoxes };
    }));
  };

  // Moves several dish/subheader boxes to new positions in one update — used
  // while dragging a multi (shift-click) selection, so the whole group moves
  // together in lockstep. Upserts any not-yet-saved (fallback) boxes too.
  const moveDishBoxes = (positions) => {
    setBlockLayout((prev) => prev.map((b) => {
      if (b.category !== previewTarget) return b;
      const posByKey = new Map(positions.map((p) => [p.key, p]));
      const existingKeys = new Set((b.dishBoxes || []).map((db) => db.key));
      const dishBoxes = (b.dishBoxes || []).map((db) => (
        posByKey.has(db.key) ? { ...db, x: posByKey.get(db.key).x, y: posByKey.get(db.key).y } : db
      ));
      positions.forEach((p) => {
        if (existingKeys.has(p.key)) return;
        const fallback = resolvedDishBoxes.find((rb) => rb.key === p.key);
        dishBoxes.push({ key: p.key, x: p.x, y: p.y, width: fallback?.width ?? 500, height: fallback?.height ?? 70 });
      });
      return { ...b, dishBoxes };
    }));
  };

  // Handles selecting a dish box (plain click replaces the selection, unless
  // it's already part of the current multi-selection — then it keeps the
  // group selected so it can be dragged together; shift-click toggles it in
  // or out of the selection) and starts the drag that moves every selected
  // box together by the same delta.
  const startDishDrag = (e, box) => {
    e.stopPropagation();
    const shift = e.shiftKey;
    const nextSelection = shift
      ? (selectedDishKeys.includes(box.key)
        ? selectedDishKeys.filter((k) => k !== box.key)
        : [...selectedDishKeys, box.key])
      : (selectedDishKeys.includes(box.key) ? selectedDishKeys : [box.key]);
    setSelectedDishKeys(nextSelection);
    setSelectedBlock(null);
    setSelectedId(null);
    if (!nextSelection.includes(box.key)) return; // shift-click just deselected this box

    const scale = scaleRef.current || 1;
    const startX = e.clientX;
    const startY = e.clientY;
    const startPositions = nextSelection.map((k) => {
      const b = resolvedDishBoxes.find((rb) => rb.key === k);
      return { key: k, x: b.x, y: b.y };
    });
    const onMove = (ev) => {
      const dx = Math.round((ev.clientX - startX) / scale);
      const dy = Math.round((ev.clientY - startY) / scale);
      moveDishBoxes(startPositions.map((p) => ({ key: p.key, x: p.x + dx, y: p.y + dy })));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const addElement = (type) => {
    const newId = genTempId();
    const base = { _id: newId, page: previewTarget, type, zIndex: 0, opacity: 1 };
    const el = type === 'text'
      ? { ...base, x: 60, y: 60, width: 240, height: 60, text: 'Texto nuevo', fontSize: 24, color: '#1c1917', bold: false, align: 'left' }
      : { ...base, x: 60, y: 60, width: 160, height: 160, src: null };
    setElements((prev) => [...prev, el]);
    setSelectedId(newId);
    setSelectedBlock(null);
    setSelectedDishKeys([]);
  };

  const updateElement = (elId, patch) =>
    setElements((prev) => prev.map((el) => (el._id === elId ? { ...el, ...patch } : el)));

  const deleteElement = (elId) => {
    setElements((prev) => prev.filter((el) => el._id !== elId));
    if (selectedId === elId) setSelectedId(null);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payloadElements = elements
        .filter((el) => el.type !== 'image' || el.src) // drop empty image placeholders
        .map(({ _id, ...rest }) => (isObjectId(_id) ? { _id, ...rest } : rest));

      const res = await api.put(`/menus/${id}`, {
        name: form.name,
        font: form.font,
        categoryFont: form.categoryFont,
        dishFont: form.dishFont,
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
        freeElements: payloadElements,
        blockLayout,
      });
      setMenu(res.data);
      setForm(formFromMenu(res.data));
      setElements(res.data.freeElements || []);
      setBlockLayout(res.data.blockLayout || []);
      setSelectedId(null);
      setSelectedBlock(null);
      setSelectedDishKeys([]);
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
            <label className="label">Fuente — Nombre de la carta</label>
            <select className="input" value={form.font}
              onChange={(e) => setForm({ ...form, font: e.target.value })}>
              <FontOptions />
            </select>
          </div>

          <div>
            <label className="label">Fuente — Categorías</label>
            <select className="input" value={form.categoryFont || ''}
              onChange={(e) => setForm({ ...form, categoryFont: e.target.value || null })}>
              <option value="">Usar fuente de la carta ({form.font})</option>
              <FontOptions />
            </select>
          </div>

          <div>
            <label className="label">Fuente — Platos</label>
            <select className="input" value={form.dishFont || ''}
              onChange={(e) => setForm({ ...form, dishFont: e.target.value || null })}>
              <option value="">Usar fuente de la carta ({form.font})</option>
              <FontOptions />
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
            El tamaño de letra y la negrita de categorías/platos se configuran por categoría, desde "Categorías".
          </p>
        </div>

        {/* Right: live preview + free elements */}
        <div className="lg:sticky lg:top-4">
          <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
            <label className="label mb-0">Vista previa</label>
            <select className="input w-auto text-sm py-1.5" value={previewTarget}
              onChange={(e) => selectPage(e.target.value)}>
              <option value="cover">Portada</option>
              {sortedCategories.map(({ category }) => (
                <option key={category._id} value={category._id}>{category.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button type="button" onClick={() => addElement('text')} className="btn-secondary text-xs">
              + Texto
            </button>
            <button type="button" onClick={() => addElement('image')} className="btn-secondary text-xs">
              + Imagen
            </button>
            {previewCategory && (
              catLayout ? (
                <button type="button" onClick={resetLayout} className="btn-secondary text-xs">
                  ↩️ Diseño automático
                </button>
              ) : (
                <button type="button" onClick={customizeLayout} className="btn-secondary text-xs">
                  📐 Personalizar diseño (arrastrar cada plato)
                </button>
              )
            )}
            <p className="text-xs text-stone-400 font-body ml-1">
              {previewCategory && !catLayout
                ? 'Personalizá el diseño para poder arrastrar cada plato con su precio individualmente.'
                : 'Arrastrá para mover, usá la esquina para redimensionar. Mantené Shift y hacé clic para seleccionar varios platos y moverlos juntos.'}
            </p>
          </div>

          {selectedBlock && (
            <div className="card p-3 mb-4 border-blue-200 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">📌 Título de categoría</p>
              <span className="text-xs text-stone-400">Arrastrá o redimensioná</span>
            </div>
          )}

          {selectedDishKeys.length > 0 && (
            <div className="card p-3 mb-4 border-emerald-200 flex items-center justify-between">
              <p className="text-sm font-medium text-stone-700">
                🍽️ {selectedDishKeys.length === 1
                  ? dishBoxLabel(previewUnits, selectedDishKeys[0])
                  : `${selectedDishKeys.length} platos seleccionados`}
              </p>
              <span className="text-xs text-stone-400">
                {selectedDishKeys.length === 1 ? 'Arrastrá o redimensioná' : 'Arrastrá para mover el grupo'}
              </span>
            </div>
          )}

          {selectedElement && (
            <div className="card p-4 space-y-3 mb-4 border-amber-300">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-stone-700">
                  {selectedElement.type === 'text' ? '🔤 Texto seleccionado' : '🖼️ Imagen seleccionada'}
                </p>
                <button onClick={() => deleteElement(selectedElement._id)}
                  className="text-xs text-red-500 hover:text-red-700">🗑️ Eliminar</button>
              </div>

              {selectedElement.type === 'text' ? (
                <>
                  <textarea className="input resize-none" rows={2} value={selectedElement.text}
                    onChange={(e) => updateElement(selectedElement._id, { text: e.target.value })} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Tamaño (px)</label>
                      <input type="number" min="8" max="150" className="input"
                        value={selectedElement.fontSize}
                        onChange={(e) => updateElement(selectedElement._id, { fontSize: Number(e.target.value) || 24 })} />
                    </div>
                    <div>
                      <label className="text-xs text-stone-500 mb-1 block">Color</label>
                      <input type="color" className="h-9 w-full rounded cursor-pointer border border-stone-200 p-0.5"
                        value={selectedElement.color}
                        onChange={(e) => updateElement(selectedElement._id, { color: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
                      <input type="checkbox" className="accent-amber-600" checked={selectedElement.bold}
                        onChange={(e) => updateElement(selectedElement._id, { bold: e.target.checked })} />
                      Negrita
                    </label>
                    <div className="flex gap-1">
                      {[['left', '⬅️'], ['center', '↔️'], ['right', '➡️']].map(([a, icon]) => (
                        <button key={a} type="button"
                          onClick={() => updateElement(selectedElement._id, { align: a })}
                          className={`px-2 py-1 rounded text-xs border ${
                            selectedElement.align === a ? 'bg-amber-700 text-white border-amber-700' : 'border-stone-300 text-stone-600'
                          }`}>
                          {icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <input type="file" accept="image/*" className="input text-sm"
                    onChange={async (e) => {
                      const f = e.target.files[0];
                      if (f) updateElement(selectedElement._id, { src: await toBase64(f) });
                    }} />
                  <div>
                    <label className="text-xs text-stone-500 mb-1 block">Opacidad</label>
                    <input type="range" min="0" max="1" step="0.05" className="w-full accent-amber-600"
                      value={selectedElement.opacity ?? 1}
                      onChange={(e) => updateElement(selectedElement._id, { opacity: Number(e.target.value) })} />
                  </div>
                </>
              )}
            </div>
          )}

          {sortedCategories.length === 0 && previewTarget === 'cover' && (
            <p className="text-xs text-stone-400 font-body mb-2">
              Esta carta todavía no tiene categorías — <Link to={`/menus/${id}/edit`} className="text-amber-700 hover:underline">agregalas acá</Link> para previsualizarlas.
            </p>
          )}

          <ScaledPreview
            render={(scale) => {
              scaleRef.current = scale;
              return (
                <div className="relative" onMouseDown={() => { setSelectedId(null); setSelectedBlock(null); setSelectedDishKeys([]); }}>
                  {previewCategory ? (
                    <CategoryPage
                      category={previewCategory}
                      units={previewUnits}
                      logo={draftMenu.logo}
                      exporting={false}
                      {...theme}
                      {...fonts}
                      {...fontSizesFor(previewCategory)}
                      titleBox={catLayout?.titleBox}
                      dishBoxes={catLayout?.dishBoxes}
                      titleRef={titleRef}
                      registerUnitRef={registerUnitRef}
                    />
                  ) : (
                    <CoverPage menu={draftMenu} theme={theme} />
                  )}
                  {catLayout && (
                    <>
                      <BlockOverlay
                        box={catLayout.titleBox}
                        label="Título"
                        scale={scale}
                        selected={selectedBlock === 'title'}
                        onSelect={() => { setSelectedBlock('title'); setSelectedId(null); setSelectedDishKeys([]); }}
                        onChange={(patch) => updateTitleBox(patch)}
                      />
                      {resolvedDishBoxes.map((box) => (
                        <DishBoxOverlay
                          key={box.key}
                          box={box}
                          label={dishBoxLabel(previewUnits, box.key)}
                          color="#059669"
                          scale={scale}
                          selected={selectedDishKeys.includes(box.key)}
                          resizable={selectedDishKeys.length === 1 && selectedDishKeys[0] === box.key}
                          onMouseDownDrag={(e) => startDishDrag(e, box)}
                          onResize={(patch) => updateDishBox(box.key, patch, box)}
                        />
                      ))}
                    </>
                  )}
                  {pageElements.map((el) => (
                    <CanvasElement
                      key={el._id}
                      el={el}
                      scale={scale}
                      selected={selectedId === el._id}
                      onSelect={() => { setSelectedId(el._id); setSelectedBlock(null); setSelectedDishKeys([]); }}
                      onChange={(patch) => updateElement(el._id, patch)}
                      defaultFont={draftMenu.font}
                    />
                  ))}
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}
