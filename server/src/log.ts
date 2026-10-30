const stamp = () => new Date().toISOString();
export const log = {
  info: (m: string) => console.log(`${stamp()} INFO  ${m}`),
  warn: (m: string) => console.warn(`${stamp()} WARN  ${m}`),
  error: (m: string) => console.error(`${stamp()} ERROR ${m}`),
};
