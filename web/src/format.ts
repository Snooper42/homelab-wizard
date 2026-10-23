// Formatting shared by the screens.

/** A yearly sum in whole dollars: "$3,292". */
export const dollars = (v: number): string => '$' + Math.round(v).toLocaleString('en-US');
