import type { BillingProviderAdapter } from "./billing-provider.interface.js";
import { ManualBillingProvider } from "./manual.provider.js";
import { NoopBillingProvider } from "./noop.provider.js";
import { StripeBillingProvider } from "./stripe.provider.js";
import { env } from "../../../config/env.js";

let stripeProviderInstance: StripeBillingProvider | null = null;
let manualProviderInstance: ManualBillingProvider | null = null;
let noopProviderInstance: NoopBillingProvider | null = null;

export const getBillingProviderAdapter = (
  provider?: "STRIPE" | "MANUAL" | "NONE",
): BillingProviderAdapter => {
  const selected = provider ?? env.BILLING_PROVIDER;

  switch (selected) {
    case "STRIPE":
      if (!stripeProviderInstance) {
        stripeProviderInstance = new StripeBillingProvider();
      }
      return stripeProviderInstance;
    case "MANUAL":
      if (!manualProviderInstance) {
        manualProviderInstance = new ManualBillingProvider();
      }
      return manualProviderInstance;
    case "NONE":
    default:
      if (!noopProviderInstance) {
        noopProviderInstance = new NoopBillingProvider();
      }
      return noopProviderInstance;
  }
};
