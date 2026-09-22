import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';
import { deriveMenuTheme, deriveMenuFonts, fontSizesFor, buildCategoryUnits, CoverPage, CategoryPage } from '../components/CartaRender';

// Standard A4 page size at 96dpi — locked before capture so the export
// doesn't depend on the exporting device's window size. A category whose
// content is taller than this is paginated into several same-size A4 pages
// (see buildCategoryUnits/paginateCategory) rather than clipped or shrunk, so
// every physical PDF page comes out the same true A4 size, with the
// configured margins, background and category/subcategory titles repeated
// fresh on each one.
const PDF_PAGE_WIDTH = 794;
const PDF_PAGE_MIN_HEIGHT = 1123;

// Safety margin subtracted from a page's usable height so small measurement
// differences (font metrics, rounding) never push content past the page —
// worst case a page renders slightly under-full rather than overflowing.
const PAGE_SAFETY_BUFFER = 24;
const MIN_PAGE_CAPACITY = 200;

// Greedily packs units into pages. Every page repeats the category title (and,
// if it starts mid-subcategory, that subcategory's title too), so the usable
// capacity of each page accounts for those repeated headers using their real
// measured heights rather than a guessed constant.
function paginateCategory(units, unitHeights, categoryHeaderHeight, pageContentBudget) {
  const subHeaderHeightById = new Map();
  units.forEach((u, idx) => {
    if (u.type === 'subheader') subHeaderHeightById.set(u.sub._id, unitHeights[idx] || 0);
  });

  const pages = [];
  let i = 0;
  do {
    const activeSub = units[i] && units[i].type === 'dish' && units[i].sub ? units[i].sub : null;
    const repeatSubHeaderHeight = activeSub ? (subHeaderHeightById.get(activeSub._id) || 0) : 0;
    const capacity = Math.max(pageContentBudget - categoryHeaderHeight - repeatSubHeaderHeight, MIN_PAGE_CAPACITY);

    const start = i;
    let currentHeight = 0;
    let j = i;
    while (j < units.length) {
      const h = unitHeights[j] || 0;
      if (j > start && currentHeight + h > capacity) break;
      currentHeight += h;
      j++;
    }
    if (j === start) j = start + 1;

    pages.push({ start, end: Math.min(j, units.length) });
    i = j;
  } while (i < units.length);

  return pages;
}

