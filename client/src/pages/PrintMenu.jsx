import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

// Standard A4 page size at 96dpi — used as a minimum so pages export with
// consistent, print-ready proportions regardless of the exporting device's
// window size. Pages with more content than this are simply allowed to grow
// taller (no clipping), producing a taller PDF page rather than losing dishes.
const PDF_PAGE_WIDTH = 794;
const PDF_PAGE_MIN_HEIGHT = 1123;

const CATEGORY_SIZES = { small: '1.75rem', medium: '2.25rem', large: '3rem' };
const SUBCATEGORY_SIZES = { small: '1.25rem', medium: '1.5rem', large: '2rem' };
const DISH_SIZES = { small: '1rem', medium: '1.25rem', large: '1.625rem' };

const PRESETS = {
  white: { bg: '#ffffff', text: '#1c1917', accent: '#92400e' },
  cream: { bg: '#fef9f0', text: '#1c1917', accent: '#92400e' },
  dark: { bg: '#1c1917', text: '#fafaf9', accent: '#d97706' },
  forest: { bg: '#1a2e1a', text: '#f0fdf4', accent: '#86efac' },
  wine: { bg: '#3b0a0a', text: '#fef2f2', accent: '#fca5a5' },
  slate: { bg: '#1e293b', text: '#f8fafc', accent: '#93c5fd' },
};

