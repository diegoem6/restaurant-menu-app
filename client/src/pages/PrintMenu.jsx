import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

// Standard A4 page size at 96dpi — locked before capture so the export
// doesn't depend on the exporting device's window size. A category whose
// content is taller than this is paginated into several same-size A4 pages
// (see buildCategoryUnits/paginateCategory) rather than clipped or shrunk, so
// every physical PDF page comes out the same true A4 size, with the
// configured margins, background and category/subcategory titles repeated
// fresh on each one.
const PDF_PAGE_WIDTH = 794;
const PDF_PAGE_MIN_HEIGHT = 1123;

// Base vertical padding of a page (matches the p-8 Tailwind class it replaces);
// the menu's configured top/bottom margins are added on top of this.
const PAGE_BASE_PADDING = 32;

// Safety margin subtracted from a page's usable height so small measurement
// differences (font metrics, rounding) never push content past the page —
// worst case a page renders slightly under-full rather than overflowing.
const PAGE_SAFETY_BUFFER = 24;
const MIN_PAGE_CAPACITY = 200;

// A category's title size is configurable in px; the subcategory title
// scales proportionally from it so it stays visually subordinate.
const SUBCATEGORY_SIZE_RATIO = 2 / 3;
const DEFAULT_CATEGORY_FONT_SIZE = 36;
const DEFAULT_DISH_FONT_SIZE = 20;
const DEFAULT_DISH_SPACING = 16;

const PRESETS = {
  white: { bg: '#ffffff', text: '#1c1917', accent: '#92400e' },
  cream: { bg: '#fef9f0', text: '#1c1917', accent: '#92400e' },
  dark: { bg: '#1c1917', text: '#fafaf9', accent: '#d97706' },
  forest: { bg: '#1a2e1a', text: '#f0fdf4', accent: '#86efac' },
  wine: { bg: '#3b0a0a', text: '#fef2f2', accent: '#fca5a5' },
  slate: { bg: '#1e293b', text: '#f8fafc', accent: '#93c5fd' },
};

// Flattens a category's direct dishes and subcategory dishes into one
// ordered list of "units" — the granularity at which we're allowed to break
// a page. Order matches the DOM order CategoryPage renders them in, which is
// what lets the export step's height measurements line up with this list.
function buildCategoryUnits(category) {
  const units = [];
  const sortedDishes = [...(category.dishes || [])].sort((a, b) => a.order - b.order);
  const sortedSubs = [...(category.subcategories || [])].sort((a, b) => a.order - b.order);
  sortedDishes.forEach((entry) => units.push({ type: 'dish', entry, sub: null }));
  sortedSubs.forEach((sub) => {
    units.push({ type: 'subheader', sub });
    const subDishes = [...(sub.dishes || [])].sort((a, b) => a.order - b.order);
    subDishes.forEach((entry) => units.push({ type: 'dish', entry, sub }));
  });
  return units;
}

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

