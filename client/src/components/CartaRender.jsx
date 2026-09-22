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

// Derives the font family for each part of a page. `titleFont` (menu.font)
// is the carta-wide default — categories and dishes fall back to it unless
// their own font was set (same override pattern as the *FontColor fields).
export function deriveMenuFonts(menu) {
  const titleFont = menu.font || 'Playfair Display';
  return {
    titleFont,
    categoryFont: menu.categoryFont || titleFont,
    dishFont: menu.dishFont || titleFont,
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

// Stable identity for a unit (dish or subcategory header), used as the key
// into a category's per-unit custom box layout.
export function unitKey(unit) {
  if (unit.type === 'subheader') return `sub:${unit.sub._id}`;
  const dishId = unit.entry.dish?._id || unit.entry.dish;
  return `dish:${dishId}`;
}

const DEFAULT_DISH_BOX_WIDTH = 500;
const DEFAULT_DISH_BOX_HEIGHT = 70;
const DISH_BOX_GAP = 12;

// Resolves every unit's box for the "custom per-dish layout" mode: units
// with a saved box keep it, units with none (e.g. a dish added after the
// category was customized) get stacked below the lowest saved box so
// nothing is left invisible. Returned in the same order as `units`.
export function resolveDishBoxes(units, savedBoxes = []) {
  const savedByKey = new Map(savedBoxes.map((b) => [b.key, b]));
  let fallbackY = savedBoxes.reduce((max, b) => Math.max(max, (b.y || 0) + (b.height || 0)), 0);
  return units.map((unit) => {
    const key = unitKey(unit);
    const saved = savedByKey.get(key);
    if (saved) return { key, x: saved.x, y: saved.y, width: saved.width, height: saved.height };
    const box = { key, x: 0, y: fallbackY, width: DEFAULT_DISH_BOX_WIDTH, height: DEFAULT_DISH_BOX_HEIGHT };
    fallbackY += DEFAULT_DISH_BOX_HEIGHT + DISH_BOX_GAP;
    return box;
  });
}

export function DishRow({ dish, isLast, font, hasBgImage, textColor, dishNameColor, dishFontSize, dishNameBold, dishSpacing, innerRef }) {
  const prices = dish.prices || [];
  const multiPrice = prices.length > 1;
  const secondaryFontSize = dishFontSize * 0.65;
  const priceWeightClass = dishNameBold ? 'font-bold' : 'font-normal';
  return (
    <div
      ref={innerRef}
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
              style={{ fontFamily: font, color: dishNameColor, fontSize: dishFontSize }}>
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
          style={{ fontFamily: font, color: dishNameColor }}>
          {sub.description}
        </p>
      )}
    </>
  );
}

// Renders one free element's content only (no positioning) — the caller
// decides how to place it: absolutely-positioned for the read-only PDF/print
// view, or wrapped with drag/resize handles in the interactive designer.
export function FreeElementView({ el, defaultFont }) {
  if (el.type === 'image') {
    if (!el.src) {
      return (
        <div className="w-full h-full flex items-center justify-center text-2xl bg-stone-100/60 border border-dashed border-stone-300 rounded">
          📷
        </div>
      );
    }
    return (
      <img src={el.src} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: el.opacity ?? 1, display: 'block' }} />
    );
  }
  return (
    <div style={{
      width: '100%', height: '100%',
      fontFamily: defaultFont, fontSize: el.fontSize, color: el.color,
      fontWeight: el.bold ? 700 : 400, textAlign: el.align || 'left',
      overflow: 'hidden', whiteSpace: 'pre-wrap', opacity: el.opacity ?? 1,
    }}>
      {el.text}
    </div>
  );
}

function FreeElementsLayer({ elements, defaultFont }) {
  if (!elements || elements.length === 0) return null;
  return (
    <>
      {elements.map((el) => (
        <div key={el._id} style={{
          position: 'absolute', left: el.x, top: el.y, width: el.width, height: el.height,
          zIndex: 20 + (el.zIndex || 0),
        }}>
          <FreeElementView el={el} defaultFont={defaultFont} />
        </div>
      ))}
    </>
  );
}

export function CoverPage({ menu, theme, freeElements = [] }) {
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
      <FreeElementsLayer elements={freeElements} defaultFont={font} />
    </div>
  );
}

