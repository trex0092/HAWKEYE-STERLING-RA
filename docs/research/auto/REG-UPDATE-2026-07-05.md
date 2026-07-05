# Regulatory update proposal — 2026-07-05

> AI-drafted from monitored-source changes for **human review**. Nothing here is applied automatically. Verify against the primary source before editing `assets/super-data.js` or `index.html`.

### Responsible Minerals Initiative (RMI)

- **What appears to have changed**: The extracted content shows only an HTTP error response ("415 unsupported media type" from openresty), not actual page content. No substantive news or article text is visible. This appears to be a fetch/technical error rather than a genuine content change on the source.

- **Likely app impact**: None warranted at this time. Because no readable content was retrieved, there is no basis to update Regulatory Q&A topics on responsible sourcing/conflict minerals, Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`. Recommend re-fetching the source (verify request headers/content-type) and re-reviewing once valid page text is captured.

- **Suggested citation**: None at this time. If a re-fetch surfaces a genuine update, cite the specific RMI publication by its visible title (e.g., "Responsible Minerals Initiative — News/Announcement, [title], [date]"). Do not cite based on the current error response.

### LBMA — Responsible Sourcing

- **What appears to have changed**: The extracted content shows only an HTTP error ("415 Unsupported Media Type", nginx), not substantive page text. This indicates a fetch/technical failure rather than a confirmed content change. No actual change to the Responsible Sourcing guidance can be verified from this extract.

- **Likely app impact**: None confirmed at this time. Do **not** update Regulatory Q&A topics or Super Tools citations in `assets/super-data.js`, or country/risk data in `index.html`, based on this extract alone. Any references to LBMA Responsible Sourcing / Responsible Gold (and Silver) Guidance remain unverified until a clean fetch is obtained.

- **Suggested citation**: No update warranted from this extract. If a re-fetch succeeds and a genuine change is found, cite generically as **"LBMA — Responsible Sourcing Programme"** (and, if visible, the specific "Responsible Gold Guidance" version/edition shown on the page). Do not cite version or year numbers not visible in the source.

**Reviewer action**: Re-crawl the URL (possible content-negotiation/`Accept`-header issue causing the 415) and re-extract before considering any edit.
