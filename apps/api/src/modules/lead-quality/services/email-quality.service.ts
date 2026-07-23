import dns from "dns/promises";

export type EmailValidationResult = {
  isValidSyntax: boolean;
  isDomainValid: boolean;
  isRoleAccount: boolean;
  isDisposable: boolean;
  isPlaceholder: boolean;
  hasMxRecords: boolean | null;
  normalizedEmail: string | null; // e.g. contact@acme.com
  domain: string | null; // e.g. acme.com
  status:
    | "VALID_SYNTAX"
    | "DOMAIN_VALID"
    | "MX_PRESENT"
    | "ROLE_ACCOUNT"
    | "DISPOSABLE"
    | "INVALID"
    | "PLACEHOLDER"
    | "UNVERIFIED"
    | "NO_EMAIL_FOUND";
  failureReason: string | null;
};

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "tempmail.com",
  "10minutemail.com",
  "throwawaymail.com",
  "guerrillamail.com",
  "sharklasers.com",
  "yopmail.com",
  "dispostable.com",
  "trashmail.com",
  "getnada.com",
]);

const ROLE_PREFIXES = new Set([
  "info",
  "sales",
  "support",
  "contact",
  "office",
  "admin",
  "administrator",
  "billing",
  "help",
  "inquiries",
  "jobs",
  "careers",
  "service",
]);

const PLACEHOLDER_DOMAINS = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "domain.com",
  "email.com",
  "sample.com",
  "invalid.com",
]);

export class EmailQualityService {
  /**
   * Safe email validation with syntax, domain format, disposable check, role-account tag.
   */
  public validateEmail(email: string | null | undefined): EmailValidationResult {
    if (!email || !email.trim()) {
      return {
        isValidSyntax: false,
        isDomainValid: false,
        isRoleAccount: false,
        isDisposable: false,
        isPlaceholder: false,
        hasMxRecords: null,
        normalizedEmail: null,
        domain: null,
        status: "NO_EMAIL_FOUND",
        failureReason: "Email address is missing",
      };
    }

    const trimmed = email.trim().toLowerCase();

    // RFC 5322 regex syntax check
    const emailRegex =
      /^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|"(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21\x23-\x5b\x5d-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])*")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\[(?:(?:(2(5[0-5]| [0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9]))\.){3}(?:(2(5[0-5]|[0-4][0-9])|1[0-9][0-9]|[1-9]?[0-9])|[a-z0-9-]*[a-z0-9]:(?:[\x01-\x08\x0b\x0c\x0e-\x1f\x21-\x5a\x53-\x7f]|\\[\x01-\x09\x0b\x0c\x0e-\x7f])+)\])$/i;

    if (!emailRegex.test(trimmed)) {
      return {
        isValidSyntax: false,
        isDomainValid: false,
        isRoleAccount: false,
        isDisposable: false,
        isPlaceholder: false,
        hasMxRecords: null,
        normalizedEmail: null,
        domain: null,
        status: "INVALID",
        failureReason: "Invalid email syntax",
      };
    }

    const parts = trimmed.split("@");
    if (parts.length !== 2) {
      return {
        isValidSyntax: false,
        isDomainValid: false,
        isRoleAccount: false,
        isDisposable: false,
        isPlaceholder: false,
        hasMxRecords: null,
        normalizedEmail: null,
        domain: null,
        status: "INVALID",
        failureReason: "Email must contain exactly one @ symbol",
      };
    }

    const localPart: string = parts[0] ?? "";
    const domainPart: string = parts[1] ?? "";

    if (DISPOSABLE_DOMAINS.has(domainPart)) {
      return {
        isValidSyntax: true,
        isDomainValid: true,
        isRoleAccount: false,
        isDisposable: true,
        isPlaceholder: false,
        hasMxRecords: null,
        normalizedEmail: trimmed,
        domain: domainPart,
        status: "DISPOSABLE",
        failureReason: "Disposable email address domain detected",
      };
    }

    if (PLACEHOLDER_DOMAINS.has(domainPart) || localPart === "placeholder" || localPart === "sample") {
      return {
        isValidSyntax: true,
        isDomainValid: false,
        isRoleAccount: false,
        isDisposable: false,
        isPlaceholder: true,
        hasMxRecords: null,
        normalizedEmail: trimmed,
        domain: domainPart,
        status: "PLACEHOLDER",
        failureReason: "Placeholder email domain or user detected",
      };
    }


    const isRoleAccount = ROLE_PREFIXES.has(localPart);

    const status = isRoleAccount ? "ROLE_ACCOUNT" : "DOMAIN_VALID";

    return {
      isValidSyntax: true,
      isDomainValid: true,
      isRoleAccount,
      isDisposable: false,
      isPlaceholder: false,
      hasMxRecords: null,
      normalizedEmail: trimmed,
      domain: domainPart,
      status,
      failureReason: null,
    };
  }

  /**
   * Optional DNS MX record verification with safe 1.5s timeout.
   */
  public async checkMxRecord(domain: string): Promise<boolean> {
    try {
      const resolver = new dns.Resolver();
      resolver.setServers(["8.8.8.8", "1.1.1.1"]);
      const mxPromise = resolver.resolveMx(domain);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("DNS MX lookup timeout")), 1500)
      );

      const mxRecords = await Promise.race([mxPromise, timeoutPromise]);
      return Array.isArray(mxRecords) && mxRecords.length > 0;
    } catch {
      return false;
    }
  }

  /**
   * Verify if email domain matches website domain or sub-domain.
   */
  public doesEmailDomainMatchWebsite(emailDomain: string | null, websiteDomain: string | null): boolean {
    if (!emailDomain || !websiteDomain) return false;
    const cleanEmailDom = emailDomain.toLowerCase().replace(/^www\./, "");
    const cleanWebDom = websiteDomain.toLowerCase().replace(/^www\./, "");
    return cleanEmailDom === cleanWebDom || cleanEmailDom.endsWith(`.${cleanWebDom}`) || cleanWebDom.endsWith(`.${cleanEmailDom}`);
  }
}

export const emailQualityService = new EmailQualityService();
