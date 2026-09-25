/** Formatage monétaire unique : jamais de `toLocaleString` dispersé dans l'UI. */
export const euro = (n: number): string =>
  `${Math.round(n).toLocaleString('fr-FR').replace(/ | /g, ' ')} €`;

export const signed = (n: number): string => `${n > 0 ? '+' : n < 0 ? '−' : ''}${euro(Math.abs(n))}`;
