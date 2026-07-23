import { ScraperError } from "./scraper.error.js";

export class SourceNotPermittedError extends ScraperError {
  constructor() {
    super("The configured source is not permitted", "SOURCE_NOT_PERMITTED");
    this.name = "SourceNotPermittedError";
  }
}
