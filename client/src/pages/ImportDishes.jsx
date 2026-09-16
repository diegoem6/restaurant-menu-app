import { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import toast from 'react-hot-toast';

const normalize = (s) =>
  (s ?? '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseNumber = (val) => {
  if (val === undefined || val === null || val === '') return null;
  const cleaned = val.toString().replace(/[^\d.,-]/g, '').replace(',', '.');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
};

const comboKey = (categoryText, subcategoryText) => `${categoryText} ${subcategoryText}`;

function detectColumns(headerRow) {
  const map = { name: -1, menuName: -1, description: -1, category: -1, subcategory: -1 };
  const priceCols = [];

  headerRow.forEach((raw, idx) => {
    const norm = normalize(raw);
    if (!norm) return;
    if (norm === 'subcategoria' || norm.startsWith('subcategoria')) {
      map.subcategory = idx;
    } else if (norm === 'categoria' || norm.startsWith('categoria')) {
      map.category = idx;
    } else if (norm.includes('nombre interno')) {
      map.name = idx;
    } else if (norm.includes('nombre carta')) {
      map.menuName = idx;
    } else if (norm.startsWith('descripcion')) {
      map.description = idx;
    } else if (norm.includes('precio')) {
      const text = raw.toString();
      const quoted = text.match(/"([^"]*)"/);
      const label = quoted ? quoted[1].trim() : text.replace(/precio/i, '').trim();
      priceCols.push({ idx, label });
    }
  });

  return { map, priceCols };
}

function parseRows(sheetRows) {
  if (!sheetRows.length) return { rows: [], priceCols: [], columnsFound: false };
  const [headerRow, ...dataRows] = sheetRows;
  const { map, priceCols } = detectColumns(headerRow);
  const columnsFound = map.name !== -1 && map.category !== -1;

  const rows = dataRows
    .map((r, i) => {
      const name = map.name !== -1 ? (r[map.name] ?? '').toString().trim() : '';
      const menuName = map.menuName !== -1 ? (r[map.menuName] ?? '').toString().trim() : '';
      const description = map.description !== -1 ? (r[map.description] ?? '').toString().trim() : '';
      const categoryText = map.category !== -1 ? (r[map.category] ?? '').toString().trim() : '';
      const subcategoryText = map.subcategory !== -1 ? (r[map.subcategory] ?? '').toString().trim() : '';

      const prices = priceCols
        .map((pc) => ({ label: pc.label, priceUYU: parseNumber(r[pc.idx]) }))
        .filter((p) => p.priceUYU !== null && p.priceUYU >= 0);

      return {
        rowIndex: i,
        name,
        menuName,
        description,
        categoryText,
        subcategoryText,
        prices,
      };
    })
    .filter((r) => r.name || r.categoryText || r.prices.length);

  return { rows, priceCols, columnsFound };
}

