# Handoff: Hawkeye Sterling — Entity Risk Assessment (Dark Neon UI + Print Report)

## Overview
Two related deliverables for an AML/CFT Entity Risk Assessment tool used by Hawkeye Sterling LLC (DPMS — Dealers in Precious Metals and Stones):

1. **Assessment form** (`Entity Risk Assessment - Hawkeye Sterling (dark).html`) — a dark, neon-accented interactive form. The compliance officer fills in entity details, answers 11 yes/no risk questions, declares supply-chain material sources, and the app live-computes a total risk score, the required due-diligence level (CDD / SDD / EDD), and a score breakdown.
2. **Print report** (`Hawkeye Sterling - Risk Report.html`) — a formal black/pink A4 report that auto-fills from the form's saved state (localStorage) and is the artifact users print / save as PDF and sign.

## About the Design Files
The files in this bundle are **design references created in HTML** — working prototypes that show the intended look and behavior. They are NOT production code to copy directly. The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, etc.) using its established patterns and libraries — or, if no app exists yet, pick an appropriate framework and implement them there.

`assets/tweaks-panel.jsx` and `assets/hs-tweaks-dark.jsx` are design-tool scaffolding (an in-prototype settings panel) — ignore them for implementation.

## Fidelity
**High-fidelity.** Colors, typography, spacing, and interactions are final as approved by the client. Recreate pixel-perfectly.

## Screens / Views

### 1. Assessment Form (dark)
- **Layout**: full-viewport app. Sticky 64px header. Below it a CSS grid: `1fr` form column + fixed `320px` sticky right sidebar (sidebar scrolls independently, `height: calc(100vh - 64px)`). Form column padding `24px 32px 64px`. Breakpoints: sidebar stacks below form at ≤800px; field grids collapse to 1 column at ≤520px.
- **Header**: centered flex, gap 14px. HS monogram (38×38px, 1.5px solid yellow-neon border, radius 6px, yellow glow) + single title `HAWKEYE STERLING — ENTITY RISK ASSESSMENT` (16px, 700, letter-spacing 0.13em, color `#F7E55A` with yellow text-glow `0 0 12px rgba(247,229,90,0.45)`). Header bg `rgba(8,11,18,0.88)` + 14px backdrop blur, 1px bottom border `rgba(255,255,255,0.11)`.
- **Cards** (6 sections): bg `#10161F`, 1px border `rgba(255,255,255,0.07)`, radius 9px, padding `14px 18px`, margin-bottom 10px, shadow `0 1px 0 rgba(255,255,255,0.03) inset, 0 12px 32px rgba(0,0,0,0.35)`. Each card has a 1px neon hairline across its top edge: `linear-gradient(90deg, transparent, rgba(180,92,255,0.55), rgba(255,92,168,0.45), transparent)`. Hover: border brightens to `rgba(255,255,255,0.12)`.
- **Section headers**: gold mono number (`01`–`06`, 10px, `#D2A648`) + title in UPPERCASE 11px, letter-spacing 1.4px, **purple→pink gradient text** (`linear-gradient(90deg,#B45CFF,#FF5CA8 80%)` via background-clip:text) with `drop-shadow(0 0 7px rgba(255,92,168,0.35))`, followed by a flex-1 neon rule (1.5px, gradient `#B45CFF→#FF5CA8→transparent`, glow `0 0 8px rgba(255,92,168,0.45)`).
- **Sections**: 01 Assessment Administration (ref number, dates, assessor) · 02 Entity Identification (legal name, jurisdiction select with score tag) · 03 Business Profile (activity select, onboarding channel toggle, 2 numeric year inputs) · 04 Ownership, Control & Compliance (11 yes/no question rows) · 05 Supply Chain — Material Sources (2 groups × 3 supplier selects) · 06 Sign-Off & Attestation (statement box, 2 signature blocks, notes textarea).
- **Inputs/selects/textarea**: bg `#0B101A`, 1px border `rgba(255,255,255,0.11)`, radius 6px, padding `6px 10px`, 12.5px text `#EDEFF4`. Focus: border `#D2A648` + ring `0 0 0 3px rgba(210,166,72,0.22)`. Labels: 9.5px, 600, uppercase, letter-spacing 0.9px, color `#A3ADC0`.
- **Question rows**: flex row — 2-digit number (9px mono gray), question text (13px), then a Yes/No segmented toggle + a 26px circular score pill. Row padding `7px 0`, 1px bottom hairline `rgba(255,255,255,0.06)`.
- **Yes/No toggles**: pill group bg `#0B101A` with 3px padding; selected option gets tinted bg + inset 1px ring + 600 weight — green (`#3BC48F` family) when the answer is low-risk, red (`#FF5757` family) when high-risk. Note: for question 1 (AML controls) "Yes" is the GOOD answer (green); for all others "No" is good.
- **Sidebar (Risk Summary)**, top to bottom:
  - **Gauge**: 220×185 SVG, 270° arc (r=74, stroke-width 10, round caps, dasharray technique, rotated 135°). Track shows zone tints; value arc uses gradient blue `#5B9BD8` (0–58%) → orange `#FF9434` (72%) → red `#FF5757` (88–100%). Two small tick marks at the SDD (orange) and EDD (red) thresholds on an outer r=86 circle. Centered score number (46px, 600, `#F0EDE4`) above the caption `RISK SCORE` (8px, letter-spacing 1.5, `#D6DBE6`). Below the SVG: a 2px neon purple→pink indicator bar with glow, then caption `OUT OF 30+` (8px, `#D6DBE6`).
  - **Required Diligence**: verdict pill (selected one of): CDD blue `#5B9BD8`, SDD orange neon `#FF9434` (+ glow `0 0 12px rgba(255,148,52,0.30)`), EDD red neon `#FF5757` (+ glow). Below: three threshold chips `CDD: 0–19`, `SDD: 20–22`, `EDD: 23+`; the active one is tinted/bordered in its color.
  - **Risk Position**: 4px segmented track (63.3% blue / 10% orange / rest red at ~0.55 alpha) with a ▲ pointer + score label that glides (`left` transition .45s) along 0–30 axis. A yellow-neon warning box appears only when score == 19: "⚠ At CDD/SDD boundary — one point triggers SDD."
  - **Score Breakdown**: collapsible (▶/▼) table listing every factor, its value, and a colored score badge; totals row at bottom.
  - **Actions** (bottom, hidden in print): `⎙ PRINT / EXPORT PDF` purple neon button, `✓ COMPLETE ASSESSMENT` pink neon, `↺ RESET` green neon. All: tinted bg (≈0.10 alpha), colored 1px border (≈0.5 alpha), outer glow shadow, uppercase 10.5px 600, letter-spacing 0.08em, radius 6px, full width. Hover: brighter tint + stronger glow + translateY(-1px).
  - Sidebar labels (`REQUIRED DILIGENCE` etc.): 9px mono uppercase followed by a flex-1 neon purple→pink line; block separators are gradient hairlines (border-image purple→pink→transparent).
