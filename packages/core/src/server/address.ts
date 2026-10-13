function ipv6Groups(text: string): number[] | null {
  let rest = text;
  const v4 = /^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(rest);
  if (v4) {
    const [a = 0, b = 0, c = 0, d = 0] = v4.slice(2).map(Number);
    if ([a, b, c, d].some((byte) => byte > 255)) return null;
    rest = `${v4[1]}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const halves = rest.split('::');
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(':') : [];
  const tail = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 2 ? missing < 1 : missing !== 0) return null;
  const parts = [...head, ...Array<string>(Math.max(missing, 0)).fill('0'), ...tail];
  if (!parts.every((part) => /^[\da-f]{1,4}$/.test(part))) return null;
  return parts.map((part) => Number.parseInt(part, 16));
}

/**
 * Who a rate limit counts. IPv4 addresses (also IPv4-mapped IPv6) count one by
 * one; an IPv6 address counts as its /64, because one home or server usually
 * holds a whole /64 and can hop between its addresses at will.
 */
export function rateLimitSubject(address: string): string {
  let text = address.trim().toLowerCase();
  const bracketed = /^\[([^\]]+)\](?::\d+)?$/.exec(text);
  if (bracketed) text = bracketed[1] as string;
  else if (/^[\d.]+:\d+$/.test(text)) text = text.slice(0, text.lastIndexOf(':'));
  text = text.replace(/%.*$/, '');
  if (!text.includes(':')) return text;
  const groups = ipv6Groups(text);
  if (!groups) return text;
  if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
    const [high = 0, low = 0] = groups.slice(6);
    return [high >> 8, high & 255, low >> 8, low & 255].join('.');
  }
  return `${groups
    .slice(0, 4)
    .map((group) => group.toString(16))
    .join(':')}::/64`;
}
