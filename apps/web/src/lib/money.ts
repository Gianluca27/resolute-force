export const money = (n: number): string => '$' + Math.round(n).toLocaleString('es-AR');
