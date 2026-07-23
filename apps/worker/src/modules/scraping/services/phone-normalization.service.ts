import {
  parsePhoneNumberFromString,
  type PhoneNumber,
} from "libphonenumber-js/max";

export type NormalizedPhone = {
  raw: string | null;
  e164: string | null;
  extension: string | null;
  countryCode: string | null;
  nationalFormat: string | null;
  phoneType: "LANDLINE" | "MOBILE" | "VOIP" | "TOLL_FREE" | "UNKNOWN";
  validationStatus:
    | "VALID"
    | "POSSIBLE"
    | "INVALID"
    | "PLACEHOLDER"
    | "UNVERIFIED"
    | "NO_PHONE_FOUND";
};

const normalizeDigits = (value: string): string => value.replace(/\D/g, "");

export const isPlaceholderPhone = (value: string): boolean => {
  const digits = normalizeDigits(value);
  const national = digits.length === 11 && digits.startsWith("1")
    ? digits.slice(1)
    : digits;
  if (/^(\d)\1{6,}$/.test(national)) return true;
  if (/^(?:0+|1234567890|0123456789)$/.test(national)) return true;
  // NANPA reserves 555-0100 through 555-0199 for fictional use.
  return /^\d{3}55501\d{2}$/.test(national);
};

const classifyPhone = (
  phone: PhoneNumber,
): NormalizedPhone["phoneType"] => {
  const type = phone.getType();
  if (type === "TOLL_FREE") return "TOLL_FREE";
  if (type === "MOBILE") return "MOBILE";
  if (type === "FIXED_LINE") return "LANDLINE";
  if (type === "VOIP") return "VOIP";
  return "UNKNOWN";
};

export const normalizePhone = (
  value: string | null | undefined,
  defaultCountry: "US" = "US",
): NormalizedPhone => {
  const raw = value?.trim() || null;
  if (!raw) {
    return {
      raw: null,
      e164: null,
      extension: null,
      countryCode: null,
      nationalFormat: null,
      phoneType: "UNKNOWN",
      validationStatus: "NO_PHONE_FOUND",
    };
  }
  if (isPlaceholderPhone(raw)) {
    return {
      raw,
      e164: null,
      extension: null,
      countryCode: null,
      nationalFormat: null,
      phoneType: "UNKNOWN",
      validationStatus: "PLACEHOLDER",
    };
  }

  const phone = parsePhoneNumberFromString(raw, defaultCountry);
  if (!phone) {
    return {
      raw,
      e164: null,
      extension: null,
      countryCode: null,
      nationalFormat: null,
      phoneType: "UNKNOWN",
      validationStatus: "INVALID",
    };
  }
  const possible = phone.isPossible();
  const valid = phone.isValid();
  return {
    raw,
    e164: valid ? phone.number : null,
    extension: phone.ext ?? null,
    countryCode: phone.countryCallingCode,
    nationalFormat: possible ? phone.formatNational() : null,
    phoneType: valid ? classifyPhone(phone) : "UNKNOWN",
    validationStatus: valid ? "VALID" : possible ? "POSSIBLE" : "INVALID",
  };
};
