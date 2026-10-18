// Calling codes by ISO 3166-1 alpha-2 region, for Tel's country picker.
const DIAL_CODES = {
  AC: '247',
  AD: '376',
  AE: '971',
  AF: '93',
  AG: '1',
  AI: '1',
  AL: '355',
  AM: '374',
  AO: '244',
  AR: '54',
  AS: '1',
  AT: '43',
  AU: '61',
  AW: '297',
  AX: '358',
  AZ: '994',
  BA: '387',
  BB: '1',
  BD: '880',
  BE: '32',
  BF: '226',
  BG: '359',
  BH: '973',
  BI: '257',
  BJ: '229',
  BL: '590',
  BM: '1',
  BN: '673',
  BO: '591',
  BQ: '599',
  BR: '55',
  BS: '1',
  BT: '975',
  BW: '267',
  BY: '375',
  BZ: '501',
  CA: '1',
  CC: '61',
  CD: '243',
  CF: '236',
  CG: '242',
  CH: '41',
  CI: '225',
  CK: '682',
  CL: '56',
  CM: '237',
  CN: '86',
  CO: '57',
  CR: '506',
  CU: '53',
  CV: '238',
  CW: '599',
  CX: '61',
  CY: '357',
  CZ: '420',
  DE: '49',
  DJ: '253',
  DK: '45',
  DM: '1',
  DO: '1',
  DZ: '213',
  EC: '593',
  EE: '372',
  EG: '20',
  EH: '212',
  ER: '291',
  ES: '34',
  ET: '251',
  FI: '358',
  FJ: '679',
  FK: '500',
  FM: '691',
  FO: '298',
  FR: '33',
  GA: '241',
  GB: '44',
  GD: '1',
  GE: '995',
  GF: '594',
  GG: '44',
  GH: '233',
  GI: '350',
  GL: '299',
  GM: '220',
  GN: '224',
  GP: '590',
  GQ: '240',
  GR: '30',
  GT: '502',
  GU: '1',
  GW: '245',
  GY: '592',
  HK: '852',
  HN: '504',
  HR: '385',
  HT: '509',
  HU: '36',
  ID: '62',
  IE: '353',
  IL: '972',
  IM: '44',
  IN: '91',
  IO: '246',
  IQ: '964',
  IR: '98',
  IS: '354',
  IT: '39',
  JE: '44',
  JM: '1',
  JO: '962',
  JP: '81',
  KE: '254',
  KG: '996',
  KH: '855',
  KI: '686',
  KM: '269',
  KN: '1',
  KP: '850',
  KR: '82',
  KW: '965',
  KY: '1',
  KZ: '7',
  LA: '856',
  LB: '961',
  LC: '1',
  LI: '423',
  LK: '94',
  LR: '231',
  LS: '266',
  LT: '370',
  LU: '352',
  LV: '371',
  LY: '218',
  MA: '212',
  MC: '377',
  MD: '373',
  ME: '382',
  MF: '590',
  MG: '261',
  MH: '692',
  MK: '389',
  ML: '223',
  MM: '95',
  MN: '976',
  MO: '853',
  MP: '1',
  MQ: '596',
  MR: '222',
  MS: '1',
  MT: '356',
  MU: '230',
  MV: '960',
  MW: '265',
  MX: '52',
  MY: '60',
  MZ: '258',
  NA: '264',
  NC: '687',
  NE: '227',
  NF: '672',
  NG: '234',
  NI: '505',
  NL: '31',
  NO: '47',
  NP: '977',
  NR: '674',
  NU: '683',
  NZ: '64',
  OM: '968',
  PA: '507',
  PE: '51',
  PF: '689',
  PG: '675',
  PH: '63',
  PK: '92',
  PL: '48',
  PM: '508',
  PR: '1',
  PS: '970',
  PT: '351',
  PW: '680',
  PY: '595',
  QA: '974',
  RE: '262',
  RO: '40',
  RS: '381',
  RU: '7',
  RW: '250',
  SA: '966',
  SB: '677',
  SC: '248',
  SD: '249',
  SE: '46',
  SG: '65',
  SH: '290',
  SI: '386',
  SJ: '47',
  SK: '421',
  SL: '232',
  SM: '378',
  SN: '221',
  SO: '252',
  SR: '597',
  SS: '211',
  ST: '239',
  SV: '503',
  SX: '1',
  SY: '963',
  SZ: '268',
  TA: '290',
  TC: '1',
  TD: '235',
  TG: '228',
  TH: '66',
  TJ: '992',
  TK: '690',
  TL: '670',
  TM: '993',
  TN: '216',
  TO: '676',
  TR: '90',
  TT: '1',
  TV: '688',
  TW: '886',
  TZ: '255',
  UA: '380',
  UG: '256',
  US: '1',
  UY: '598',
  UZ: '998',
  VA: '39',
  VC: '1',
  VE: '58',
  VG: '1',
  VI: '1',
  VN: '84',
  VU: '678',
  WF: '681',
  WS: '685',
  XK: '383',
  YE: '967',
  YT: '262',
  ZA: '27',
  ZM: '260',
  ZW: '263',
} as const;

