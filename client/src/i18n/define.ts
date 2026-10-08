/**
 * One translation module per feature. German is the source; Czech must have
 * exactly the same keys (enforced by the type and by i18n.test.ts).
 */
export function defineMessages<const D extends Record<string, string>>(de: D, cs: { [K in keyof D]: string }) {
  return { de, cs };
}
