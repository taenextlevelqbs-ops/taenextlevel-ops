import { jsonRequest, ProviderError } from "./http.mjs";
export async function verifyPaymentAccount(
  site,
  env = process.env,
  fetcher = fetch,
) {
  const key = env[`${site.envPrefix}_STRIPE_READ_KEY`];
  if (!key) throw new ProviderError("Connect a Stripe restricted read key");
  if (["coach-tae", "dmv-attack"].includes(site.id)) {
    const otherPrefix = site.id === "coach-tae" ? "DMV_ATTACK" : "COACH_TAE";
    if (env[`${otherPrefix}_STRIPE_READ_KEY`] === key)
      throw new ProviderError(
        "Businesses must use separate Stripe credentials",
      );
    const expected = env[`${site.envPrefix}_STRIPE_ACCOUNT_ID`],
      otherId = env[`${otherPrefix}_STRIPE_ACCOUNT_ID`];
    if (!expected)
      throw new ProviderError(
        "Confirm this business’s STRIPE_ACCOUNT_ID before displaying payments",
      );
    if (expected === otherId)
      throw new ProviderError("Businesses must use separate Stripe accounts");
    const account = await jsonRequest(
      "https://api.stripe.com/v1/account",
      {
        headers: {
          Authorization: `Bearer ${key}`,
          "Stripe-Version": "2026-09-30.endive",
        },
      },
      fetcher,
    );
    if (account.id !== expected)
      throw new ProviderError(
        "Stripe account identity does not match this business",
      );
    return account.id;
  }
  return null;
}