export function CategoryPage({
  category, units,
  // titleFont is the carta-wide default, used only for the free-floating
  // decorations on this page — the title/category and dish text use their
  // own (possibly overridden) fonts instead, see deriveMenuFonts.
  titleFont, categoryFont, dishFont,
  hasBgImage, customImageUrl, textColor, accentColor, dishNameColor, categoryColor,
  categoryFontSize, subcategoryFontSize, dishFontSize,
  categoryTitleBold, subcategoryTitleBold, dishNameBold, dishSpacing,
  bgStyle, pagePaddingTop, pagePaddingBottom, pagePaddingLeft, pagePaddingRight, logo, exporting,
  freeElements = [],
  // Custom position/size for the title block and for each individual dish
  // (or subcategory header) unit. Both are set together to switch out of
  // the classic (automatically flowing, centered) layout — see
  // MenuDesigner's "Personalizar diseño" for how these get materialized
  // from the classic layout's live measured positions.
  titleBox, dishBoxes, titleRef,
  // Only used in the designer, in classic (non-boxed) mode, to measure each
  // unit's live position/size when switching into custom layout.
  registerUnitRef,
}) {
  // If a page starts mid-subcategory (the header landed on a previous page),
  // repeat that subcategory's title at the top so the dishes keep context.
  const repeatedSub = units.length > 0 && units[0].type === 'dish' && units[0].sub
    ? units[0].sub
    : null;
  const isBoxed = !!titleBox;
  const resolvedDishBoxes = isBoxed ? resolveDishBoxes(units, dishBoxes) : [];

  const titleContent = (
    <>
      {logo && (
        <img src={logo} alt="logo"
          className="mx-auto mb-4 h-12 object-contain opacity-70" />
      )}
      <h2
        className={`mb-2 ${categoryTitleBold ? 'font-bold' : 'font-normal'}`}
        style={{ fontFamily: categoryFont, color: categoryColor, fontSize: categoryFontSize }}
      >
        {category.name}
      </h2>
      <div
        className="w-16 h-0.5 mx-auto mb-3"
        style={{ backgroundColor: hasBgImage ? 'rgba(255,255,255,0.4)' : accentColor }}
      />
      {category.description && (
        <p className="text-base opacity-60 italic max-w-lg mx-auto"
          style={{ fontFamily: categoryFont, color: dishNameColor }}>
          {category.description}
        </p>
      )}
    </>
  );

  const dishListContent = (
    <>
      {repeatedSub && (
        <div className="mb-4">
          <SubHeaderBlock sub={repeatedSub} font={categoryFont} categoryColor={categoryColor}
            hasBgImage={hasBgImage} accentColor={accentColor}
            subcategoryFontSize={subcategoryFontSize} subcategoryTitleBold={subcategoryTitleBold}
            dishNameColor={dishNameColor}
            showDescription={false} />
        </div>
      )}
      {units.map((unit, idx) => {
        const key = unitKey(unit);
        const setRef = registerUnitRef ? (node) => registerUnitRef(key, node) : undefined;
        if (unit.type === 'subheader') {
          return (
            <div key={`sub-${unit.sub._id}`} ref={setRef} className="pdf-unit mt-8">
              <SubHeaderBlock sub={unit.sub} font={categoryFont} categoryColor={categoryColor}
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
            font={dishFont} hasBgImage={hasBgImage} textColor={textColor}
            dishNameColor={dishNameColor} dishFontSize={dishFontSize} dishNameBold={dishNameBold}
            dishSpacing={dishSpacing} innerRef={setRef} />
        );
      })}
    </>
  );

  // Each dish/subheader gets its own absolutely-positioned box — this is
  // what makes "arrastrar cada plato" possible in the designer: every unit
  // is independently draggable instead of moving as part of one flowing list.
  const boxedDishContent = resolvedDishBoxes.map((box, idx) => {
    const unit = units[idx];
    const boxStyle = { position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height };
    if (unit.type === 'subheader') {
      return (
        <div key={box.key} style={boxStyle}>
          <SubHeaderBlock sub={unit.sub} font={categoryFont} categoryColor={categoryColor}
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
      <div key={box.key} style={boxStyle}>
        <DishRow dish={dish} isLast
          font={dishFont} hasBgImage={hasBgImage} textColor={textColor}
          dishNameColor={dishNameColor} dishFontSize={dishFontSize} dishNameBold={dishNameBold}
          dishSpacing={dishSpacing} />
      </div>
    );
  });

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

      {isBoxed ? (
        <>
          <div
            className="pdf-category-header text-center"
            style={{ position: 'absolute', left: titleBox.x, top: titleBox.y, width: titleBox.width, height: titleBox.height }}
          >
            {titleContent}
          </div>
          {boxedDishContent}
        </>
      ) : (
        <div className="max-w-3xl mx-auto relative z-10">
          <div ref={titleRef} className="pdf-category-header text-center mb-10">
            {titleContent}
          </div>
          <div>
            {dishListContent}
          </div>
        </div>
      )}

      <FreeElementsLayer elements={freeElements} defaultFont={titleFont} />
    </div>
  );
}
