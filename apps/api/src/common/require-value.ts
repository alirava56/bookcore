export function requireValue<T>(value: T): NonNullable<T> {
  if (value === undefined || value === null) throw new Error('EXPECTED_VALUE_MISSING');
  return value;
}