export default function PrintMenu() {
  const { id } = useParams();
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportLayout, setExportLayout] = useState(null);
  const pagesRef = useRef(null);

  useEffect(() => {
    api.get(`/menus/${id}`)
      .then((res) => setMenu(res.data))
      .catch(() => setError('No se pudo cargar la carta'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-stone-50">
      <div className="text-center">
        <div className="text-4xl mb-3 animate-pulse">🍽️</div>
        <p className="text-stone-400 font-body">Preparando carta...</p>
      </div>
    </div>
  );

  if (error || !menu) return (
    <div className="flex items-center justify-center min-h-screen bg-stone-50">
      <p className="text-stone-400 font-body">{error || 'Carta no encontrada'}</p>
    </div>
  );

  const { categories = [] } = menu;
  const theme = deriveMenuTheme(menu);
  const fonts = deriveMenuFonts(menu);
  const { bgStyle, textColor, pagePaddingTop, pagePaddingBottom } = theme;

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order).filter((c) => c.category);

  const sharedPageProps = { ...theme, ...fonts, logo: menu.logo, exporting };

  const elementsForPage = (pageKey) => (menu.freeElements || []).filter((el) => el.page === pageKey);

  // A category with a saved blockLayout entry uses a custom title position
  // and a per-dish free layout instead of the classic automatic flow — it
  // renders on a single page, exactly as placed in the designer.
  const blockLayoutForCategory = (categoryId) =>
    (menu.blockLayout || []).find((b) => (b.category?._id || b.category) === categoryId);

  const handleExportPdf = async () => {
    if (exporting || !pagesRef.current) return;
    setExporting(true);
    let finalPageEls = [];
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      // 1. Lock a consistent width on the current (unpaginated) pages and
      // measure how tall each category's header/dishes actually render.
      const categoryPageEls = Array.from(pagesRef.current.querySelectorAll('.pdf-category-page'));
      categoryPageEls.forEach((el) => { el.style.width = `${PDF_PAGE_WIDTH}px`; });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      const measurementByCatId = new Map(
        categoryPageEls.map((el) => {
          const headerEl = el.querySelector('.pdf-category-header');
          const headerHeight = headerEl ? headerEl.getBoundingClientRect().height : 0;
          const unitHeights = Array.from(el.querySelectorAll('.pdf-unit')).map((u) => u.getBoundingClientRect().height);
          return [el.dataset.categoryId, { headerHeight, unitHeights }];
        })
      );

      // 2. Turn each category into one or more pages that each fit within
      // one A4 sheet (margins + repeated titles included), from real heights.
      // A category with a custom layout renders as a single page — every
      // dish already has an explicit position placed by the user in the
      // designer, so there's nothing to paginate.
      const classicPageContentBudget = PDF_PAGE_MIN_HEIGHT - pagePaddingTop - pagePaddingBottom - PAGE_SAFETY_BUFFER;
      const layout = sortedCategories.map(({ category }) => {
        const units = buildCategoryUnits(category);
        const catLayout = blockLayoutForCategory(category._id);
        if (catLayout) {
          return { category, catLayout, pages: [units] };
        }
        const { headerHeight, unitHeights } = measurementByCatId.get(category._id) || { headerHeight: 0, unitHeights: [] };
        const groups = paginateCategory(units, unitHeights, headerHeight, classicPageContentBudget);
        return {
          category,
          catLayout: null,
          pages: groups.map((g) => units.slice(g.start, g.end)),
        };
      });

      // 3. Re-render with the paginated layout — every resulting .pdf-page
      // now fits within one A4 sheet, with its own margins and background.
      setExportLayout(layout);
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      finalPageEls = Array.from(pagesRef.current.querySelectorAll('.pdf-page'));
      finalPageEls.forEach((el) => {
        el.style.width = `${PDF_PAGE_WIDTH}px`;
        el.style.minHeight = `${PDF_PAGE_MIN_HEIGHT}px`;
      });
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      // 4. Capture each page 1:1 — no slicing needed, every page is already
      // at most one A4 sheet tall.
      console.log(`Exportando PDF: ${finalPageEls.length} páginas`);
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      let isFirstPage = true;
      for (let pageIdx = 0; pageIdx < finalPageEls.length; pageIdx++) {
        const el = finalPageEls[pageIdx];
        const catName = el.closest('.pdf-category-page')?.querySelector('.pdf-category-header h2')?.textContent;
        try {
          const rect = el.getBoundingClientRect();
          console.log(`Página ${pageIdx + 1}/${finalPageEls.length} (${catName || 'portada'}): ${Math.round(rect.width)}x${Math.round(rect.height)}px`);
          const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/jpeg', 0.92);
          if (!imgData || imgData === 'data:,') {
            throw new Error('El canvas capturado quedó vacío (posible límite de tamaño del navegador)');
          }
          if (!isFirstPage) pdf.addPage('a4', 'portrait');
          pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297);
          isFirstPage = false;
        } catch (pageErr) {
          throw new Error(`Falló la página ${pageIdx + 1}/${finalPageEls.length} (${catName || 'portada'}): ${pageErr.message}`);
        }
      }

      const fileName = (menu?.name || 'carta').replace(/[^\w\-]+/g, '_');
      pdf.save(`${fileName}.pdf`);
    } catch (err) {
      console.error('Export PDF failed', err);
      alert(`No se pudo generar el PDF: ${err.message || 'error desconocido'}`);
    } finally {
      finalPageEls.forEach((el) => {
        el.style.removeProperty('width');
        el.style.removeProperty('min-height');
      });
      setExportLayout(null);
      setExporting(false);
    }
  };

  return (
    <div ref={pagesRef} style={{ fontFamily: fonts.titleFont, ...bgStyle, minHeight: '100vh', color: textColor }}>
      {/* Print button - hidden in print */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={handleExportPdf}
          disabled={exporting}
          className="bg-amber-700 hover:bg-amber-800 disabled:opacity-60 disabled:cursor-wait text-white px-4 py-2 rounded-lg text-sm font-body flex items-center gap-2 shadow-lg transition-colors"
        >
          {exporting ? '⏳ Generando…' : '📄 Exportar PDF'}
        </button>
        <button
          onClick={() => window.print()}
          className="bg-stone-600 hover:bg-stone-500 text-white px-4 py-2 rounded-lg text-sm font-body flex items-center gap-2 shadow-lg transition-colors"
        >
          🖨️ Imprimir
        </button>
        <button
          onClick={() => window.close()}
          className="bg-stone-700 hover:bg-stone-600 text-white px-4 py-2 rounded-lg text-sm font-body shadow-lg transition-colors"
        >
          ✕ Cerrar
        </button>
      </div>

      {/* Cover / First page */}
      <CoverPage menu={menu} theme={theme} freeElements={elementsForPage('cover')} />

      {/* Categories — each on a new page (or several, if paginated for export).
          Free elements only decorate a category's first physical page. */}
      {exportLayout
        ? exportLayout.flatMap(({ category, pages, catLayout }) =>
            pages.map((units, i) => (
              <CategoryPage
                key={`${category._id}-${i}`}
                category={category}
                units={units}
                {...sharedPageProps}
                {...fontSizesFor(category)}
                freeElements={i === 0 ? elementsForPage(category._id) : []}
                titleBox={catLayout?.titleBox}
                dishBoxes={catLayout?.dishBoxes}
              />
            ))
          )
        : sortedCategories.map(({ category }) => {
            const catLayout = blockLayoutForCategory(category._id);
            return (
              <CategoryPage
                key={category._id}
                category={category}
                units={buildCategoryUnits(category)}
                {...sharedPageProps}
                {...fontSizesFor(category)}
                freeElements={elementsForPage(category._id)}
                titleBox={catLayout?.titleBox}
                dishBoxes={catLayout?.dishBoxes}
              />
            );
          })}

      {/* Print CSS injected inline */}
      <style>{`
        @media print {
          @page { margin: 0; }
          .no-print { display: none !important; }
          .print-page-break { page-break-before: always; }
          *, body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