- **Special yellow-neon elements** (`#F7E55A`): brand mark + wordmark, the boundary warning box, and the attestation statement's left border/glow. Attestation statement: italic, 12.5px, bg `rgba(247,229,90,0.05)`, 2px left border yellow, soft outer glow.

### 2. Risk Report (print)
- **Layout**: A4 (210mm) white page, content padding `6mm 6mm 8mm` (screen) / `0 6mm` + 9mm top/bottom page margins (print). Dark toolbar on screen only (pink Print button + back link).
- **Letterhead**: full-width black (`#15171E`) rounded band (radius 10px, padding 12×16px): pink HS mark (34px, 1.5px `#F06AA8` border, radius 8px) + white `HAWKEYE STERLING` (16pt, 700, ls 0.10em); right side `ENTITY RISK ASSESSMENT` in pink + gray sub `AML / CFT — DPMS TEMPLATE` (8.5pt).
- **Meta line**: Ref / Assessment date / Next review / Status — 9pt, values bold; `CONFIDENTIAL` in red `#C9252D`; 1px pink bottom rule.
- **Result box**: black rounded box (radius 12px): left = huge pink score (34pt, `#F06AA8`) over `RISK SCORE / 30+` caption, separated by a translucent pink rule; right = verdict (14pt, 700; CDD `#7FB3E8` / SDD `#FFAA5C` / EDD `#FF7B7B`) + three threshold chips (1px `#3A3F4D` borders; active chip pink).
- **Section headers**: pink `#D6336C`, uppercase 10.5pt 700, black rounded number badge (`01`…`07` in pink on `#15171E`), 1.5px underline fading pink→transparent (border-image).
- **Data tables**: label column 34% — 8.5pt uppercase gray `#4A5160`, ls 0.05em; values 10pt bold ink `#1A1F2B`; score chips right-aligned. Question rows: 24px number column; question text styled identically to the labels (8.5pt uppercase gray); Yes/No answer centered bold; chip at right. Row separators 0.75px `#EBE2E7`.
- **Score chips**: solid filled pills, white 8.5pt bold text — `0 · No Risk` gray `#7A8090`, `1 · Low` green `#1F7A53`, `2 · Medium` amber `#A4690B`, `3 · High` red `#B23A2E`.
- **Notes box**: 0.75px border, 3px pink left border, radius 8px, min-height 54px; shows italic gray "No additional notes recorded." when empty.
- **Sign-off**: italic attestation paragraph in a soft pink box (`#FAF2F6`, pink left border), then a 2-column grid of signature blocks (pink uppercase role, name/title/date rows, 38px signature line with `SIGNATURE` caption).
- **Footer**: centered 7.5pt gray over a pink rule: `CONFIDENTIAL — Hawkeye Sterling LLC — AML/CFT Entity Risk Assessment — Ref: <ref> — DPMS Template`.
- **Print rules**: `print-color-adjust: exact` everywhere (black/pink must print); `@page { size: A4; margin: 9mm 0 }`; result box, sign-off grid, and notes box must not split across pages; section headers avoid page-break-after.

