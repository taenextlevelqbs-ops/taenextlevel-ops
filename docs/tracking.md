# Installing missing public-site tracking safely

Source inspection found no GA4, Plausible, Umami or Vercel Analytics tracking in the seven existing public sites. A preexisting provider account/property may still exist and can be connected to the dashboard independently. No tracking was added to public sites during this implementation because actual property/measurement IDs and consent requirements are not available.

Required before installing new tracking:

- Owner-controlled GA4 properties and per-site `G-...` measurement IDs, with correct hostname streams.
- Consent policy and supported consent-management platform for the audiences/regions involved. Start tracking only after the appropriate consent; honor Global Privacy Control where applicable.
- Confirmed public URLs for Royal Brand and Maverick. Do not infer their domains from repository names.
- Public-page-only path allowlists and exclusion of login, admin, patient/health, prescription, payment, password-reset, and authenticated portal pages. Disable automatic collection of URLs/query strings and form data where sensitive data may appear.
- SPA navigation tracking that emits each approved page view once, without duplicate automatic page views. Define event semantics for submitted, accepted, confirmed and completed outcomes. Do not send names, email addresses, phone numbers, medication queries, free text, or provider secrets.
- New tracking does not produce historical visitors. Keep tracking start dates visible in deployment notes.

The Command Center accepts numeric GA4 property IDs and reads real GA4 reporting APIs. Public tracking should be added in small separate changes to the applicable repositories after these values and policies are supplied. The private Command Center does not itself install visitor tracking or expose service-account credentials to websites. Healthcare analytics needs explicit review before deployment.