function DishRow({ dish, isLast, font, hasBgImage, textColor, dishNameColor, dishFontSize, dishNameBold, dishSpacing }) {
  const prices = dish.prices || [];
  const multiPrice = prices.length > 1;
  const secondaryFontSize = dishFontSize * 0.65;
  const priceWeightClass = dishNameBold ? 'font-bold' : 'font-normal';
  return (
    <div
      className={`pdf-unit ${!isLast ? 'border-b' : ''}`}
      style={{
        borderBottomColor: hasBgImage ? 'rgba(255,255,255,0.15)' : `${textColor}22`,
        paddingTop: dishSpacing,
        paddingBottom: dishSpacing,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p
            className={dishNameBold ? 'font-semibold' : 'font-normal'}
            style={{ fontFamily: font, color: dishNameColor, fontSize: dishFontSize }}
          >
            {dish.menuName || dish.name}
          </p>
          {dish.description && (
            <p className="mt-1 opacity-60 leading-relaxed"
              style={{ color: dishNameColor, fontSize: dishFontSize }}>
              {dish.description}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0 ml-4">
          {multiPrice ? (
            <div className="flex items-start gap-4">
              {prices.map((p, i) => (
                <div key={i} className="text-right">
                  {p.label && (
                    <p className="opacity-60 mb-0.5"
                      style={{ color: dishNameColor, fontSize: secondaryFontSize }}>
                      {p.label}
                    </p>
                  )}
                  <p className={priceWeightClass}
                    style={{ color: dishNameColor, fontSize: dishFontSize }}>
                    ${p.priceUYU.toLocaleString('es-UY')}
                  </p>
                  {p.priceUSD != null && (
                    <p className="opacity-50"
                      style={{ color: dishNameColor, fontSize: secondaryFontSize }}>
                      U$S {p.priceUSD.toFixed(2)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          ) : prices.length === 1 ? (
            <>
              <p className={priceWeightClass}
                style={{ color: dishNameColor, fontSize: dishFontSize }}>
                {prices[0].label && (
                  <span className="font-normal opacity-60 mr-1"
                    style={{ color: dishNameColor, fontSize: secondaryFontSize }}>
                    {prices[0].label}
                  </span>
                )}
                ${prices[0].priceUYU.toLocaleString('es-UY')}
              </p>
              {prices[0].priceUSD != null && (
                <p className="opacity-50 mt-0.5"
                  style={{ color: dishNameColor, fontSize: secondaryFontSize }}>
                  U$S {prices[0].priceUSD.toFixed(2)}
                </p>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function SubHeaderBlock({ sub, font, categoryColor, hasBgImage, accentColor, subcategoryFontSize, subcategoryTitleBold, dishNameColor, showDescription }) {
  return (
    <>
      <h3
        className={subcategoryTitleBold ? 'font-semibold' : 'font-normal'}
        style={{ fontFamily: font, color: categoryColor, fontSize: subcategoryFontSize }}
      >
        {sub.name}
      </h3>
      <div
        className="w-10 h-px mt-1 mb-2"
        style={{ backgroundColor: hasBgImage ? 'rgba(255,255,255,0.3)' : accentColor }}
      />
      {showDescription && sub.description && (
        <p className="text-sm opacity-55 italic"
          style={{ color: dishNameColor }}>
          {sub.description}
        </p>
      )}
    </>
  );
}

function CategoryPage({
  category, units,
  font, hasBgImage, textColor, accentColor, dishNameColor, categoryColor,
  categoryFontSize, subcategoryFontSize, dishFontSize,
  categoryTitleBold, subcategoryTitleBold, dishNameBold, dishSpacing,
  bgStyle, pagePaddingTop, pagePaddingBottom, pagePaddingLeft, pagePaddingRight, logo, exporting,
}) {
  // If a page starts mid-subcategory (the header landed on a previous page),
  // repeat that subcategory's title at the top so the dishes keep context.
  const repeatedSub = units.length > 0 && units[0].type === 'dish' && units[0].sub
    ? units[0].sub
    : null;

  return (
    <div
      className="pdf-page pdf-category-page print-page-break min-h-screen"
      style={{
        ...bgStyle,
        paddingTop: pagePaddingTop,
        paddingBottom: pagePaddingBottom,
        paddingLeft: pagePaddingLeft,
        paddingRight: pagePaddingRight,
      }}
      data-category-id={category._id}
    >
      {hasBgImage && !exporting && (
        <div className="fixed inset-0 bg-black/20 print:hidden" style={{ zIndex: -1 }} />
      )}

      <div className="max-w-3xl mx-auto">
        <div className="pdf-category-header text-center mb-10">
          {logo && (
            <img src={logo} alt="logo"
              className="mx-auto mb-4 h-12 object-contain opacity-70" />
          )}
          <h2
            className={`mb-2 ${categoryTitleBold ? 'font-bold' : 'font-normal'}`}
            style={{ fontFamily: font, color: categoryColor, fontSize: categoryFontSize }}
          >
            {category.name}
          </h2>
          <div
            className="w-16 h-0.5 mx-auto mb-3"
            style={{ backgroundColor: hasBgImage ? 'rgba(255,255,255,0.4)' : accentColor }}
          />
          {category.description && (
            <p className="text-base opacity-60 italic max-w-lg mx-auto"
              style={{ color: dishNameColor }}>
              {category.description}
            </p>
          )}
        </div>

        {repeatedSub && (
          <div className="mb-4">
            <SubHeaderBlock sub={repeatedSub} font={font} categoryColor={categoryColor}
              hasBgImage={hasBgImage} accentColor={accentColor}
              subcategoryFontSize={subcategoryFontSize} subcategoryTitleBold={subcategoryTitleBold}
              dishNameColor={dishNameColor}
              showDescription={false} />
          </div>
        )}

        {units.map((unit, idx) => {
          if (unit.type === 'subheader') {
            return (
              <div key={`sub-${unit.sub._id}`} className="pdf-unit mt-8">
                <SubHeaderBlock sub={unit.sub} font={font} categoryColor={categoryColor}
                  hasBgImage={hasBgImage} accentColor={accentColor}
                  subcategoryFontSize={subcategoryFontSize} subcategoryTitleBold={subcategoryTitleBold}
                  dishNameColor={dishNameColor}
                  showDescription />
              </div>
            );
          }
          const dish = unit.entry.dish;
          if (!dish || typeof dish !== 'object') return null;
          return (
            <DishRow key={dish._id} dish={dish} isLast={idx === units.length - 1}
              font={font} hasBgImage={hasBgImage} textColor={textColor}
              dishNameColor={dishNameColor} dishFontSize={dishFontSize} dishNameBold={dishNameBold}
              dishSpacing={dishSpacing} />
          );
        })}
      </div>
    </div>
  );
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

  const { backgroundTemplate, logo, font, name, categories = [] } = menu;

  // Determine background & colors
  const presetKey = backgroundTemplate?.preset || 'cream';
  const theme = PRESETS[presetKey] || PRESETS.cream;
  const hasBgImage = backgroundTemplate?.type === 'custom' && backgroundTemplate.customImage;
  const bgStyle = hasBgImage
    ? { backgroundImage: `url(${backgroundTemplate.customImage})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { backgroundColor: theme.bg };
  const textColor = hasBgImage ? '#1c1917' : theme.text;
  const accentColor = hasBgImage ? '#92400e' : theme.accent;
  const titleColor = menu.titleFontColor || (hasBgImage ? '#fff' : textColor);
  const categoryColor = menu.categoryFontColor || (hasBgImage ? '#fff' : textColor);
  const dishNameColor = menu.dishFontColor || (hasBgImage ? '#fff' : textColor);
  const pagePaddingTop = PAGE_BASE_PADDING + (menu.pdfTopMargin || 0);
  const pagePaddingBottom = PAGE_BASE_PADDING + (menu.pdfBottomMargin || 0);
  const pagePaddingLeft = PAGE_BASE_PADDING + (menu.pdfLeftMargin || 0);
  const pagePaddingRight = PAGE_BASE_PADDING + (menu.pdfRightMargin || 0);
  const dishSpacing = menu.dishSpacing ?? DEFAULT_DISH_SPACING;

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order).filter((c) => c.category);

  const sharedPageProps = {
    font, hasBgImage, textColor, accentColor, dishNameColor, categoryColor,
    bgStyle, pagePaddingTop, pagePaddingBottom, pagePaddingLeft, pagePaddingRight, dishSpacing, logo, exporting,
  };

  // Each category controls its own title/dish text size (in px) and bold.
  const fontSizesFor = (category) => {
    const categoryFontSize = category.categoryFontSize || DEFAULT_CATEGORY_FONT_SIZE;
    const dishFontSize = category.dishFontSize || DEFAULT_DISH_FONT_SIZE;
    return {
      categoryFontSize,
      dishFontSize,
      subcategoryFontSize: categoryFontSize * SUBCATEGORY_SIZE_RATIO,
      categoryTitleBold: category.categoryTitleBold ?? true,
      subcategoryTitleBold: category.subcategoryTitleBold ?? true,
      dishNameBold: category.dishNameBold ?? true,
    };
  };

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
      const pageContentBudget = PDF_PAGE_MIN_HEIGHT - pagePaddingTop - pagePaddingBottom - PAGE_SAFETY_BUFFER;
      const layout = sortedCategories.map(({ category }) => {
        const units = buildCategoryUnits(category);
        const { headerHeight, unitHeights } = measurementByCatId.get(category._id) || { headerHeight: 0, unitHeights: [] };
        const groups = paginateCategory(units, unitHeights, headerHeight, pageContentBudget);
        return {
          category,
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
    <div ref={pagesRef} style={{ fontFamily: font, ...bgStyle, minHeight: '100vh', color: textColor }}>
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
      <div
        className="pdf-page min-h-screen flex flex-col items-center justify-center text-center relative"
        style={{
          ...bgStyle,
          paddingTop: pagePaddingTop,
          paddingBottom: pagePaddingBottom,
          paddingLeft: pagePaddingLeft,
          paddingRight: pagePaddingRight,
        }}
      >
        {hasBgImage && (
          <div className="absolute inset-0 bg-black/30" />
        )}
        <div className="relative z-10">
          {logo ? (
            <img src={logo} alt="logo"
              className="mx-auto mb-6 max-h-32 max-w-xs object-contain" />
          ) : (
            <div className="text-6xl mb-6">🍽️</div>
          )}
          <h1
            className="text-5xl md:text-6xl font-bold mb-4"
            style={{ fontFamily: font, color: titleColor }}
          >
            {name}
          </h1>
          <div
            className="w-24 h-0.5 mx-auto mb-4"
            style={{ backgroundColor: hasBgImage ? 'rgba(255,255,255,0.5)' : accentColor }}
          />
          <p className="text-lg opacity-60" style={{ color: hasBgImage ? '#fff' : textColor }}>
            Menú
          </p>
        </div>
      </div>

      {/* Categories — each on a new page (or several, if paginated for export) */}
      {exportLayout
        ? exportLayout.flatMap(({ category, pages }) =>
            pages.map((units, i) => (
              <CategoryPage
                key={`${category._id}-${i}`}
                category={category}
                units={units}
                {...sharedPageProps}
                {...fontSizesFor(category)}
              />
            ))
          )
        : sortedCategories.map(({ category }) => (
            <CategoryPage
              key={category._id}
              category={category}
              units={buildCategoryUnits(category)}
              {...sharedPageProps}
              {...fontSizesFor(category)}
            />
          ))}

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