## Interactions & Behavior
- **Live scoring** (recalc on every change): total = jurisdiction score + activity score + 11 question scores + onboarding + operational-history + relationship-duration + up to 6 supplier scores. Verdict: total ≤19 → CDD, 20–22 → SDD, ≥23 → EDD. Gauge arc length = `min(total/30, 1)` of the 270° arc, animated (`stroke-dasharray` transition .5s cubic-bezier(0.4,0,0.2,1)). Pointer position = `total/30 * 100%`.
- **Scoring rules**: yes/no questions score 3 (bad answer) / 1 (good answer); question 1 is inverted (Yes=1, No=3). Onboarding: In-Person=1, Remote=3. Years: 0→3, 1→2, ≥2→1. Jurisdiction: per-country score 1/2/3 (full country list with scores is in `assets/hs-app.js` `COUNTRIES`). Activities, recycled-material and mined-material source scores: see `ACTIVITIES`, `RECYCLED`, `MINED` arrays in the same file — **treat these arrays as the source of truth**.
- **Entrance animations** (dark form, gated on `prefers-reduced-motion: no-preference`): cards slide up + fade in staggered ~70ms apart (.65s cubic-bezier(.22,.7,.25,1)); sidebar blocks likewise; on load the gauge arc draws in from 0 over 1.1s while the score counts up 0→N (~1s, cubic ease-out); afterwards any score change pops the number (scale 1→1.18→1, .45s). Background: 3 faint radial glows drift slowly (26s ease-in-out alternate). Boundary warning fades/slides in when shown.
- **Complete Assessment** toggles a DRAFT/COMPLETE status (internal state; status badge currently hidden in header).
- **Print/Export** (form) saves state then navigates to the report page; report's Print button calls `window.print()`.
- **Reset** restores all defaults (UK jurisdiction, Non-Manufactured Precious Metal Trading, all good answers, 2 years, default suppliers).
- **Autosave**: every change persists to `localStorage` key `hs_ra_v2` (flat key/value map — see `saveLS()` in `hs-app.js`); the report reads the same key. In production, replace with real persistence/API but keep the same data shape conceptually.

## State Management
- Form state: ref, dates, assessor info, entity name, jurisdiction, activity, onboarding (Yes/No), entityYears, relYears, 11 question answers, 6 supplier selections, notes, 2 signature blocks, complete/draft flag.
- Derived: per-factor scores, total, verdict, boundary flag (total==19), breakdown rows.
- Report screen is read-only, derived entirely from saved form state.

## Design Tokens

### Dark form
- Background `#0A0E16`; card `#10161F`; input `#0B101A`
- Text: primary `#EDEFF4`, secondary `#A3ADC0`, tertiary `#646F86`, bright captions `#D6DBE6`
- Borders: `rgba(255,255,255,0.07)` / `rgba(255,255,255,0.11)`
- Neon purple `#B45CFF`, neon pink `#FF5CA8`, neon yellow `#F7E55A`, gold `#D2A648`
- Risk: low `#3BC48F`, medium `#E0A33C`, high/EDD `#FF5757`, none `#828CA5`, CDD `#5B9BD8`, SDD `#FF9434` (tinted bgs at 0.10 alpha, borders ~0.3–0.45 alpha)
- Radii: 9px (cards), 6px (inputs/buttons); pills 99px
- Font: `'Arial Narrow', 'Helvetica Neue', Arial, sans-serif` everywhere

### Report
- Black `#15171E`; pink `#D6336C`; light pink `#F06AA8`; red (confidential) `#C9252D`
- Ink `#1A1F2B` / `#4A5160` / `#7A8090`; hairlines `#D9CCD3` / `#EBE2E7`
- Chip fills: gray `#7A8090`, green `#1F7A53`, amber `#A4690B`, red `#B23A2E`
- Verdict (on black): `#7FB3E8` / `#FFAA5C` / `#FF7B7B`
- Radii: 12px (page boxes), 10px (letterhead), 8px (small boxes), 99px (chips)
- Font: Arial Narrow stack, pt-based sizes (print)

## Assets
No external images. The HS monogram is typeset text in a bordered box. Gauge is inline SVG. No icon library — the few glyphs (⎙ ✓ ↺ ▶ ⚠) are unicode characters.

## Files
- `Entity Risk Assessment - Hawkeye Sterling (dark).html` — form markup + gauge SVG
- `assets/hs-dark.css` — all form styling, animations, print fallback
- `assets/hs-app.js` — data arrays (countries/activities/materials/questions), scoring engine, recalc, autosave
- `assets/hs-anim.js` — gauge draw-in, count-up, score pop
- `Hawkeye Sterling - Risk Report.html` — report markup + styles (inline)
- `assets/hs-report.js` — reads saved state and fills the report
- `assets/tweaks-panel.jsx`, `assets/hs-tweaks-dark.jsx` — design-tool only; ignore
