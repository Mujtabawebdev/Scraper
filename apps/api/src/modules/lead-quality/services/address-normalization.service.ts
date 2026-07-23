export type NormalizedAddressResult = {
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  state: string | null; // 2-letter USPS abbreviation
  postalCode: string | null;
  country: string;
  normalizedComparisonString: string;
  isComplete: boolean;
};

const US_STATES: Record<string, string> = {
  ALABAMA: "AL",
  ALASKA: "AK",
  ARIZONA: "AZ",
  ARKANSAS: "AR",
  CALIFORNIA: "CA",
  COLORADO: "CO",
  CONNECTICUT: "CT",
  DELAWARE: "DE",
  FLORIDA: "FL",
  GEORGIA: "GA",
  HAWAII: "HI",
  IDAHO: "ID",
  ILLINOIS: "IL",
  INDIANA: "IN",
  IOWA: "IA",
  KANSAS: "KS",
  KENTUCKY: "KY",
  LOUISIANA: "LA",
  MAINE: "ME",
  MARYLAND: "MD",
  MASSACHUSETTS: "MA",
  MICHIGAN: "MI",
  MINNESOTA: "MN",
  MISSISSIPPI: "MS",
  MISSOURI: "MO",
  MONTANA: "MT",
  NEBRASKA: "NE",
  NEVADA: "NV",
  NEW_HAMPSHIRE: "NH",
  NEW_JERSEY: "NJ",
  NEW_MEXICO: "NM",
  NEW_YORK: "NY",
  NORTH_CAROLINA: "NC",
  NORTH_DAKOTA: "ND",
  OHIO: "OH",
  OKLAHOMA: "OK",
  OREGON: "OR",
  PENNSYLVANIA: "PA",
  RHODE_ISLAND: "RI",
  SOUTH_CAROLINA: "SC",
  SOUTH_DAKOTA: "SD",
  TENNESSEE: "TN",
  TEXAS: "TX",
  UTAH: "UT",
  VERMONT: "VT",
  VIRGINIA: "VA",
  WASHINGTON: "WA",
  WEST_VIRGINIA: "WV",
  WISCONSIN: "WI",
  WYOMING: "WY",
  DISTRICT_OF_COLUMBIA: "DC",
};

export class AddressNormalizationService {
  /**
   * Deterministically normalize USA business address for comparison and display.
   */
  public normalizeAddress(input: {
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
    country?: string | null;
  }): NormalizedAddressResult {
    const cleanLine1 = input.addressLine1 ? this.collapseWhitespace(input.addressLine1) : null;
    const cleanLine2 = input.addressLine2 ? this.collapseWhitespace(input.addressLine2) : null;
    const cleanCity = input.city ? this.collapseWhitespace(input.city) : null;
    const cleanState = input.state ? this.normalizeState(input.state) : null;
    const cleanPostal = input.postalCode ? this.normalizePostalCode(input.postalCode) : null;

    let country = "United States";
    if (input.country && input.country.trim()) {
      const c = input.country.trim().toUpperCase();
      if (c === "US" || c === "USA" || c === "U.S.A." || c === "UNITED STATES") {
        country = "United States";
      } else {
        country = this.collapseWhitespace(input.country);
      }
    }

    const parts: string[] = [];
    if (cleanLine1) parts.push(cleanLine1.toLowerCase());
    if (cleanLine2) parts.push(cleanLine2.toLowerCase());
    if (cleanCity) parts.push(cleanCity.toLowerCase());
    if (cleanState) parts.push(cleanState.toLowerCase());
    if (cleanPostal) parts.push(cleanPostal.slice(0, 5));

    const normalizedComparisonString = parts.join(", ");
    const isComplete = Boolean(cleanLine1 && cleanCity && cleanState);

    return {
      addressLine1: cleanLine1,
      addressLine2: cleanLine2,
      city: cleanCity,
      state: cleanState,
      postalCode: cleanPostal,
      country,
      normalizedComparisonString,
      isComplete,
    };
  }

  private collapseWhitespace(str: string): string {
    return str.replace(/\s+/g, " ").trim();
  }

  public normalizeState(stateInput: string): string | null {
    if (!stateInput || !stateInput.trim()) return null;
    const clean = this.collapseWhitespace(stateInput).toUpperCase();
    if (clean.length === 2 && Object.values(US_STATES).includes(clean)) {
      return clean;
    }
    const key = clean.replace(/[^A-Z]/g, "_");
    if (US_STATES[key]) {
      return US_STATES[key];
    }
    return clean.length <= 50 ? clean : clean.slice(0, 50);
  }

  private normalizePostalCode(postalInput: string): string | null {
    if (!postalInput || !postalInput.trim()) return null;
    const digitsOnly = postalInput.replace(/\D/g, "");
    if (digitsOnly.length === 5) return digitsOnly;
    if (digitsOnly.length === 9) return `${digitsOnly.slice(0, 5)}-${digitsOnly.slice(5)}`;
    return postalInput.trim().slice(0, 20);
  }
}

export const addressNormalizationService = new AddressNormalizationService();
