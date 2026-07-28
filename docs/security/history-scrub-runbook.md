# History scrub runbook — removing pre-redaction data from git history

**Owner:** Repo owner (the rewrite and the force-push are owner-only acts)
**Review cadence:** annually until executed; the execution itself is open-actions item 1.

PR #213 redacted the screening-subject records from `main` and PR #217
completed the rebrand — but **git history still serves the pre-redaction
blobs** (any commit before 2026-07-11 can be checked out, and the old file
versions are one `git show` away). This runbook removes them from the public
history with `git filter-repo` and a force-push.

It is deliberately written so that **no removed string appears in this
document** — the scrub list is generated *from* the old history at execution
time, never written down (this file is public and the brand-guard CI test
bans the old token anyway).

**Owner-only.** A history rewrite changes every commit SHA. Budget ~30
minutes. Read the whole runbook before starting.

## Decide first — Option A: make the repository private

One click, zero breakage, and it removes *all* public exposure — including
the one thing a rewrite cannot fix (next section):
*Settings → General → Danger Zone → Change repository visibility*.
Netlify keeps deploying (it authenticates via the linked app, not public
access). Trade-offs: OpenSSF Scorecard stops publishing for private repos
(the badge freezes at its last value) and the public transparency story ends.
If Option A is acceptable, stop here — the rewrite below becomes optional
hygiene rather than a necessity.

## What a rewrite cannot fix

- **The subject-data state branches re-expose current data by design.**
  `screen-state` and `screen-delta-state` are force-rebuilt on every scheduled
  run from the live screening of the customer base, so the day after a scrub
  they would again carry current subject data in plaintext, UNLESS the
  `STATE_ENCRYPTION_KEY` repository secret is set: with it, those two branches
  commit only encrypted state (`scripts/state-crypto.mjs`, merged 2026-07-16)
  and the plaintext re-exposure stops going forward. The other three state
  branches (`sanctions-watch-state`, `reg-watch-state`, `fatf-state`) were
  inspected on 2026-07-16 and carry list-fingerprint metadata, public
  regulator page snapshots and country lists only, no subject or personal
  data, so they need no handling beyond the rewrite itself. A rewrite erases
  the *past*; the *present* is closed by setting the secret (Option A remains
  the strongest single fix).
- **Old Netlify deploy permalinks.** Pre-redaction deploys remain reachable
  at their `https://<deploy-id>--hawkeye-sterling-ra.netlify.app` URLs.
  Delete old deploys in the Netlify UI where offered (or via support). The
  URLs are unguessably random, so residual risk is low but not zero.
- **GitHub's object cache.** After a force-push, the old commits remain
  fetchable by SHA until GitHub garbage-collects. Ask GitHub Support to purge
  them — their guide is
  <https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository>.
  Old PR pages keep their rendered diffs either way; those were checked
  during the redaction work and contain no subject names.
- **The MLRO sign-off name** in `docs/governance/` is deliberately kept
  (ratification evidence, not screening PII). Scrubbing history for it while
  `HEAD` contains it would achieve nothing — if it should ever go, remove it
  from the current files first, then add it to the replacements list here.

## Prerequisites

