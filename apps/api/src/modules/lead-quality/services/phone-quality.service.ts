export type PhoneValidationResult = {
  isValidFormat: boolean;
  isPossible: boolean;
  isPlaceholder: boolean;
  phoneRaw: string | null;
  phoneNormalized: string | null; // E.164 e.g. +12025550143
  nationalFormat: string | null; // (202) 555-0143
  countryCode: string;
  extension: string | null;
  phoneType: "LANDLINE" | "MOBILE" | "VOIP" | "TOLL_FREE" | "UNKNOWN";
  status:
    | "VALID_FORMAT"
    | "POSSIBLE"
    | "INVALID"
    | "PLACEHOLDER"
    | "CONFLICTING"
    | "UNVERIFIED"
    | "NO_PHONE_FOUND";
  isLocallyValidated: boolean;
  activeLineVerified: boolean; // Must be false unless approved verification provider verifies it
  failureReason: string | null;
};

export interface PhoneVerificationProvider {
  providerKey: string;
  validateConfiguration(): Promise<boolean>;
  verifyPhone(input: { phone: string; countryCode?: string }): Promise<{
    status: "VERIFIED" | "VERIFICATION_FAILED" | "INVALID";
    phoneType?: "LANDLINE" | "MOBILE" | "VOIP" | "TOLL_FREE" | "UNKNOWN";
    carrier?: string;
    lineActive?: boolean;
    rawPayload?: Record<string, unknown>;
  }>;
  normalizeResult(result: unknown): PhoneValidationResult;
  healthCheck(): Promise<{ isHealthy: boolean; message: string }>;
}

const TOLL_FREE_AREA_CODES = new Set(["800", "888", "877", "866", "855", "844", "833"]);

const REPEATED_DIGIT_PATTERNS = [
  /^(\d)\1{9}$/, // 0000000000, 1111111111, etc.
  /^1234567890$/,
  /^0987654321$/,
  /^5555555555$/,
];

export class PhoneQualityService {
  /**
   * Validate phone locally using E.164 parsing, pattern checks, toll-free & placeholder detection.
   */
  public validatePhoneLocal(
    rawPhone: string | null | undefined,
    countryCode = "US"
  ): PhoneValidationResult {
    if (!rawPhone || !rawPhone.trim()) {
      return {
        isValidFormat: false,
        isPossible: false,
        isPlaceholder: false,
        phoneRaw: null,
        phoneNormalized: null,
        nationalFormat: null,
        countryCode,
        extension: null,
        phoneType: "UNKNOWN",
        status: "NO_PHONE_FOUND",
        isLocallyValidated: true,
        activeLineVerified: false,
        failureReason: "Phone number is empty or missing",
      };
    }

    const trimmed = rawPhone.trim();

    // Extract extension if present (e.g., x123, ext. 456, ext 789)
    let extension: string | null = null;
    let mainPart = trimmed;
    const extMatch = trimmed.match(/(?:x|ext\.?|extension)\s*(\d+)/i);
    if (extMatch && extMatch[1]) {
      extension = extMatch[1];
      mainPart = trimmed.replace(extMatch[0], "").trim();
    }

    // Extract digits
    const digitsOnly = mainPart.replace(/\D/g, "");

    // Check placeholder / repeated digits
    if (this.isPlaceholderNumber(digitsOnly)) {
      return {
        isValidFormat: false,
        isPossible: false,
        isPlaceholder: true,
        phoneRaw: trimmed,
        phoneNormalized: null,
        nationalFormat: null,
        countryCode,
        extension,
        phoneType: "UNKNOWN",
        status: "PLACEHOLDER",
        isLocallyValidated: true,
        activeLineVerified: false,
        failureReason: "Placeholder or test phone number detected",
      };
    }

    // Standard US / NANP logic (10 digits or 11 digits starting with 1)
    let tenDigits = digitsOnly;
    if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
      tenDigits = digitsOnly.slice(1);
    }

    if (tenDigits.length !== 10) {
      return {
        isValidFormat: false,
        isPossible: digitsOnly.length >= 7 && digitsOnly.length <= 15,
        isPlaceholder: false,
        phoneRaw: trimmed,
        phoneNormalized: null,
        nationalFormat: null,
        countryCode,
        extension,
        phoneType: "UNKNOWN",
        status: digitsOnly.length >= 7 ? "POSSIBLE" : "INVALID",
        isLocallyValidated: true,
        activeLineVerified: false,
        failureReason: "Invalid digit count for phone number",
      };
    }

    const areaCode = tenDigits.slice(0, 3);
    const exchangeCode = tenDigits.slice(3, 6);
    const subscriber = tenDigits.slice(6);

    // NANP area code & exchange code cannot start with 0 or 1
    if (areaCode.startsWith("0") || areaCode.startsWith("1") || exchangeCode.startsWith("0") || exchangeCode.startsWith("1")) {
      return {
        isValidFormat: false,
        isPossible: false,
        isPlaceholder: false,
        phoneRaw: trimmed,
        phoneNormalized: null,
        nationalFormat: null,
        countryCode,
        extension,
        phoneType: "UNKNOWN",
        status: "INVALID",
        isLocallyValidated: true,
        activeLineVerified: false,
        failureReason: "NANP area code or exchange code cannot start with 0 or 1",
      };
    }

    // Check 555-0100 to 555-0199 fictional range or 555 area code placeholder
    if (
      (exchangeCode === "555" && subscriber.startsWith("01")) ||
      (areaCode === "555" && exchangeCode.startsWith("01")) ||
      digitsOnly.includes("55501")
    ) {
      return {
        isValidFormat: false,
        isPossible: false,
        isPlaceholder: true,
        phoneRaw: trimmed,
        phoneNormalized: null,
        nationalFormat: null,
        countryCode,
        extension,
        phoneType: "UNKNOWN",
        status: "PLACEHOLDER",
        isLocallyValidated: true,
        activeLineVerified: false,
        failureReason: "Fictional 555-01xx test range phone number",
      };
    }


    // Determine type
    const phoneType = TOLL_FREE_AREA_CODES.has(areaCode) ? "TOLL_FREE" : "LANDLINE"; // Default local classification

    const phoneNormalized = `+1${tenDigits}`;
    const nationalFormat = `(${areaCode}) ${exchangeCode}-${subscriber}`;

    return {
      isValidFormat: true,
      isPossible: true,
      isPlaceholder: false,
      phoneRaw: trimmed,
      phoneNormalized,
      nationalFormat,
      countryCode,
      extension,
      phoneType,
      status: "VALID_FORMAT",
      isLocallyValidated: true,
      activeLineVerified: false,
      failureReason: null,
    };
  }

  private isPlaceholderNumber(digits: string): boolean {
    if (!digits || digits.length < 7) return true;
    const tenDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

    for (const pattern of REPEATED_DIGIT_PATTERNS) {
      if (pattern.test(tenDigits) || pattern.test(digits)) {
        return true;
      }
    }
    return false;
  }
}

export const phoneQualityService = new PhoneQualityService();
