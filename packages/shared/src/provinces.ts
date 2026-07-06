// Códigos de provincia de 1 letra que exige PAQ.AR (apiPaqAr-v2.pdf, tabla "Códigos de provincia").
// Ojo: no existen I, O ni Ñ.
export const PROVINCES = [
  { code: 'A', name: 'Salta' },
  { code: 'B', name: 'Buenos Aires' },
  { code: 'C', name: 'CABA' },
  { code: 'D', name: 'San Luis' },
  { code: 'E', name: 'Entre Ríos' },
  { code: 'F', name: 'La Rioja' },
  { code: 'G', name: 'Santiago del Estero' },
  { code: 'H', name: 'Chaco' },
  { code: 'J', name: 'San Juan' },
  { code: 'K', name: 'Catamarca' },
  { code: 'L', name: 'La Pampa' },
  { code: 'M', name: 'Mendoza' },
  { code: 'N', name: 'Misiones' },
  { code: 'P', name: 'Formosa' },
  { code: 'Q', name: 'Neuquén' },
  { code: 'R', name: 'Río Negro' },
  { code: 'S', name: 'Santa Fe' },
  { code: 'T', name: 'Tucumán' },
  { code: 'U', name: 'Chubut' },
  { code: 'V', name: 'Tierra del Fuego' },
  { code: 'W', name: 'Corrientes' },
  { code: 'X', name: 'Córdoba' },
  { code: 'Y', name: 'Jujuy' },
  { code: 'Z', name: 'Santa Cruz' },
] as const;

export const PROVINCE_CODES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'] as const;
export type ProvinceCode = (typeof PROVINCE_CODES)[number];
