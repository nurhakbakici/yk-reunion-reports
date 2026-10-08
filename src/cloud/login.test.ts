import { describe, expect, it } from 'vitest';
import { loginEmail, loginName, nameFromEmail } from './login';

describe('loginName', () => {
  it('folds case, Turkish letters and spaces', () => {
    expect(loginName('  Öykü Çağlar ')).toBe('oyku.caglar');
    expect(loginName('IŞIK')).toBe('isik');
    expect(loginName('İpek')).toBe('ipek');
    expect(loginName('oyku.caglar')).toBe('oyku.caglar');
  });

  it('drops what an address cannot carry, and stray dots', () => {
    expect(loginName('vega+altun@x')).toBe('vegaaltunx');
    expect(loginName('.vega..altun-')).toBe('vega.altun');
  });

  it('refuses names that are too short or too long', () => {
    expect(loginName('ab')).toBeNull();
    expect(loginName('!!!')).toBeNull();
    expect(loginName('a'.repeat(31))).toBeNull();
    expect(loginName('a'.repeat(30))).toBe('a'.repeat(30));
  });
});

describe('sign-in addresses', () => {
  it('round-trip through the mailbox', () => {
    const email = loginEmail('vega.altun', 'kampanya@example.org');
    expect(email).toBe('kampanya+vega.altun@example.org');
    expect(nameFromEmail(email)).toBe('vega.altun');
  });

  it('leave a foreign address as it is', () => {
    expect(nameFromEmail('someone@example.org')).toBe('someone@example.org');
  });
});
