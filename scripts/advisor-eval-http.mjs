/* Classify provider failures for live Advisor behavioural evaluation.
 * An upstream error body is untrusted and may contain account identifiers,
 * prompts or diagnostics. Inspect only in memory, and return SAFE category
 * codes. A failed provider call is NOT a failed behavioural guardrail.
 *
 * Stop this run on quotas, throttling, auth or upstream errors rather than
 * submitting up to 29 further model requests that cannot produce evidence.
 * The required live eval still fails closed and alerts the responsible owner. */
export function classifyAdvisorEvalFailure(status, detail = '') {
  const code = Number.isInteger(status) && status >= 100 && status <= 599 ? status : 0;
  const raw = typeof detail === 'string' ? detail.slice(0, 2048) : '';
  const quota = /specified api usage limits|regain access on|credit balance|quota exceeded|monthly usage limit|spend cap|billing|insufficient credit/i.test(raw);
  let category = 'provider_error';
  if (quota || code === 402) category = 'quota_or_billing';
  else if (code === 401 || code === 403) category = 'access_denied';
  else if (code === 429) category = 'rate_limited';
  else if (code === 400 || code === 422) category = 'invalid_request';
  else if (code >= 500) category = 'provider_unavailable';
  // Do NOT return detail, dynamic messages or arbitrary response fields.
  return { status_code: code, category, stop_run: code >= 400 || quota };
}
