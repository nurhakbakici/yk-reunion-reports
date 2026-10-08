// User names, and the email addresses the login service is given in their place.

const TURKISH: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };

export const MIN_NAME = 3;
export const MAX_NAME = 30;
/** The login service's own minimum. */
export const MIN_PASSWORD = 6;

/**
 * The form of a user name that identifies the account: lower case, Turkish
 * letters folded to plain ones, spaces as dots. "Öykü Çağlar" and
 * "oyku.caglar" are the same person. Null when too little is left to be a name.
 */
export function loginName(typed: string): string | null {
  const name = typed
    .trim()
    .toLocaleLowerCase('tr')
    .replace(/[çğıöşü]/g, (c) => TURKISH[c])
    .replace(/\s+/g, '.')
    .replace(/[^a-z0-9._-]/g, '')
    .replace(/\.{2,}/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '');
  return name.length >= MIN_NAME && name.length <= MAX_NAME ? name : null;
}

/** name → mailbox+name@domain */
export function loginEmail(name: string, mailbox: string): string {
  const at = mailbox.lastIndexOf('@');
  return `${mailbox.slice(0, at)}+${name}${mailbox.slice(at)}`;
}

/** The user name back out of a sign-in address; the whole address if it is not one of ours. */
export function nameFromEmail(email: string): string {
  const match = /\+([^@+]+)@[^@]+$/.exec(email);
  return match ? match[1] : email;
}