- A machine with `git` ≥ 2.36 and [`git-filter-repo`](https://github.com/newren/git-filter-repo)
  (`pip install git-filter-repo`, or `apt/brew install git-filter-repo`).
- Repo admin access (branch protection must be lifted for one push).
- No open PRs (all current work is merged), and a quiet window: the
  scheduled automations run between ~05:00 and ~14:00 UTC — any time after
  ~15:00 UTC is clear. A state-branch commit landing mid-procedure is
  harmless (the next run recreates it) but avoiding the overlap is tidier.

## 1. Back up, then work on a copy

```bash
git clone --mirror https://github.com/trex0092/HAWKEYE-STERLING-RA.git backup.git
cp -r backup.git scrub.git        # rewrite scrub.git; keep backup.git untouched
cd scrub.git
```

## 2. Build the replacements file (local only — never commit it)

The subject identities are extracted from the history itself — three
mechanical sources, all anchored on the redaction commit (`f22f7ab`, PR
#213), whose *parent* still holds the data:

```bash
old=f22f7ab

{ # (a) subjects of the pre-redaction sanctions screening state
  git show $old^:data/sanctions-screen-state.json | jq -r '.subjects | keys[]'
  # (b) subject-name signatures embedded in the pre-redaction delta-state keys
  #     (key format: SANC|<entity sig>|<type>|<subject sig>|… / AM|<sig>|… / PEP|<sig>|…)
  git show $old^:data/screen-delta-state.json | jq -r 'keys[]' \
    | awk -F'|' '{print $2; if ($1=="SANC" && $4!="") print $4}'
  # (c) name strings the redaction commit removed from fixtures/config
  git diff $old^ $old -- test/screening-cases.test.mjs test/weekly-summary.test.mjs .gitleaks.toml screen.py \
    | grep '^-' | grep -oE '[A-Z][A-Za-z.-]+( [A-Z][A-Za-z.-]+)+'
} | tr 'A-Z' 'a-z' | sed 's/[^a-z0-9# ]/ /g; s/  */ /g; s/^ *//; s/ *$//' \
  | sort -u | grep -v '^$' > ../names.txt

wc -l ../names.txt        # expect 23 (verified 2026-07-11)
```

**Review `../names.txt` now** — it must contain person/entity identities
only; delete any line that clearly is not one. (Verified at authoring time:
all 23 are identities; every innocuous capitalized phrase in the old
fixtures still exists in `HEAD` and is correctly absent from this list.)

Turn each identity into a case- and punctuation-insensitive replacement, and
add the former firm name (purged in PR #217) — the `printf` hex escapes
exist so this runbook never contains the token itself, only the produced
local file does:

```bash
sed 's/ /[^A-Za-z0-9]+/g; s/^/regex:(?i)/; s/$/==>[REDACTED]/' ../names.txt > ../replacements.txt
printf 'regex:(?i)f\x69ne[ _.-]*g\x6fld==>Hawkeye Sterling\n' >> ../replacements.txt
wc -l ../replacements.txt   # expect 24
```

Both files stay outside any repository. Note: sanctions-*list* entry text in
old blobs (OFAC/UN/EU designations) is public list data, not customer PII —
it is deliberately not scrubbed.

## 3. Rewrite

```bash
git filter-repo --replace-text ../replacements.txt
```

This rewrites file contents *and* commit messages across all branches and
tags. Optional extra — also rename the historical initialism-named design
assets (`fg-*` → `hs-*`, matching what PR #217 did at `HEAD`):

```bash
git filter-repo --filename-callback 'return filename.replace(b"/fg-", b"/hs-")'
```

`filter-repo` removes the `origin` remote as a safety measure; re-add it:

```bash
git remote add origin https://github.com/trex0092/HAWKEYE-STERLING-RA.git
```

## 4. Lift protection, push, restore

1. *Settings → Branches* → edit the `main` protection rule: allow force
   pushes (or delete the rule) — temporarily.
2. Push everything (branches **and** tags, in one atomic mirror push):

   ```bash
   git push --force --mirror origin
   ```

   Notes: `--mirror` also rewrites the state branches (their pre-redaction
   history goes too) and the `v3.7.1` / `v3.7.2` tags — GitHub Releases stay
   attached by tag *name*, and the uploaded assets + Sigstore attestations
   are untouched. Any remote ref created after step 1's clone is deleted by
   the mirror push; for state branches that is self-healing (next scheduled
   run rebuilds them).
3. Restore the protection rule. `.github/settings.yml` declares the intended
   configuration and the settings app re-applies it on the next push to
   `main` — but verify in the UI rather than assuming.

## 5. Verify, then destroy the local lists

```bash
# every iteration must print nothing (same tolerant regex as the scrub):
while IFS= read -r n; do
  git log --all -i --pickaxe-regex \
    -S"$(printf '%s' "$n" | sed 's/ /[^A-Za-z0-9]+/g')" --oneline | head -1
done < ../names.txt

# the former firm name (regex via the same escape trick) — must print nothing:
git log --all -i --pickaxe-regex -S"$(printf 'f\x69ne[ _.-]*g\x6fld')" --oneline | head -1

shred -u ../replacements.txt ../names.txt 2>/dev/null || rm -f ../replacements.txt ../names.txt
```

## 6. Aftermath checklist

- [ ] Every existing clone is stale — **re-clone fresh everywhere**; never
      `git pull` an old clone over the rewritten remote (it would merge the
      old history straight back).
- [ ] GitHub Support asked to purge cached/dangling objects (link above).
- [ ] Old Netlify deploys deleted (or accepted as residual risk).
- [ ] Next scheduled runs green (state branches rebuilt; *Freshness Check*
      vouches for the fleet the following morning).
- [ ] CI on `main` green after one manual dispatch (content at `HEAD` is
      unchanged, so this is a formality).
- [ ] Scorecard unaffected (the rewrite is content-neutral at `HEAD`).
