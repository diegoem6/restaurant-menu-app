// Shared constants/helpers for editing a carta's look — used by the menu
// settings form (Menus.jsx) and the live design preview (MenuDesigner.jsx).

// Grouped for the font picker's <optgroup>s. `FONTS` (below) is the flat
// list, kept for anything that just needs to validate/iterate every font.
export const FONT_GROUPS = [
  {
    label: 'Clásicas y elegantes',
    fonts: ['Playfair Display', 'Lora', 'Cormorant Garamond', 'Merriweather', 'Cinzel'],
  },
  {
    label: 'Modernas',
    fonts: ['Montserrat', 'Raleway', 'Josefin Sans', 'Oswald', 'Poppins'],
  },
  {
    label: 'Diseño gráfico',
    fonts: ['Bebas Neue', 'Abril Fatface', 'Anton', 'Archivo Black', 'Righteous', 'Bungee'],
  },
  {
    label: 'Manuscritas',
    fonts: ['Great Vibes', 'Dancing Script', 'Lobster', 'Pacifico', 'Caveat', 'Permanent Marker', 'Amatic SC'],
  },
];

export const FONTS = FONT_GROUPS.flatMap((g) => g.fonts);

export const BG_PRESETS = [
  { id: 'white', label: 'Blanco', bg: '#ffffff', text: '#1c1917' },
  { id: 'cream', label: 'Crema', bg: '#fef9f0', text: '#1c1917' },
  { id: 'dark', label: 'Oscuro', bg: '#1c1917', text: '#fafaf9' },
  { id: 'forest', label: 'Bosque', bg: '#1a2e1a', text: '#f0fdf4' },
  { id: 'wine', label: 'Vino', bg: '#3b0a0a', text: '#fef2f2' },
  { id: 'slate', label: 'Pizarra', bg: '#1e293b', text: '#f8fafc' },
];

export function toBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
