import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api';

const PRESETS = {
  white: { bg: '#ffffff', text: '#1c1917', accent: '#92400e' },
  cream: { bg: '#fef9f0', text: '#1c1917', accent: '#92400e' },
  dark: { bg: '#1c1917', text: '#fafaf9', accent: '#d97706' },
  forest: { bg: '#1a2e1a', text: '#f0fdf4', accent: '#86efac' },
  wine: { bg: '#3b0a0a', text: '#fef2f2', accent: '#fca5a5' },
  slate: { bg: '#1e293b', text: '#f8fafc', accent: '#93c5fd' },
};

export default function PrintMenu() {
  const { id } = useParams();
  const [menu, setMenu] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

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

  const sortedCategories = [...categories].sort((a, b) => a.order - b.order);

  return (
    <div style={{ fontFamily: font, ...bgStyle, minHeight: '100vh', color: textColor }}>
      {/* Print button - hidden in print */}
      <div className="no-print fixed top-4 right-4 z-50 flex gap-2">
        <button
          onClick={() => window.print()}
          className="bg-amber-700 hover:bg-amber-800 text-white px-4 py-2 rounded-lg text-sm font-body flex items-center gap-2 shadow-lg transition-colors"
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
        className="min-h-screen flex flex-col items-center justify-center text-center p-8 relative"
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
            style={{ fontFamily: font, color: hasBgImage ? '#fff' : textColor }}
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
      {sortedCategories.map(({ category }, catIdx) => {
        if (!category) return null;
        const sortedDishes = [...(category.dishes || [])].sort((a, b) => a.order - b.order);

        return (
          <div
            key={category._id}
            className="print-page-break min-h-screen p-8 md:p-16"
            style={bgStyle}
          >
            {hasBgImage && (
              <div className="fixed inset-0 bg-black/20 print:hidden" style={{ zIndex: -1 }} />
            )}

            {/* Category header */}
            <div className="max-w-3xl mx-auto">
              <div className="text-center mb-10">
                {logo && (
                  <img src={logo} alt="logo"
                    className="mx-auto mb-4 h-12 object-contain opacity-70" />
                )}
                <h2
                  className="text-4xl font-bold mb-2"
                  style={{ fontFamily: font, color: hasBgImage ? '#fff' : textColor }}
                >
                  {category.name}
                </h2>
                <div
                  className="w-16 h-0.5 mx-auto mb-3"
                  style={{ backgroundColor: hasBgImage ? 'rgba(255,255,255,0.4)' : accentColor }}
                />
                {category.description && (
                  <p className="text-base opacity-60 italic max-w-lg mx-auto"
                    style={{ color: hasBgImage ? '#f5f5f5' : textColor }}>
                    {category.description}
                  </p>
                )}
              </div>

              {/* Dishes */}
              <div className="space-y-0">
                {sortedDishes.map(({ dish }, dishIdx) => {
                  if (!dish || typeof dish !== 'object') return null;
                  const isLast = dishIdx === sortedDishes.length - 1;
                  return (
                    <div
                      key={dish._id}
                      className={`py-4 ${!isLast ? 'border-b' : ''}`}
                      style={{
                        borderBottomColor: hasBgImage
                          ? 'rgba(255,255,255,0.15)'
                          : `${textColor}22`,
                      }}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h3
                            className="text-xl font-semibold"
                            style={{ fontFamily: font, color: hasBgImage ? '#fff' : textColor }}
                          >
                            {dish.name}
                          </h3>
                          {dish.description && (
                            <p
                              className="text-sm mt-1 opacity-60 leading-relaxed"
                              style={{ color: hasBgImage ? '#e5e5e5' : textColor }}
                            >
                              {dish.description}
                            </p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0 ml-4">
                          <p
                            className="text-lg font-bold"
                            style={{ color: hasBgImage ? '#fcd34d' : accentColor }}
                          >
                            ${dish.priceUYU.toLocaleString('es-UY')}
                          </p>
                          {dish.priceUSD != null && (
                            <p className="text-xs opacity-50 mt-0.5"
                              style={{ color: hasBgImage ? '#e5e5e5' : textColor }}>
                              U$S {dish.priceUSD.toFixed(2)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      {/* Print CSS injected inline */}
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          .no-print { display: none !important; }
          .print-page-break { page-break-before: always; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
