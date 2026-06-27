# Fraud typologies → MITRE F3 (Fight Fraud Framework) mapping

This crosswalk maps the AML/CFT **typologies and red flags already embedded in
the Advisor brain** ([`netlify/functions/brain-soul.js`](../netlify/functions/brain-soul.js))
to the **MITRE Fight Fraud Framework (F3) v1.1** tactics. It connects this tool's
financial-crime model to the fraud-side decision workflows in the
[Anthropic Cybersecurity Skills](cybersecurity-skills.md) plugin (the F3 / fraud
domain), so an analyst working a case can pivot from a flagged typology to the
matching adversary playbook.

> F3 is fraud-specific where MITRE ATT&CK is intrusion-specific. It adds two
> tactics that ATT&CK lacks:
> - **Positioning (FA0001)** — data collection, account/identity manipulation,
>   and staging that happens *before* the fraudulent value movement.
> - **Monetization (FA0002)** — converting illicitly obtained access or assets
>   into usable funds, and laundering/integrating them.
>
> This tool sits on the **defensive** side: it scores onboarding risk and screens
> for designations. The mapping is for **detection and EDD reasoning**, not for
> conducting fraud. Authorized, lawful use only (see the plugin doc's scope note).

## How to read this

- **Typology / red-flag ID** — the identifier already used in `brain-soul.js`
  (`TYPOLOGIES[].id`, `RED_FLAGS_HIGH[].id`). These appear verbatim in Advisor
  output, so they are the join key.
- **F3 tactic** — the primary F3 tactic the behaviour falls under.
- **Stage** — where in the fraud lifecycle it sits (Positioning → execution →
  Monetization), which tells the analyst what evidence to pull next.

## Positioning (FA0001) — pre-fraud staging

| Typology / red flag (brain-soul ID) | F3 behaviour | Analyst pivot |
|---|---|---|
| `synthetic_identity`, `rf_ai_synthetic_kyc_bypass` | Synthetic / manipulated identity creation to pass KYC | Verify liveness + document provenance; request second strong identifier |
| `ai_synthetic_media_fraud`, `rf_ai_synthetic_ceo_deepfake` | Deepfake media to authorise payments / impersonate | Out-of-band call-back on a known number; four-eyes on payment change |
| `shell_company_chain`, `rf_shell_director_overlap` | Front/shell staging to obscure control | Pull UBO chain; check nominee-director overlap across counterparties |
| `ubo`, `bearer_share_fz_loophole`, `rf_ubo_bearer_shares` | Beneficial-ownership concealment | Demand ownership evidence to natural persons; flag bearer-share equivalents |
| `insider_threat`, `rf_insider_threat_privileged_exfil` | Privileged-access positioning / data exfiltration | Compare data pull vs role baseline; review access logs |

## Execution (ATT&CK-adjacent / core fraud act)

| Typology / red flag (brain-soul ID) | F3 behaviour | Analyst pivot |
|---|---|---|
| `structuring`, `rf_structuring_threshold`, `rf_structuring_branches` | Threshold avoidance / smurfing | Aggregate near-threshold clusters (`kri_structuring_window_count`) |
| `tbml`, `pms_tbml_invoicing`, `rf_tbml_over_invoice`, `rf_tbml_phantom_shipment`, `rf_tbml_round_trip` | Trade mis-invoicing / phantom & carousel shipments | Reconcile invoice vs market price, vessel AIS, HS-code reuse |
| `sanctions_evasion`, `rf_sanc_shell_chain`, `rf_sanc_stss` | Third-country routing / AIS-gap STS transfer | Re-screen counterparties + vessels; check routing jurisdictions |
| `proliferation`, `rf_sanc_dual_use` | Dual-use / WMD-linked trade | End-user check; UN 1540 / dual-use control list review |
| `dpms_retail`, `pms_cash_structuring`, `rf_dpms_cash_walk_in`, `rf_pms_high_volume_cash` | Cash placement at DPMS point-of-sale | Source-of-funds evidence; threshold report (AED 55,000) |
| `dpms_refinery`, `pms_conflict_gold`, `env_illegal_mining`, `rf_dpms_refiner_cahra` | CAHRA-origin gold without OECD docs | Demand OECD Annex II chain-of-custody; flag `kri_cahra_without_docs` |

## Monetization (FA0002) — convert & launder

| Typology / red flag (brain-soul ID) | F3 behaviour | Analyst pivot |
|---|---|---|
| `layering`, `funnel_account` | Inter-jurisdictional layering / funnel accounts | Map flow-of-funds; identify rapid in-out funnel pattern |
| `vasp`, `mixer_usage`, `rf_vasp_mixer`, `rf_crypto_onramp_card_to_mixer` | Crypto mixing / privacy-protocol cash-out | On-chain hop analysis (`kri_mixer_exposure_hops`); Travel Rule data |
| `rf_vasp_travel_rule_gap` | Missing originator/beneficiary data (FATF R.16) | Request Travel-Rule payload; hold pending originator data |
| `hawala_network`, `tf_mvts_hawala` | Informal value transfer / settlement | Identify settlement counterparties; MVTS licensing check |
| `real_estate_cash`, `tax_evasion_offshore` | Integration into assets / offshore structures | Trace beneficial purchaser; offshore-structure source-of-wealth |
| `professional_money_laundering`, `kleptocracy` | Laundering-as-a-service / grand corruption flows | Network analysis across clients; PEP-nominee linkage |

## Cross-cutting (TF, environmental, human-trafficking, governance)

These typologies span multiple F3 stages; treat the F3 tactic as the *dominant*
one for triage:

- **Terrorism financing** — `tf_npo_abuse`, `tf_cash_courier`, `tf_self_funding`,
  `tf_ftf_travel` → mostly Positioning + Monetization (low-value, self-funded).
- **Environmental crime** — `env_wildlife_trafficking`, `env_illegal_logging`,
  `env_waste_trafficking`, `env_iuu_fishing` → Execution + Monetization via trade.
- **Human trafficking** — `ht_labour_exploitation`, `ht_sexual_exploitation`,
  `rf_ht_salary_consolidation` → Monetization (third-party-controlled accounts).
- **Governance failure** — `governance`, `rf_ctl_four_eyes_bypass`,
  `rf_ctl_record_gap` → control-side enablers across all stages.

## Framework references

- MITRE F3 v1.1 — Fight Fraud Framework (Positioning FA0001, Monetization FA0002)
- FATF Recommendations (R.1, R.8, R.12, R.14, R.16, R.22/24/25) and typology reports
- UAE: Federal Decree-Law No. 10 of 2025 + Cabinet Resolution No. 134 of 2025;
  UAE FIU PMS/TF/Env/HT typology reports
- OECD Due Diligence Guidance (CAHRA gold); LBMA Responsible Gold Guidance

The full F3 technique catalogue and the matching agent workflows ship with the
[`cybersecurity-skills` plugin](cybersecurity-skills.md) — see its
**MITRE F3** / fraud domain.
