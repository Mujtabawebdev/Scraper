import {
  parsePhoneNumberFromString,
  type PhoneNumber,
} from "libphonenumber-js/max";

export type LocalPhoneValidation = {
  normalizedPhone: string | null;
  phoneExtension: string | null;
  phoneCountryCode: string | null;
  phoneNationalFormat: string | null;
  phoneType: "LANDLINE" | "MOBILE" | "VOIP" | "TOLL_FREE" | "UNKNOWN";
  phoneValidationStatus:
    | "VALID"
    | "POSSIBLE"
    | "INVALID"
    | "PLACEHOLDER"
    | "NO_PHONE_FOUND";
};

const isPlaceholder = (value: string): boolean => {
  const digits = value.replace(/\D/g, "");
  const national =
    digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  return (
    /^(\d)\1{6,}$/.test(national) ||
    /^(?:0+|1234567890|0123456789)$/.test(national) ||
    /^\d{3}55501\d{2}$/.test(national)
  );
};

const phoneType = (phone: PhoneNumber): LocalPhoneValidation["phoneType"] => {
  const type = phone.getType();
  if (type === "TOLL_FREE") return "TOLL_FREE";
  if (type === "MOBILE") return "MOBILE";
  if (type === "FIXED_LINE") return "LANDLINE";
  if (type === "VOIP") return "VOIP";
  return "UNKNOWN";
};

export const validateLeadPhone = (
  value: string | null,
): LocalPhoneValidation => {
  if (!value?.trim()) {
    return {
      normalizedPhone: null,
      phoneExtension: null,
      phoneCountryCode: null,
      phoneNationalFormat: null,
      phoneType: "UNKNOWN",
      phoneValidationStatus: "NO_PHONE_FOUND",
    };
  }
  if (isPlaceholder(value)) {
    return {
      normalizedPhone: null,
      phoneExtension: null,
      phoneCountryCode: null,
      phoneNationalFormat: null,
      phoneType: "UNKNOWN",
      phoneValidationStatus: "PLACEHOLDER",
    };
  }
  const parsed = parsePhoneNumberFromString(value, "US");
  if (!parsed) {
    return {
      normalizedPhone: null,
      phoneExtension: null,
      phoneCountryCode: null,
      phoneNationalFormat: null,
      phoneType: "UNKNOWN",
      phoneValidationStatus: "INVALID",
    };
  }
  const possible = parsed.isPossible();
  const valid = parsed.isValid();
  return {
    normalizedPhone: valid ? parsed.number : null,
    phoneExtension: parsed.ext ?? null,
    phoneCountryCode: parsed.countryCallingCode,
    phoneNationalFormat: possible ? parsed.formatNational() : null,
    phoneType: valid ? phoneType(parsed) : "UNKNOWN",
    phoneValidationStatus: valid ? "VALID" : possible ? "POSSIBLE" : "INVALID",
  };
};
