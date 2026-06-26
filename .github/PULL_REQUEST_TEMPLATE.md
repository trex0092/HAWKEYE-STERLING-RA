<!--
  Thanks for contributing to Hawkeye Sterling RA.
  Please fill in the sections below. Keep PRs small and focused.
  For security issues, do NOT open a PR — see SECURITY.md.
-->

## Summary

<!-- What does this PR do, and why? -->

Closes #

## Type of change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing behavior)
- [ ] Risk data / baseline change (countries, activities, materials, FATF flags)
- [ ] Documentation / governance docs
- [ ] CI / automation / tooling

## Compliance impact

<!-- Does this change scoring, hard outcomes, escalation logic, the Advisor,
     or any regulated decision path? If so, describe the impact and who needs
     to sign off (e.g. MLRO). Write "None" if not applicable. -->

## Testing

- [ ] `node test/app.test.js` passes
- [ ] `node test/watchdog.test.mjs` passes
- [ ] `node test/reg-watch.test.mjs` passes (if automation touched)
- [ ] `npx eslint .` passes
- [ ] Verified manually in the browser (note page: index / console / advisor)

## Checklist

- [ ] My change is a single, focused logical unit
- [ ] No secrets, tokens, or customer data are included in the diff
- [ ] Updated relevant docs (`README.md`, `docs/governance/…`) if behavior changed
- [ ] Commit messages explain the *why*
