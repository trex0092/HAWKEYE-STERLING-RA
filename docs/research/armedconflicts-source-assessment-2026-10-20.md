# ArmedConflicts.org source assessment (20 October 2026)

## Decision
**Eligible for attributed, human-reviewed geopolitical context only. Automated ingestion and republishing are NOT approved.** Do not register this as a sanctions designation list, PEP database, an independent adverse-media outlet, or an authoritative legal finding. This assessment does not authorize scraping, automated downloads, API requests, or reproduction of third-party data.

## Public evidence reviewed
- [Homepage](https://armedconflicts.org/), accessed 2026-10-20: advertises 29 conflict theaters and a last-updated date; coverage is editorial and incomplete by design.
- [About](https://armedconflicts.org/about.html): identifies the website as a *secondary aggregation*, not first-hand reporting, using ACLED, UCDP and CFR with Google News developments.
- [Methodology](https://armedconflicts.org/methodology.html): theaters are not the same unit as event records. Structured conflict profiles are periodically reviewed; Google News headlines refresh on an automated schedule. Reported-deaths data come from preliminary UCDP candidate events and can lag. No absence of a theater can certify a low-risk jurisdiction.
- [Editorial standards](https://armedconflicts.org/editorial-standards.html): individual territorial-control claims include cited originating sources and as-of dates; older than 90 days are flagged. The site says source-linked JSON, CSV and GeoJSON exports exist on applicable records. Availability does not itself confer a license for bulk ingestion or redistribution.
- [Example source-linked briefing](https://armedconflicts.org/briefings/russia-ukraine-war-2026.html): shows cited sources, revisions, and downloadable formats for individual theater records.

## Classification and use policy
| Data or interpretation | Classification | Allowed treatment |
| --- | --- | --- |
| UN, EOCN, OFAC and national regulator listings | Binding or applicable sanctions subject to relevant law | Use only the authoritative regulator source; never infer a listing from this site |
| Conflict-theater profile, actor summary, geography | Secondary geopolitical context | Analyst may consult original link during EDD, record the URL, as-of date, origin and caveat |
| Google News conflict headlines | Third-party reporting pointers | Attribute original publisher and independently verify article; allegation is not a conviction |
| Person described as actor | Context, not an identified PEP | Do not mark PEP status without public-office and identity evidence |
| Conflict proximity / activity | Qualitative review indicator | Never auto-reject, freeze, de-risk, or assign a country risk score based on this site alone |

## Access, licensing and operational barriers
- The website says it is free to read and suitable for research, and its methodology permits citation with attribution. It does not establish that every ACLED/UCDP/CFR-derived record is licensed for automated commercial reuse and redistribution.
- Source-linked JSON/CSV/GeoJSON downloads are described. A documented supported sitewide API, bulk download entitlement, guaranteed service-level agreement, and RSS feed have **not** been verified.
- The robots.txt endpoint was not accessible in the assessment environment. Automated crawling must not be initiated until the current robots policy, site terms and every underlying dataset license have been checked and recorded.
- Static pages may change without schema guarantees. Lack of timely headlines or a theater record is **UNKNOWN**, not a negative finding.

## Approved implementation scope
1. Link the website as an optional **manual EDD research reference**, never a required primary-screening backbone.
2. If an analyst relies on it, retain an underlying primary-source URL, date-as-of, access timestamp, cited theater and a human-written rationale in the restricted compliance case, not in public GitHub logs.
3. Record missing source dates or unverifiable original evidence as **UNKNOWN**; do not convert a checked web page or HTTP 200 to verified screening assurance.
4. Do not ingest or persist conflict actors, allegations, casualties or maps into sanctions, PEP, adverse media or source-success counters.
5. Reassess documented licensing, robots access, field-level provenance, geographic completeness, schema and freshness before any future programmatic integration.

## Implementation status
Source due diligence documented. **No automated fetch, scheduler, ingestion, designation matching, risk-score change or dataset copying enabled.** This is deliberate until reuse rights and stable supported access are verified.
