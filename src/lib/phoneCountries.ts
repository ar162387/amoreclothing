import { getCountries, getCountryCallingCode, type CountryCode } from 'libphonenumber-js';

/**
 * Countries pinned to the top of the checkout phone dropdown — Pakistan (home market) plus the
 * other regions the client specifically called out (UK, USA, Australia, the Middle East).
 * Everything else in libphonenumber-js's country list follows below, alphabetically.
 */
const PRIORITY_COUNTRIES: CountryCode[] = [
  'PK', // Pakistan
  'GB', // United Kingdom
  'US', // United States
  'AU', // Australia
  'AE', // United Arab Emirates
  'SA', // Saudi Arabia
  'QA', // Qatar
  'KW', // Kuwait
  'BH', // Bahrain
  'OM', // Oman
  'JO', // Jordan
];

export const DEFAULT_PHONE_COUNTRY: CountryCode = 'PK';

export interface PhoneCountryOption {
  code: CountryCode;
  name: string;
  dial: string; // e.g. "+92"
  flag: string;
}

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

let cachedOptions: PhoneCountryOption[] | null = null;

/** All ISO countries libphonenumber-js knows about, pinned-priority-first then alphabetical. */
export function getPhoneCountryOptions(): PhoneCountryOption[] {
  if (cachedOptions) return cachedOptions;

  const displayNames =
    typeof Intl !== 'undefined' && 'DisplayNames' in Intl
      ? new Intl.DisplayNames(['en'], { type: 'region' })
      : null;

  const all: PhoneCountryOption[] = getCountries().map((code) => ({
    code,
    name: displayNames?.of(code) ?? code,
    dial: `+${getCountryCallingCode(code)}`,
    flag: flagEmoji(code),
  }));

  const byCode = new Map(all.map((c) => [c.code, c]));
  const priority = PRIORITY_COUNTRIES.map((code) => byCode.get(code)).filter(
    (c): c is PhoneCountryOption => Boolean(c)
  );
  const prioritySet = new Set(PRIORITY_COUNTRIES);
  const rest = all
    .filter((c) => !prioritySet.has(c.code))
    .sort((a, b) => a.name.localeCompare(b.name));

  cachedOptions = [...priority, ...rest];
  return cachedOptions;
}
