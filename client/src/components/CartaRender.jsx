// Shared rendering pieces for a carta's visual pages — used by both the PDF
// export/print view (PrintMenu.jsx) and the live design preview
// (MenuDesigner.jsx), so both always look identical.

export const PRESETS = {
  white: { bg: '#ffffff', text: '#1c1917', accent: '#92400e' },
  cream: { bg: '#fef9f0', text: '#1c1917', accent: '#92400e' },
  dark: { bg: '#1c1917', text: '#fafaf9', accent: '#d97706' },
  forest: { bg: '#1a2e1a', text: '#f0fdf4', accent: '#86efac' },
  wine: { bg: '#3b0a0a', text: '#fef2f2', accent: '#fca5a5' },
  slate: { bg: '#1e293b', text: '#f8fafc', accent: '#93c5fd' },
};

// Base vertical/horizontal padding of a page; the menu's configured margins
// are added on top of this.
export const PAGE_BASE_PADDING = 32;

const SUBCATEGORY_SIZE_RATIO = 2 / 3;
const DEFAULT_CATEGORY_FONT_SIZE = 36;
const DEFAULT_DISH_FONT_SIZE = 20;
const DEFAULT_DISH_SPACING = 16;

// Derives every color/background/spacing value a page needs from a menu.
export function deriveMenuTheme(menu) {
  const backgroundTemplate = menu.backgroundTemplate;
  const presetKey = backgroundTemplate?.preset || 'cream';
  const theme = PRESETS[presetKey] || PRESETS.cream;
  const hasBgImage = backgroundTemplate?.type === 'custom' && !!backgroundTemplate.customImage;
  const customImageUrl = hasBgImage ? backgroundTemplate.customImage : null;
  // Custom backgrounds are rendered as an <img> layer rather than a CSS
  // background-image: Safari/WebKit can throw "SecurityError: The operation
  // is insecure" from html2canvas's toDataURL() when it has to draw a
  // data-URI CSS background internally — <img> elements go through
  // html2canvas's normal (more reliable) image pipeline instead.
  const bgStyle = hasBgImage ? {} : { backgroundColor: theme.bg };
  const textColor = hasBgImage ? '#1c1917' : theme.text;
  const accentColor = hasBgImage ? '#92400e' : theme.accent;
  const titleColor = menu.titleFontColor || (hasBgImage ? '#fff' : textColor);
  const categoryColor = menu.categoryFontColor || (hasBgImage ? '#fff' : textColor);
  const dishNameColor = menu.dishFontColor || (hasBgImage ? '#fff' : textColor);

  return {
    hasBgImage, customImageUrl, bgStyle, textColor, accentColor, titleColor, categoryColor, dishNameColor,
    pagePaddingTop: PAGE_BASE_PADDING + (menu.pdfTopMargin || 0),
    pagePaddingBottom: PAGE_BASE_PADDING + (menu.pdfBottomMargin || 0),
    pagePaddingLeft: PAGE_BASE_PADDING + (menu.pdfLeftMargin || 0),
    pagePaddingRight: PAGE_BASE_PADDING + (menu.pdfRightMargin || 0),
    dishSpacing: menu.dishSpacing ?? DEFAULT_DISH_SPACING,
  };
}

// Each category controls its own title/dish text size (in px) and bold.
export function fontSizesFor(category) {
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
}

// Flattens a category's direct dishes and subcategory dishes into one
// ordered list of "units" — the granularity at which a PDF page can break.
// Order matches the DOM order CategoryPage renders them in.
export function buildCategoryUnits(category) {
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

export function DishRow({ dish, isLast, font, hasBgImage, textColor, dishNameColor, dishFontSize, dishNameBold, dishSpacing }) {
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

export function SubHeaderBlock({ sub, font, categoryColor, hasBgImage, accentColor, subcategoryFontSize, subcategoryTitleBold, dishNameColor, showDescription }) {
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

export function CoverPage({ menu, theme }) {
  const { logo, font, name } = menu;
  const {
    hasBgImage, customImageUrl, bgStyle, textColor, accentColor, titleColor,
    pagePaddingTop, pagePaddingBottom, pagePaddingLeft, pagePaddingRight,
  } = theme;

  return (
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
      {customImageUrl && (
        <img src={customImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0 }} />
      )}
      {hasBgImage && (
        <div className="absolute inset-0 bg-black/30" style={{ zIndex: 1 }} />
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
  );
}

export function CategoryPage({
  category, units,
  font, hasBgImage, customImageUrl, textColor, accentColor, dishNameColor, categoryColor,
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
      className="pdf-page pdf-category-page print-page-break min-h-screen relative"
      style={{
        ...bgStyle,
        paddingTop: pagePaddingTop,
        paddingBottom: pagePaddingBottom,
        paddingLeft: pagePaddingLeft,
        paddingRight: pagePaddingRight,
      }}
      data-category-id={category._id}
    >
      {customImageUrl && (
        <img src={customImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" style={{ zIndex: 0 }} />
      )}
      {hasBgImage && !exporting && (
        <div className="fixed inset-0 bg-black/20 print:hidden" style={{ zIndex: -1 }} />
      )}

      <div className="max-w-3xl mx-auto relative z-10">
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
