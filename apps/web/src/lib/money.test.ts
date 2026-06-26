import { money } from './money';
it('formats integer ARS with es-AR thousands separators', () => {
  expect(money(30000)).toBe('$30.000');
  expect(money(27000)).toBe('$27.000');
  expect(money(0)).toBe('$0');
});
