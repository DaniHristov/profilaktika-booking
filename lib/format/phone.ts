import { parsePhoneNumberFromString } from "libphonenumber-js/min";

/**
 * Display/export format for stored E.164 numbers:
 * BG mobiles "0888 123 456", other BG numbers in national form
 * ("02 987 6543"), foreign numbers in international form ("+44 20 7946 0958").
 * Unparseable values are returned unchanged.
 */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const phone = parsePhoneNumberFromString(e164);
  if (!phone) return e164;
  if (phone.country !== "BG") return phone.formatInternational();

  const national = String(phone.nationalNumber);
  if (/^[89]\d{8}$/.test(national)) {
    return `0${national.slice(0, 3)} ${national.slice(3, 6)} ${national.slice(6)}`;
  }
  return phone.formatNational();
}