function DishList({ dishes, font, hasBgImage, textColor, accentColor, dishNameColor, dishFontSize }) {
  return (
    <div className="space-y-0">
      {dishes.map(({ dish }, dishIdx) => {
        if (!dish || typeof dish !== 'object') return null;
        const isLast = dishIdx === dishes.length - 1;
        const prices = dish.prices || [];
        const multiPrice = prices.length > 1;
        return (
          <div
            key={dish._id}
            className={`py-4 ${!isLast ? 'border-b' : ''}`}
            style={{ borderBottomColor: hasBgImage ? 'rgba(255,255,255,0.15)' : `${textColor}22` }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <p
                  className="font-semibold"
                  style={{ fontFamily: font, color: dishNameColor, fontSize: dishFontSize }}
                >
                  {dish.menuName || dish.name}
                </p>
                {dish.description && (
                  <p className="text-sm mt-1 opacity-60 leading-relaxed"
                    style={{ color: dishNameColor }}>
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
                          <p className="text-xs opacity-60 mb-0.5"
                            style={{ color: dishNameColor }}>
                            {p.label}
                          </p>
                        )}
                        <p className="font-bold"
                          style={{ color: dishNameColor }}>
                          ${p.priceUYU.toLocaleString('es-UY')}
                        </p>
                        {p.priceUSD != null && (
                          <p className="text-xs opacity-50"
                            style={{ color: dishNameColor }}>
                            U$S {p.priceUSD.toFixed(2)}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : prices.length === 1 ? (
                  <>
                    <p className="text-lg font-bold"
                      style={{ color: dishNameColor }}>
                      {prices[0].label && (
                        <span className="text-sm font-normal opacity-60 mr-1"
                          style={{ color: dishNameColor }}>
                          {prices[0].label}
                        </span>
                      )}
                      ${prices[0].priceUYU.toLocaleString('es-UY')}
                    </p>
                    {prices[0].priceUSD != null && (
                      <p className="text-xs opacity-50 mt-0.5"
                        style={{ color: dishNameColor }}>
                        U$S {prices[0].priceUSD.toFixed(2)}
                      </p>
                    )}
                  </>
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function PrintMenu() {
  const { id } = useParams();
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  const pagesRef = useRef(null);

  const handleExportPdf = async () => {
    if (exporting || !pagesRef.current) return;
    setExporting(true);
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const pageEls = Array.from(pagesRef.current.querySelectorAll('.pdf-page'));

      // Lock a consistent minimum page size before capturing so the export
      // doesn't depend on the exporting device's browser window size.
      pageEls.forEach((el) => {
        el.style.width = `${PDF_PAGE_WIDTH}px`;
        el.style.minHeight = `${PDF_PAGE_MIN_HEIGHT}px`;
      });
      // Let the browser reflow with the locked dimensions before capturing.
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

      let pdf = null;
      for (const el of pageEls) {
        const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
        const imgData = canvas.toDataURL('image/jpeg', 0.92);
        if (!pdf) {
          pdf = new jsPDF({ unit: 'px', format: [canvas.width, canvas.height] });
        } else {
          pdf.addPage([canvas.width, canvas.height]);
        }
        pdf.addImage(imgData, 'JPEG', 0, 0, canvas.width, canvas.height);
      }

      pageEls.forEach((el) => {
        el.style.removeProperty('width');
        el.style.removeProperty('min-height');
      });

      const fileName = (menu?.name || 'carta').replace(/[^\w\-]+/g, '_');
      pdf.save(`${fileName}.pdf`);
    } catch (err) {
      console.error('Export PDF failed', err);
      alert('No se pudo generar el PDF. Intenta nuevamente.');
    } finally {
      setExporting(false);
    }
  };

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
  const catSizeKey = menu.categoryFontSize || 'medium';
  const dishSizeKey = menu.dishFontSize || 'medium';
  const categoryFontSize = CATEGORY_SIZES[catSizeKey];
  const subcategoryFontSize = SUBCATEGORY_SIZES[catSizeKey];
  const dishFontSize = DISH_SIZES[dishSizeKey];

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

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
        className="pdf-page min-h-screen flex flex-col items-center justify-center text-center p-8 relative"
        style={bgStyle}
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

      {/* Categories — each on a new page */}
      {sortedCategories.map(({ category }) => {
        if (!category) return null;
        const sortedDishes = [...(category.dishes || [])].sort((a, b) => a.order - b.order);
        const sortedSubs = [...(category.subcategories || [])].sort((a, b) => a.order - b.order);

        return (
          <div
            key={category._id}
            className="pdf-page print-page-break min-h-screen p-8 md:p-16"
            style={bgStyle}
          >
            {hasBgImage && !exporting && (
              <div className="fixed inset-0 bg-black/20 print:hidden" style={{ zIndex: -1 }} />
            )}

            <div className="max-w-3xl mx-auto">
              {/* Category header */}
              <div className="text-center mb-10">
                {logo && (
                  <img src={logo} alt="logo"
                    className="mx-auto mb-4 h-12 object-contain opacity-70" />
                )}
                <h2
                  className="font-bold mb-2"
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

              {/* Direct dishes */}
              {sortedDishes.length > 0 && (
                <DishList dishes={sortedDishes} font={font} hasBgImage={hasBgImage} textColor={textColor} accentColor={accentColor} dishNameColor={dishNameColor} dishFontSize={dishFontSize} />
              )}

              {/* Subcategories */}
              {sortedSubs.map((sub) => {
                const subDishes = [...(sub.dishes || [])].sort((a, b) => a.order - b.order);
                return (
                  <div key={sub._id} className="mt-8">
                    {/* Subcategory header */}
                    <div className="mb-4">
                      <h3
                        className="font-semibold"
                        style={{ fontFamily: font, color: categoryColor, fontSize: subcategoryFontSize }}
                      >
                        {sub.name}
                      </h3>
                      <div
                        className="w-10 h-px mt-1 mb-2"
                        style={{ backgroundColor: hasBgImage ? 'rgba(255,255,255,0.3)' : accentColor }}
                      />
                      {sub.description && (
                        <p className="text-sm opacity-55 italic"
                          style={{ color: dishNameColor }}>
                          {sub.description}
                        </p>
                      )}
                    </div>

                    {/* Subcategory dishes */}
                    {subDishes.length > 0 && (
                      <DishList dishes={subDishes} font={font} hasBgImage={hasBgImage} textColor={textColor} accentColor={accentColor} dishNameColor={dishNameColor} dishFontSize={dishFontSize} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
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
