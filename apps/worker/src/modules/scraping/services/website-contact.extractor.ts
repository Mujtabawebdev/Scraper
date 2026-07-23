import * as cheerio from "cheerio";

type JsonObject = Record<string, unknown>;

export type WebsiteContactExtraction = {
  businessName?: string;
  phones: string[];
  emails: string[];
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  category?: string;
  schemaOrgFound: boolean;
  candidateLinks: URL[];
};

const clean = (value: string | undefined): string | undefined =>
  value?.trim().replace(/\s+/g, " ") || undefined;

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" ? clean(value) : undefined;

const collectObjects = (value: unknown): JsonObject[] => {
  if (Array.isArray(value)) return value.flatMap(collectObjects);
  const object = asObject(value);
  if (!object) return [];
  const graph = object["@graph"];
  return [object, ...(graph ? collectObjects(graph) : [])];
};

const schemaTypes = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [value]).filter(
    (entry): entry is string => typeof entry === "string",
  );

const isBusinessSchema = (object: JsonObject): boolean =>
  schemaTypes(object["@type"]).some((type) =>
    /(?:LocalBusiness|Organization)$/i.test(type),
  );

const unique = (values: Array<string | undefined>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))];

export const extractWebsiteContacts = (
  html: string,
  pageUrl: URL,
): WebsiteContactExtraction => {
  const $ = cheerio.load(html);
  const phones: Array<string | undefined> = [];
  const emails: Array<string | undefined> = [];
  const candidates: URL[] = [];
  let schemaBusiness: JsonObject | undefined;

  $('a[href^="tel:"]').each((_index, element) => {
    const href = $(element).attr("href");
    phones.push(clean(href?.replace(/^tel:/i, "").split("?")[0]));
  });
  $('a[href^="mailto:"]').each((_index, element) => {
    const href = $(element).attr("href");
    emails.push(clean(href?.replace(/^mailto:/i, "").split("?")[0])?.toLowerCase());
  });

  $("script[type='application/ld+json']").each((_index, element) => {
    try {
      const parsed: unknown = JSON.parse($(element).text());
      for (const object of collectObjects(parsed)) {
        if (!schemaBusiness && isBusinessSchema(object)) schemaBusiness = object;
        phones.push(asString(object.telephone));
        emails.push(asString(object.email)?.replace(/^mailto:/i, "").toLowerCase());
      }
    } catch {
      // Invalid JSON-LD is ignored; it is public source input, not an app error.
    }
  });

  const visible = $("body").text().replace(/\s+/g, " ");
  const visiblePhones =
    visible.match(/(?:\+?1[\s.-]?)?\(?[2-9]\d{2}\)?[\s.-]\d{3}[\s.-]\d{4}(?:\s*(?:x|ext\.?)\s*\d{1,8})?/gi) ??
    [];
  phones.push(...visiblePhones.map(clean));
  const visibleEmails =
    visible.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  emails.push(...visibleEmails.map((email) => email.toLowerCase()));

  $("a[href]").each((_index, element) => {
    const href = $(element).attr("href");
    const label = `${$(element).text()} ${href ?? ""}`;
    if (!href || !/(contact|about|location|store)/i.test(label)) return;
    try {
      const url = new URL(href, pageUrl);
      if (url.protocol === "http:" || url.protocol === "https:") {
        url.hash = "";
        candidates.push(url);
      }
    } catch {
      // Bad public links are ignored.
    }
  });

  const address = asObject(schemaBusiness?.address);
  const name =
    asString(schemaBusiness?.name) ??
    clean($('meta[property="og:site_name"]').attr("content")) ??
    clean($("h1").first().text()) ??
    clean($("title").text().replace(/\s*[|–-].*$/, ""));
  const category =
    schemaTypes(schemaBusiness?.["@type"]).find(
      (type) => !/(?:LocalBusiness|Organization)$/i.test(type),
    ) ?? undefined;
  const addressLine1 = asString(address?.streetAddress);
  const city = asString(address?.addressLocality);
  const state = asString(address?.addressRegion);
  const postalCode = asString(address?.postalCode);
  const country = asString(address?.addressCountry);

  return {
    ...(name ? { businessName: name } : {}),
    phones: unique(phones),
    emails: unique(emails),
    ...(addressLine1 ? { addressLine1 } : {}),
    ...(city ? { city } : {}),
    ...(state ? { state } : {}),
    ...(postalCode ? { postalCode } : {}),
    ...(country ? { country } : {}),
    ...(category ? { category } : {}),
    schemaOrgFound: Boolean(schemaBusiness),
    candidateLinks: candidates,
  };
};
