import { ScraperError } from "./scraper.error.js";

export class RobotsDisallowedError extends ScraperError {
  constructor() {
    super("The requested path is disallowed by source policy", "ROBOTS_DISALLOWED");
    this.name = "RobotsDisallowedError";
  }
}
