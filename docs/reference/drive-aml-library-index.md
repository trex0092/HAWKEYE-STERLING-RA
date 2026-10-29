# AML Reference Library: Google Drive Index

**Status:** Index only. The source documents are not in this repository.
**Source:** Google Drive folders supplied by the maintainer, read through the Drive connector on 2026-10-29.
**Scope:** File names, Drive IDs, sizes and the status fields recorded in the Drive registers. No document text is reproduced here.

## 1. Source folders

| Drive folder | Drive ID | Contents seen on first page |
|---|---|---|
| AML MATERIAL (library root) | `1Kbx-G36dK7sJs-2Bc1400aczTOLcan-j` | `01 UAE CIRCULARS`, `06 GRAPHICS NAMES`, `Duplications`, two registers (see §3) |
| Country risk assessments | `1KfiUHMtU9dsGVOftrzLMiw9uP9dPuilK` | `01 Country Risk Assessments`, `02 Country Report Packages and Versions`, `03 External Country Profiles and Evaluations`, `04 Risk Indices and Data Providers`, `05 Research and Reference Library` |
| CountryRisk.io PDFs | `16XBqFuXlAEahDJNWRm475yDaTbn-bmPF` | five PDFs (see §2) |

Only the first page of each folder listing was read. Each listing returned a `nextPageToken`, so further items exist and are not indexed here.

## 2. CountryRisk.io PDFs

| Title | Drive file ID | Size (bytes) | Last modified (Drive) |
|---|---|---|---|
| CountryRisk.io - Norway.pdf | `1Qc3wieC0nZ8p7UCa_UEVoR_qoW2UOCLL` | 1671464 | 2026-10-29T09:26:36Z |
| CountryRisk.io - Paraguay.pdf | `1mQH336pCpjTsti8ctxFUwUZHVoFL-77p` | 1671295 | 2026-10-29T09:41:18Z |
| CountryRisk.io - Svalbard and Jan Mayen.pdf | `12ll1ipn3TbmPadwcIa2UkvKGi0vLnjDQ` | 1672650 | 2026-10-29T11:44:05Z |
| CountryRisk.io - Tunisia.pdf | `1OGkbI9Qgyds_08AYeNiugP1TZxGi8sR6` | 1676555 | 2026-10-29T12:02:15Z |
| CountryRisk.io - Zimbabwe.pdf | `1rRLuec8MSosCKXUKCvO-y9N6FhTWwOsW` | 1672803 | 2026-10-29T12:18:11Z |

Licensing and provenance of these third-party reports have not been confirmed. They are not copied into the repository.

## 3. Registers (Google Sheets)

### 3.1 AML MATERIAL | Master Regulatory Register | LIVE

- Drive ID: `1FLvSngU5LxHAU6XEb9AEQJmYJm8Pt61JGW2EiXld5EU`
- Tabs: MASTER REGISTER, OPEN ACTIONS, OFFICIAL SOURCE GAPS, DUPLICATION CONTROL, LIBRARY SUMMARY, READ ME, COUNTRY OFFICIAL SOURCES
- LIBRARY SUMMARY tab: 427 indexed files, 368 reference files, 33 retained duplicates, 8 files under review, 61 files in YEAR TO VERIFY, 36 UAE circulars, 15 UAE regulations, 22 UAE guidances, 89 compliance templates, 29 worldwide references, 133 graphics, 11 official sources, 15 official source gaps (values as stated in that tab).

### 3.2 AML MATERIAL - MASTER REGULATORY & DOCUMENT REGISTER

- Drive ID: `1WUXgtbbSfyXHi7xrkqZHZfigS_kCq9puL79oELbsgTE`
- Tabs: Inventory (A1:P433), Official gaps, Review queue, Instructions, Summary, Master Register (A1:AD439), Outstanding Issues (A1:J250), Duplications (A1:L35), Dashboard, Graphics Naming Review (A1:I134), 100 Percent Closure Board (A1:O236), Training Correction Matrix (A1:M8)
- Dashboard tab: 438 unique Drive file IDs, 33 retained additional copies (values as stated in that tab).

## 4. Status caveats recorded in the registers

These are quoted from the register cells. They qualify how the library can be cited.

- **Regulatory status.** Many rows read `Not Verified`, `Not legally validated` or `Not Verified - current legal effect`. Example: MOE Circular 01-2021 is recorded as "Issuer and date verified against document" but with legal status "Not Verified - current legal effect" (Master Register, AML-0002).
- **Official source gaps.** Two CRITICAL rows read `SOURCE LINK ONLY, ORIGINAL PDF NOT STORED` for the March 2026 MoET DNFBP AML/CFT/CPF General Guidelines and the Supplemental Guidance for Dealers in Precious Metals (Inventory tab, "Official gaps").
- **Superseded material.** One 2026 MoET circular row reads `Superseded b...` and the register notes it is "Retained as ..." (Master Register, second row). A 2021 training source is marked "Historical-only reference" because it presents superseded thresholds (Training Correction Matrix, LEGAL-001 and LEGAL-002).
- **Duplicates.** The register records 33 retained additional copies. Byte-identity was confirmed for some pairs by SHA-256; others were confirmed by extracted text only, and the register notes "Matching extracted text does not guarantee matching r..." (the cell text was truncated in the connector output, so the full wording is not confirmed here).
- **Open actions.** The register lists 21 OPEN ACTIONS rows (A01 to A21), of which A01 and A02 are Critical and most others are High or Medium, with several marked "Source link filed; original PDF pending".

Interpretation: the registers are working indexes. Their own status fields do not support describing the whole library as officially verified. Each document should be cited from its official issuer source, with the date and version checked, before it is relied on.

## 5. Reproducing this index

1. Export or download the folders listed in §1 locally (for example with `rclone` or Google Takeout).
2. Confirm each file against the register row for its Drive ID.
3. Store documents you are licensed to keep, and record their hashes in the register.
