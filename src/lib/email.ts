/** Loose email check: something@something.tld, no spaces, at most 120 characters. */
export function isEmail(value: string) {
  return value.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
