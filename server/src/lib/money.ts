/**
 * All money is stored and computed as INTEGER minor units (e.g. paisa/cents).
 * These helpers keep arithmetic integer-only — never floats in business logic.
 */
export function toMinor(majorAmount: number): number {
  return Math.round(majorAmount * 100);
}

export function toMajor(minor: number): number {
  return minor / 100;
}

/** Sum a list of minor amounts safely. */
export function sumMinor(values: number[]): number {
  return values.reduce((acc, v) => acc + Math.trunc(v), 0);
}
