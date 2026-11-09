/**
 * Numbers and dates use the Kazakhstan convention (15 000 ₸, 06.11.2026) in both interface languages (#156):
 * browsers' kk-KZ formats give 15,000 and 2026-11-06, which people here do not write.
 */
const loc = () => 'ru-RU';

export const dateTime = (iso: string) =>
  new Date(iso).toLocaleString(loc(), { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const date = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-');
  return `${d}.${m}.${y}`;
};
export const money = (n: number) => `${n.toLocaleString(loc())} ₸`;
/** Russian plural form for n: [1, 2–4, 5+] (#100). */
export const plural = (n: number, forms: readonly [string, string, string]) => {
  const d = Math.abs(n) % 100;
  if (d >= 11 && d <= 14) return forms[2];
  if (d % 10 === 1) return forms[0];
  if (d % 10 >= 2 && d % 10 <= 4) return forms[1];
  return forms[2];
};
