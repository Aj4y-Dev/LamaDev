/** Text check only: a positive number. No money arithmetic on the client. */
export const isValidRate = (v: string): boolean =>
  /^\d+(\.\d+)?$/.test(v) && /[1-9]/.test(v);