/** An ISO 3166-1 alpha-2 region with a calling code, e.g. `'TW'`. */
export type PhoneCountry = keyof typeof DIAL_CODES;

export const PHONE_COUNTRIES = Object.keys(DIAL_CODES) as PhoneCountry[];

// Where regions share a code, a bare `+1…` or `+44…` reads as the main one.
const MAIN_REGIONS = ['US', 'RU', 'GB', 'NO', 'AU', 'RE', 'SH', 'FI', 'GP', 'CW', 'MA', 'IT'];

const REGIONS_BY_CODE = new Map<string, string[]>();
for (const region of [...MAIN_REGIONS, ...PHONE_COUNTRIES]) {
  const code = DIAL_CODES[region as PhoneCountry];
  const list = REGIONS_BY_CODE.get(code) ?? [];
  if (!list.includes(region)) list.push(region);
  REGIONS_BY_CODE.set(code, list);
}

// What people dial before a number at home, dropped after the country code:
// 0912… in Taiwan is +886 912…. Where a leading 0 is part of the number itself
// (Italy's landlines) nothing is dropped; length-guarded prefixes only apply to
// a full national number, since 8 or 1 can also start one.
const DEFAULT_TRUNK = /^0/;
const TRUNKS: Record<string, RegExp | null> = {
  BY: /^8?0/,
  CG: null,
  CI: null,
  GA: null,
  HU: /^06/,
  IT: null,
  KZ: /^8(?=\d{10}$)/,
  LT: /^[08](?=\d{8}$)/,
  RU: /^8(?=\d{10}$)/,
  SM: null,
  VA: null,
};
const NANP_TRUNK = /^1(?=\d{10}$)/;

// Japanese input methods type ー and − for dashes.
const SEPARATORS = /[\s\-().\u2010-\u2015\u2212\u30fc]/g;
// E.164: a country code and number, 15 digits at most. The shortest real
// numbers (Saint Helena, Niue) have 7.
const E164_RE = /^\+[1-9]\d{6,14}$/;

export function isPhoneCountry(value: unknown): value is PhoneCountry {
  return typeof value === 'string' && Object.hasOwn(DIAL_CODES, value);
}

export function dialCode(country: string): string | undefined {
  return isPhoneCountry(country) ? DIAL_CODES[country] : undefined;
}

/** Full-width digits folded and spaces, dashes, dots and brackets removed. */
export function cleanPhone(value: string): string {
  return value.normalize('NFKC').replace(SEPARATORS, '');
}

function trunkFor(country: string, code: string): RegExp | null {
  if (code === '1') return NANP_TRUNK;
  return country in TRUNKS ? (TRUNKS[country] ?? null) : DEFAULT_TRUNK;
}

// 00 is the international prefix across most of the world (`00886…` = `+886…`); a
// national number never starts with it where 0 is the trunk prefix.
const INTERNATIONAL_PREFIX = /^00(?=[1-9])/;

/** Input that brings its own country code: `+44 20…` or `0044 20…`. */
export function hasCountryCode(input: string): boolean {
  const cleaned = cleanPhone(input.trim());
  return cleaned.startsWith('+') || INTERNATIONAL_PREFIX.test(cleaned);
}

/**
 * `'TW'` and `'0912-345-678'` → `'+886912345678'`. Input starting with `+` or
 * the international prefix `00` keeps its own code.
 */
export function composePhone(country: string, input: string): string {
  const cleaned = cleanPhone(input.trim()).replace(INTERNATIONAL_PREFIX, '+');
  if (cleaned === '' || cleaned.startsWith('+')) return cleaned;
  const code = dialCode(country);
  if (!code) return cleaned;
  const trunk = trunkFor(country, code);
  return `+${code}${trunk ? cleaned.replace(trunk, '') : cleaned}`;
}

/**
 * `'+886912345678'` → `{ country: 'TW', national: '912345678' }`. Shared codes
 * resolve to `preferred` when it fits; anything unrecognized stays whole.
 */
export function splitPhone(
  value: string,
  preferred: string,
  allowed?: readonly string[],
): { country: string; national: string } {
  if (value.startsWith('+')) {
    const digits = value.slice(1);
    for (let length = 3; length >= 1; length--) {
      const regions = (REGIONS_BY_CODE.get(digits.slice(0, length)) ?? []).filter(
        (region) => !allowed || allowed.includes(region),
      );
      const country = regions.includes(preferred) ? preferred : regions[0];
      if (country) return { country, national: digits.slice(length) };
    }
  }
  return { country: preferred, national: value };
}

export function isInternationalPhone(value: string): boolean {
  return E164_RE.test(value);
}

/** Whether the number's country code belongs to one of `countries`. */
export function phoneInCountries(value: string, countries: readonly string[]): boolean {
  return countries.some((country) => {
    const code = dialCode(country);
    return code !== undefined && value.startsWith(`+${code}`);
  });
}