export default function ImportDishes() {
  const fileInputRef = useRef(null);
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [fileName, setFileName] = useState('');
  const [parsedRows, setParsedRows] = useState([]);
  const [priceCols, setPriceCols] = useState([]);
  const [columnsFound, setColumnsFound] = useState(true);
  const [mapping, setMapping] = useState({});
  const [included, setIncluded] = useState({});
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    api.get('/categories')
      .then((res) => setCategories(res.data))
      .catch(() => toast.error('Error al cargar categorías'))
      .finally(() => setLoadingCategories(false));
  }, []);

  const resetImport = () => {
    setFileName('');
    setParsedRows([]);
    setPriceCols([]);
    setMapping({});
    setIncluded({});
    setResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setFileName(file.name);

    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const sheetRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false });

      const { rows, priceCols: cols, columnsFound: found } = parseRows(sheetRows);
      setColumnsFound(found);
      setPriceCols(cols);
      setParsedRows(rows);

      // Auto-match categories/subcategories by name, build one mapping entry per distinct combo
      const initialMapping = {};
      const initialIncluded = {};
      rows.forEach((row) => {
        const key = comboKey(row.categoryText, row.subcategoryText);
        if (!(key in initialMapping)) {
          const cat = categories.find((c) => normalize(c.name) === normalize(row.categoryText));
          const sub = cat?.subcategories?.find(
            (s) => normalize(s.name) === normalize(row.subcategoryText)
          );
          initialMapping[key] = {
            categoryId: row.categoryText ? cat?._id || '' : '',
            subcategoryId: row.subcategoryText ? sub?._id || '' : '',
          };
        }
        initialIncluded[row.rowIndex] = row.name.length > 0 && row.prices.length > 0;
      });
      setMapping(initialMapping);
      setIncluded(initialIncluded);
    } catch (err) {
      toast.error('No se pudo leer el archivo. Verificá que sea un CSV o Excel válido.');
      resetImport();
    }
  };

  const updateMapping = (key, field, value) => {
    setMapping((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value,
        ...(field === 'categoryId' ? { subcategoryId: '' } : {}),
      },
    }));
  };

  const distinctCombos = [...new Map(
    parsedRows
      .filter((r) => included[r.rowIndex])
      .map((r) => [comboKey(r.categoryText, r.subcategoryText), r])
  ).values()];

  const importableRows = parsedRows.filter((r) => r.name && r.prices.length);
  const skippedRows = parsedRows.filter((r) => !(r.name && r.prices.length));
  const includedCount = Object.values(included).filter(Boolean).length;

  const toggleIncluded = (rowIndex) =>
    setIncluded((prev) => ({ ...prev, [rowIndex]: !prev[rowIndex] }));

  const handleImport = async () => {
    const items = parsedRows
      .filter((r) => included[r.rowIndex])
      .map((r) => {
        const map = mapping[comboKey(r.categoryText, r.subcategoryText)] || {};
        return {
          name: r.name,
          menuName: r.menuName,
          description: r.description,
          prices: r.prices,
          categoryId: map.categoryId || null,
          subcategoryId: map.subcategoryId || null,
        };
      });

    if (!items.length) {
      toast.error('No hay filas seleccionadas para importar');
      return;
    }

    setImporting(true);
    try {
      const res = await api.post('/import/dishes', { items });
      setResult(res.data);
      if (res.data.createdCount > 0) {
        toast.success(`${res.data.createdCount} platos importados`);
      }
      if (res.data.errors?.length) {
        toast.error(`${res.data.errors.length} filas con errores`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || 'Error al importar');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="text-3xl font-heading text-stone-800">Importar platos</h1>
          <p className="text-stone-500 text-sm mt-1 font-body">
            Cargá un archivo CSV o Excel para crear platos en lote
          </p>
        </div>
        {fileName && (
          <button className="btn-secondary" onClick={resetImport}>
            Cargar otro archivo
          </button>
        )}
      </div>

      {!fileName && (
        <div className="card p-8">
          <div className="mb-5 text-sm text-stone-600 font-body space-y-2">
            <p>El archivo debe tener columnas con estos encabezados (el orden no importa):</p>
            <ul className="list-disc list-inside text-stone-500 space-y-0.5">
              <li><span className="font-medium text-stone-700">Nombre Interno</span> — nombre del plato</li>
              <li><span className="font-medium text-stone-700">Nombre Carta</span> — opcional, nombre a mostrar</li>
              <li><span className="font-medium text-stone-700">Descripción</span> — opcional</li>
              <li><span className="font-medium text-stone-700">Categoría</span> / <span className="font-medium text-stone-700">Subcategoría</span> — deben coincidir con una ya creada, o se pueden asignar manualmente al importar</li>
              <li><span className="font-medium text-stone-700">Precio "ETIQUETA"</span> — una o varias columnas de precio, cada una se importa como una variante de precio</li>
            </ul>
            <p className="text-stone-400 text-xs">Las filas sin nombre o sin ningún precio válido se omiten automáticamente.</p>
          </div>
          <label className={`btn-primary inline-block ${loadingCategories ? 'opacity-50 pointer-events-none' : 'cursor-pointer'}`}>
            {loadingCategories ? 'Cargando categorías...' : 'Seleccionar archivo'}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              className="hidden"
              disabled={loadingCategories}
              onChange={handleFile}
            />
          </label>
        </div>
      )}

      {fileName && !result && (
        <>
          {!columnsFound && (
            <div className="card p-4 mb-4 bg-amber-50 border-amber-200 text-amber-800 text-sm font-body">
              No se detectaron las columnas "Nombre Interno" y "Categoría" en <strong>{fileName}</strong>. Revisá los encabezados del archivo.
            </div>
          )}

          <div className="card p-4 mb-4 flex flex-wrap gap-6 text-sm font-body">
            <div><span className="text-stone-400">Archivo:</span> <span className="font-medium text-stone-700">{fileName}</span></div>
            <div><span className="text-stone-400">Filas detectadas:</span> <span className="font-medium text-stone-700">{parsedRows.length}</span></div>
            <div><span className="text-stone-400">Con precio válido:</span> <span className="font-medium text-stone-700">{importableRows.length}</span></div>
            <div><span className="text-stone-400">Omitidas (sin nombre/precio):</span> <span className="font-medium text-stone-700">{skippedRows.length}</span></div>
            <div><span className="text-stone-400">Seleccionadas para importar:</span> <span className="font-medium text-amber-700">{includedCount}</span></div>
          </div>

          {/* Mapping table */}
          {distinctCombos.length > 0 && (
            <div className="card p-4 mb-4">
              <h2 className="font-heading text-lg text-stone-800 mb-3">Asignar categorías y subcategorías</h2>
              <p className="text-xs text-stone-400 font-body mb-3">
                Se detectaron estas combinaciones en el archivo. Elegí a qué categoría/subcategoría ya creada corresponden.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-stone-400 text-xs uppercase tracking-wide">
                      <th className="pb-2 pr-4">Categoría en archivo</th>
                      <th className="pb-2 pr-4">Subcategoría en archivo</th>
                      <th className="pb-2 pr-4">Categoría destino</th>
                      <th className="pb-2">Subcategoría destino</th>
                    </tr>
                  </thead>
                  <tbody>
                    {distinctCombos.map((row) => {
                      const key = comboKey(row.categoryText, row.subcategoryText);
                      const m = mapping[key] || {};
                      const selectedCat = categories.find((c) => c._id === m.categoryId);
                      return (
                        <tr key={key} className="border-t border-stone-100">
                          <td className="py-2 pr-4 text-stone-600">{row.categoryText || <span className="text-stone-300">—</span>}</td>
                          <td className="py-2 pr-4 text-stone-600">{row.subcategoryText || <span className="text-stone-300">—</span>}</td>
                          <td className="py-2 pr-4">
                            <select
                              className="input py-1 text-sm"
                              value={m.categoryId || ''}
                              onChange={(e) => updateMapping(key, 'categoryId', e.target.value)}
                            >
                              <option value="">Sin asignar</option>
                              {categories.map((c) => (
                                <option key={c._id} value={c._id}>{c.name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2">
                            <select
                              className="input py-1 text-sm"
                              value={m.subcategoryId || ''}
                              onChange={(e) => updateMapping(key, 'subcategoryId', e.target.value)}
                              disabled={!selectedCat?.subcategories?.length}
                            >
                              <option value="">Ninguna</option>
                              {selectedCat?.subcategories?.map((s) => (
                                <option key={s._id} value={s._id}>{s.name}</option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Preview table */}
          <div className="card p-4 mb-4">
            <h2 className="font-heading text-lg text-stone-800 mb-3">Vista previa</h2>
            <div className="overflow-x-auto max-h-96 overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white">
                  <tr className="text-left text-stone-400 text-xs uppercase tracking-wide">
                    <th className="pb-2 pr-3">Importar</th>
                    <th className="pb-2 pr-3">Nombre</th>
                    <th className="pb-2 pr-3">Categoría / Subcategoría</th>
                    <th className="pb-2">Precios</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((row) => {
                    const valid = row.name && row.prices.length > 0;
                    return (
                      <tr key={row.rowIndex} className={`border-t border-stone-100 ${!valid ? 'opacity-40' : ''}`}>
                        <td className="py-1.5 pr-3">
                          <input
                            type="checkbox"
                            className="accent-amber-600"
                            checked={!!included[row.rowIndex]}
                            disabled={!valid}
                            onChange={() => toggleIncluded(row.rowIndex)}
                          />
                        </td>
                        <td className="py-1.5 pr-3 text-stone-700">
                          {row.name || <span className="text-stone-300 italic">sin nombre</span>}
                          {row.menuName && row.menuName !== row.name && (
                            <span className="text-xs text-amber-700 ml-1">({row.menuName})</span>
                          )}
                        </td>
                        <td className="py-1.5 pr-3 text-stone-500 text-xs">
                          {row.categoryText || '—'}{row.subcategoryText ? ` / ${row.subcategoryText}` : ''}
                        </td>
                        <td className="py-1.5 text-stone-600 text-xs">
                          {row.prices.length
                            ? row.prices.map((p, i) => (
                                <span key={i} className="mr-2">
                                  {p.label && <span className="text-stone-400">{p.label}: </span>}
                                  ${p.priceUYU}
                                </span>
                              ))
                            : <span className="text-stone-300 italic">sin precio</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <button className="btn-secondary" onClick={resetImport}>Cancelar</button>
            <button
              className="btn-primary"
              onClick={handleImport}
              disabled={importing || includedCount === 0}
            >
              {importing ? 'Importando...' : `Importar ${includedCount} platos`}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="card p-6">
          <h2 className="font-heading text-xl text-stone-800 mb-2">Importación completa</h2>
          <p className="text-stone-600 font-body mb-4">
            {result.createdCount} platos creados correctamente.
          </p>
          {result.errors?.length > 0 && (
            <div>
              <p className="text-sm font-medium text-red-600 mb-2">{result.errors.length} filas con errores:</p>
              <ul className="text-sm text-stone-500 space-y-1 max-h-60 overflow-y-auto">
                {result.errors.map((e, i) => (
                  <li key={i}>• {e.name}: {e.message}</li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button className="btn-primary" onClick={resetImport}>Importar otro archivo</button>
          </div>
        </div>
      )}
    </div>
  );
}
