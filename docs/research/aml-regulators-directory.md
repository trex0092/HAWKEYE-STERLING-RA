# AML Regulators & FIUs — Global Reference Directory

Prepared: 07/07/2026. Audience: analysts and the MLRO — quick orientation when a
counterparty, bank, or shipment touches another jurisdiction (who supervises AML
there, and which FIU receives reports).

**Provenance:** compiled from an industry reference infographic ("AML Regulators
Around the World", Khurram Ibrahim, LinkedIn) supplied to the compliance function,
cross-checked against the names already used in this repository's watched sources.
Reference material only — mandates shift; verify the current authority before
relying on it in a filing. Not legal advice.

## How the global system fits together
**FATF** (standard setter, 40 Recommendations) → **national authorities**
(legal/institutional regimes) → **FIUs** (receive/analyse/disseminate STRs) →
**law enforcement & judiciary** (investigate, enforce, seize).

## United Arab Emirates — the firm's home framework
| Body | Role |
|---|---|
| **Ministry of Economy (MoE)** | AML/CFT supervisor for DNFBPs incl. **DPMS — the firm's supervisor** (watched source `uae-moe`) |
| **CBUAE** | Central bank; AML supervision of financial institutions; source of the April-2026 guidance (watched `uae-cbuae`; see [2026-07 impact assessment](2026-07-cbuae-april-2026-update.md)) |
| **UAE FIU** | Financial intelligence unit — goAML STR portal (watched `uae-fiu`) |
| **EOCN** | Executive Office for Control & Non-Proliferation — TFS/PF lists (watched `uae-eocn`; local list mirrored in `data/`) |
| **NAMLCFTC** | National AML/CFT Committee (watched `uae-namlcftc`) |
| **DFSA / ADGM FSRA** | Financial-free-zone AML regulators (DIFC / ADGM) |
| **VARA** | Dubai virtual-assets regulator (watched `uae-vara`) |

## Major jurisdictions (supervisor · FIU)
| Jurisdiction | AML supervision | FIU |
|---|---|---|
| **Global** | FATF (standards) | — |
| **United States** | OCC, Federal Reserve, SEC, CFTC; DOJ & IRS-CI enforce | **FinCEN** |
| **United Kingdom** | FCA; OPBAS (professional-body oversight); HMRC (incl. DPMS-equivalents); SFO enforces | **NCA** |
| **European Union** | EBA guidelines; national competent authorities; **AMLA** (operational from mid-2026, direct supervision of select high-risk entities) | national FIUs |
| **India** | RBI, SEBI, IRDAI; ED enforces | FIU-IND |
| **Singapore** | MAS (integrated); CAD enforces | STRO |
| **Hong Kong** | HKMA, SFC | JFIU |
| **Australia** | AUSTRAC (integrated regulator + FIU); ASIC, APRA | AUSTRAC |
| **Canada** | OSFI; CSA | FINTRAC |
| **Japan** | FSA; NPA enforces | JAFIC |
| **South Korea** | FSC; KFTC (certain sectors) | KoFIU |
| **China** | PBOC, NFRA, CSRC | CAMLMAC |
| **Switzerland** | FINMA; Federal Banking Commission legacy | MROS |
| **South Africa** | SARB; FSCA | FIC |
| **Brazil** | Central Bank; CVM | COAF |
| **Malaysia** | BNM; SC | BNM FIU dept |
| **Turkey** | CBRT, SPK | **MASAK** |
| Russia · Indonesia · Philippines · Vietnam · Thailand · Mexico | — | Rosfinmonitoring · PPATK · AMLC · SBV · AMLO · UIF |

## Networks & standard-adjacent bodies
**Egmont Group** (FIU network — watched source `egmont`) · **APG** (Asia/Pacific
FATF-style body) · **Wolfsberg Group** (watched `wolfsberg`) · World Bank & IMF
(capacity) · **Basel Committee** (banking supervision; the Basel AML Index is a
watched source `basel-index`).

## Why this matters for a UAE DPMS
Gold flows cross most of these jurisdictions. When onboarding or reviewing a
counterparty, the analyst should know (a) which supervisor's list/rulebook governs
the counterparty, and (b) which FIU would receive a report on the other side —
both feed the jurisdiction-risk factor in the RA engine and the EDD narrative.
The engine's jurisdiction data lives in
[`../../data/jurisdiction-risk.json`](../../data/jurisdiction-risk.json); FATF
list changes arrive via the FATF Watchdog pipeline.
