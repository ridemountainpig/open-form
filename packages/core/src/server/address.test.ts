import { describe, expect, it } from 'vitest';
import { rateLimitSubject } from './address.ts';

describe('rateLimitSubject', () => {
  it('counts IPv4 addresses one by one, however they are written', () => {
    expect(rateLimitSubject('203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitSubject('203.0.113.7:51234')).toBe('203.0.113.7');
    expect(rateLimitSubject('::ffff:203.0.113.7')).toBe('203.0.113.7');
    expect(rateLimitSubject('::FFFF:cb00:7107')).toBe('203.0.113.7');
    expect(rateLimitSubject('203.0.113.8')).not.toBe(rateLimitSubject('203.0.113.7'));
  });

  it('counts an IPv6 address as its /64', () => {
    const subject = rateLimitSubject('2001:db8:aa:bb::1');
    expect(subject).toBe('2001:db8:aa:bb::/64');
    expect(rateLimitSubject('2001:0DB8:00aa:00bb:dead:beef:1:2')).toBe(subject);
    expect(rateLimitSubject('[2001:db8:aa:bb:ffff::9]:443')).toBe(subject);
    expect(rateLimitSubject('2001:db8:aa:bb::1%eth0')).toBe(subject);
    expect(rateLimitSubject('2001:db8:aa:bc::1')).not.toBe(subject);
    expect(rateLimitSubject('::1')).toBe('0:0:0:0::/64');
  });

  it('leaves anything else as it is', () => {
    expect(rateLimitSubject('unknown')).toBe('unknown');
    expect(rateLimitSubject('1:2:3')).toBe('1:2:3');
    expect(rateLimitSubject('1::2::3')).toBe('1::2::3');
  });
});
