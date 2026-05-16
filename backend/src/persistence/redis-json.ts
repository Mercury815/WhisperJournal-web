export function serialize<T>(obj: T): string {
  return JSON.stringify(obj, (_, v) => (v instanceof Date ? v.toISOString() : v));
}

export function deserialize<T>(json: string): T {
  return JSON.parse(json, (_, v) => {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return d;
      }
    }
    return v;
  }) as T;
}
