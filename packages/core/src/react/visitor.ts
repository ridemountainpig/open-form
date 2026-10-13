/** Sent as `x-open-form-visitor` / `visitor` so once-per-device works where cookies don't (third-party iframes). */
export const VISITOR_HEADER = 'x-open-form-visitor';

const KEY = 'open-form:visitor';

/** A random id this browser keeps for Open Form forms; undefined when storage is blocked. */
export function visitorId(): string | undefined {
  try {
    let id = localStorage.getItem(KEY);
    if (!id || !/^[\w-]{16,64}$/.test(id)) {
      id = crypto.randomUUID();
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return undefined;
  }
}

export function visitorHeaders(): Record<string, string> {
  const id = visitorId();
  return id ? { [VISITOR_HEADER]: id } : {};
}
