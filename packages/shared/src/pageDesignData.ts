import type { PageDesignDoc } from './pageDesign';

// Runtime data with NO zod dependency: the public landing imports this module
// (fallback doc + font list) and must not pull the schema machinery into its
// bundle. Keep this file free of value imports from './pageDesign'.

// Curated Google Fonts list. `gf` is the css2 family query param; weights are
// pinned so the editor can't request faces that don't exist.
export const FONT_OPTIONS = [
  { id: 'saira-condensed', label: 'Saira Condensed', family: '"Saira Condensed"', gf: 'Saira+Condensed:wght@500;600;700;800;900' },
  { id: 'barlow', label: 'Barlow', family: '"Barlow"', gf: 'Barlow:wght@400;500;600;700' },
  { id: 'oswald', label: 'Oswald', family: '"Oswald"', gf: 'Oswald:wght@400;500;600;700' },
  { id: 'bebas-neue', label: 'Bebas Neue', family: '"Bebas Neue"', gf: 'Bebas+Neue' },
  { id: 'archivo', label: 'Archivo', family: '"Archivo"', gf: 'Archivo:wght@400;500;600;700;800;900' },
  { id: 'anton', label: 'Anton', family: '"Anton"', gf: 'Anton' },
  { id: 'montserrat', label: 'Montserrat', family: '"Montserrat"', gf: 'Montserrat:wght@400;500;600;700;800;900' },
  { id: 'inter', label: 'Inter', family: '"Inter"', gf: 'Inter:wght@400;500;600;700' },
  { id: 'space-grotesk', label: 'Space Grotesk', family: '"Space Grotesk"', gf: 'Space+Grotesk:wght@400;500;600;700' },
  { id: 'roboto-condensed', label: 'Roboto Condensed', family: '"Roboto Condensed"', gf: 'Roboto+Condensed:wght@400;500;600;700' },
  { id: 'poppins', label: 'Poppins', family: '"Poppins"', gf: 'Poppins:wght@400;500;600;700;800' },
] as const;
export type FontId = (typeof FONT_OPTIONS)[number]['id'];

// ---------------------------------------------------------------------------
// Default document — replicates today's page exactly. Used by the API seed
// (with hero/marquee overridden from any existing SiteContent row) and as the
// web fallback when the API is unreachable.
// ---------------------------------------------------------------------------
export const DEFAULT_PAGE_DESIGN: PageDesignDoc = {
  version: 1,
  theme: {
    colors: {
      bg: '#0a0a0b', panel: '#0e0e10', card: '#161619',
      text: '#f4f4f3', muted: '#97979d',
      accent: '#e4322b', accentDark: '#bb211c', secondary: '#e8b53e',
    },
    fonts: { display: 'saira-condensed', body: 'barlow' },
    shapes: { radius: 4, buttonStyle: 'square' },
  },
  sections: [
    {
      id: 'marquee', type: 'marquee', visible: true,
      props: { items: ['Envíos a todo el país', 'Champion Mentality', '3 cuotas sin interés', 'Stop at Nothing', 'Calidad premium', 'The Resolute Standard'] },
    },
    {
      id: 'hero', type: 'hero', visible: true,
      props: {
        kicker: 'Est. 2024 · Indumentaria de alto rendimiento',
        title1: 'Champion', title2: 'Mentality',
        subtitle: 'No vendemos remeras. Forjamos una mentalidad. Indumentaria deportiva para los que entrenan bajo presión y no se detienen ante nada.',
        subtitleHighlight: 'Esta es la norma Resolute.',
        ctaPrimary: 'Ver colección', ctaSecondary: 'El manifiesto',
        badges: ['Envíos a todo el país', '3 cuotas sin interés', 'Algodón premium'],
      },
    },
    {
      id: 'manifiesto', type: 'manifiesto', visible: true,
      props: {
        kicker: 'El Manifiesto',
        title: 'La presión no te quiebra.', titleAccent: 'Te forja.',
        body: 'Cada prenda lleva un recordatorio en la espalda: lo que te define no es el talento, es la mentalidad. Disciplina cuando nadie mira. Constancia cuando todo cuesta.',
        bodyHighlight: 'Ser campeón se decide mucho antes de competir.',
        imageUrl: '/assets/teaser-burst.png',
        imageBadge: 'Champions think under pressure',
        principles: [
          { title: 'Champions think under pressure', sub: 'La mente decide antes que el cuerpo.' },
          { title: 'Discipline is the key', sub: 'La constancia construye lo que la motivación promete.' },
          { title: 'Stop at Nothing', sub: 'No hay plan B para los que van por todo.' },
        ],
      },
    },
    {
      id: 'productos', type: 'products', visible: true,
      props: {
        kicker: 'Nuestros productos',
        title: 'La colección', titleAccent: "Resolute '26",
        description: 'Remeras de algodón premium con estampas de la línea Champion Mentality y Stop at Nothing. Disponibles en todos los talles.',
      },
    },
    {
      id: 'historia', type: 'historia', visible: true,
      props: {
        kicker: 'Sobre la marca',
        title: 'Nacida en el gimnasio,\nforjada en la disciplina',
        body: 'Resolute Force nació en 2024 entre pesas, madrugadas y la convicción de que la ropa con la que entrenás debería recordarte quién querés ser. Empezamos imprimiendo unas pocas remeras para amigos del gym. Hoy somos una comunidad de atletas que comparten una misma norma:',
        bodyHighlight: 'no rendirse nunca.',
        imageUrl: '/assets/lifestyle-gym.png',
        imageTitle: 'The Resolute Standard',
        imageSubtitle: 'Donde la presión se convierte en carácter.',
        stats: [
          { value: '2024', label: 'Año de fundación' },
          { value: '+5.000', label: 'Atletas en el ejército' },
          { value: '100%', label: 'Algodón premium' },
        ],
      },
    },
    { id: 'proximos', type: 'countdown', visible: true, props: {} },
    {
      id: 'contacto', type: 'contacto', visible: true,
      props: {
        kicker: 'Sumate al ejército',
        title: 'Hablemos',
        subtitle: '¿Dudas con un talle, un envío o querés tu remera? Escribinos, te respondemos rápido.',
      },
    },
  ],
};
