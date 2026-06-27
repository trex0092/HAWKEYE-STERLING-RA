# Arabic legal-text translation — archived reference (NOT in production)

> **DECISION (2026-06-27): the long-form legal/report text stays English-only.**
> The firm has chosen to keep the narrative-rationale templates and the printed
> compliance report in **English** — the authoritative language for filed
> records. The Arabic UI toggle (field labels, buttons, on-screen content) is
> unaffected and remains live; only the long-form *legal* prose is out of scope
> for translation. **No qualified-reviewer sign-off is required, and the
> integration steps below are NOT to be applied.** This file is retained as an
> archived reference only — none of its Arabic is wired into `buildNarrative()`
> or the printed report, so no machine-translated legal text can reach a filed
> document.

This file holds **machine-assisted Arabic** for the long-form legal text that the
in-app Arabic mode deliberately leaves in English: the four **narrative-rationale
templates** (`buildNarrative()` in `index.html`) and the **printed-report**
headings.

> **Why this is a review document, not live code.** The narrative rationale is
> written into the assessment notes and the **printed PDF report** — a filed
> compliance record. The on-screen Arabic caveat banner (`#i18nCaveat`) does
> **not** appear on the printed report, so a machine-translated rationale could
> reach a filed document with no visible "draft / needs-review" warning. A
> mistranslated legal rationale in a filed report is worse than English.
> **Do not wire any of this into `buildNarrative()` / the print report until a
> qualified Arabic-AML reviewer has signed it off.**

**Reviewer:** please check terminology, legal accuracy, and that every
placeholder and policy reference is preserved. Tick each block when approved.

## Conventions
- `[…]` = a value injected at runtime — keep the brackets, translate the label only.
- Policy references (`[سياسة …]`) are inserted from the `POLICIES` constant — use the
  firm's **official Arabic policy titles** here, not a literal translation.
- Statutory references (Federal Decree-Law No. (10) of 2025, the Cabinet Decision on
  Targeted Financial Sanctions) must match the **official Arabic names** of those instruments.

---

## Jurisdiction-risk phrase (`jurWord`, shared by the CDD/SDD/EDD narratives)

| Band | EN | AR (proposed) |
|---|---|---|
| Low (1) | a low risk jurisdiction under our country risk assessment | اختصاص منخفض المخاطر وفق تقييمنا لمخاطر الدول |
| Medium (2) | a medium risk jurisdiction under our country risk assessment | اختصاص متوسّط المخاطر وفق تقييمنا لمخاطر الدول |
| High (3) | a high risk jurisdiction under our country risk assessment | اختصاص مرتفع المخاطر وفق تقييمنا لمخاطر الدول |

---

## 1. PROHIBITED — designated-party exposure  ☐ approved

**EN (source):**
> We assessed [Entity] on [date] using the Company's Risk Assessment methodology. The total score is [score]. Designated party exposure was identified: [reasons]. The relationship is prohibited under our [TFS policy] and our [RAS policy]. We will not onboard or continue with this customer. Funds are frozen where held, and the Compliance Officer will decide whether a report must be filed with the Financial Intelligence Unit under Federal Decree-Law No. (10) of 2025 and the Cabinet Decision on Targeted Financial Sanctions. No review date is set because the relationship is declined. This note is kept as the record of our decision.

**AR (proposed, for review):**
> قيّمنا [الاسم القانوني للكيان] بتاريخ [يوم/شهر/سنة] باستخدام منهجية تقييم المخاطر لدى الشركة. بلغ مجموع الدرجات [الدرجة]. تبيّن وجود ارتباط بطرف مُدرَج: [الأسباب]. العلاقة محظورة بموجب [سياسة العقوبات المالية المستهدفة] و[سياسة بيان قابلية تحمّل المخاطر] لدينا. لن نبدأ العلاقة مع هذا العميل ولن نستمرّ فيها. تُجمَّد الأموال حيثما وُجدت، وسيقرّر مسؤول الامتثال ما إذا كان يجب تقديم بلاغ إلى وحدة المعلومات المالية بموجب المرسوم بقانون اتحادي رقم (10) لسنة 2025 وقرار مجلس الوزراء بشأن العقوبات المالية المستهدفة. لم يُحدَّد تاريخ مراجعة لأن العلاقة مرفوضة. تُحفَظ هذه المذكرة سجلًّا لقرارنا.

---

## 2. CDD — low risk band  ☐ approved

**EN (source):**
> We assessed [Entity] on [date] using the Company's Risk Assessment methodology. The total score is [score], which places the customer in the low risk band. The customer operates from [jurWord], and its licensed activity is within the sectors accepted by our [RAS policy]. Screening for sanctions, PEP and adverse media was completed and cleared before onboarding under our [TFS policy]. We found no concerns under our [SOFW policy], and the declared material sources fall within our [RS policy]. Standard due diligence applies. We will review the file at least every twelve months, re-screen the customer annually, and bring the review forward if anything changes, in line with our [KYC policy]. Transaction monitoring follows the low risk cycle. The relationship is within our risk appetite and is approved. This note is kept as the record of our decision.

**AR (proposed, for review):**
> قيّمنا [الاسم القانوني للكيان] بتاريخ [يوم/شهر/سنة] باستخدام منهجية تقييم المخاطر لدى الشركة. بلغ مجموع الدرجات [الدرجة]، ما يضع العميل في فئة المخاطر المنخفضة. يعمل العميل من [عبارة الاختصاص]، ويقع نشاطه المرخَّص ضمن القطاعات المقبولة بموجب [سياسة بيان قابلية تحمّل المخاطر]. اكتمل فحص العقوبات والأشخاص المعرَّضين سياسياً والإعلام السلبي وخلا من المطابقات قبل بدء العلاقة بموجب [سياسة العقوبات المالية المستهدفة]. لم نجد مخاوف بموجب [سياسة مصدر الأموال والثروة]، وتقع مصادر المواد المعلنة ضمن [سياسة التوريد المسؤول]. تنطبق العناية الواجبة المعيارية. سنراجع الملف مرة كل اثني عشر شهراً على الأقل، ونعيد فحص العميل سنوياً، ونقدّم موعد المراجعة عند حدوث أي تغيّر، بما يتوافق مع [سياسة اعرف عميلك]. تتبع مراقبة المعاملات دورة المخاطر المنخفضة. العلاقة ضمن قابليتنا لتحمّل المخاطر وهي معتمَدة. تُحفَظ هذه المذكرة سجلًّا لقرارنا.

---

## 3. SDD — medium risk band  ☐ approved

**EN (source):**
> We assessed [Entity] on [date] using the Company's Risk Assessment methodology. The total score is [score], which places the customer in the medium risk band. Some factors raise the profile, such as the jurisdiction, the business activity, the material sources or the length of trading history. Screening was completed and cleared under our [TFS policy], the source of funds is verifiable under our [SOFW policy], and the activity remains within the sectors accepted by our [RAS policy]. *(If score = 22:)* The score is one point below the high risk threshold, so a change in a single factor will raise the required diligence. Simplified due diligence applies, with closer monitoring where needed. We will review the file every six months, or sooner if a trigger event occurs, in line with our [KYC policy]. Transaction monitoring follows the medium risk cycle. We continue the relationship on a conditional basis under our [RCP policy]. This note is kept as the record of our decision.

**AR (proposed, for review):**
> قيّمنا [الاسم القانوني للكيان] بتاريخ [يوم/شهر/سنة] باستخدام منهجية تقييم المخاطر لدى الشركة. بلغ مجموع الدرجات [الدرجة]، ما يضع العميل في فئة المخاطر المتوسّطة. ترفع بعض العوامل مستوى المخاطر، مثل الاختصاص القضائي أو النشاط التجاري أو مصادر المواد أو مدّة تاريخ التداول. اكتمل الفحص وخلا من المطابقات بموجب [سياسة العقوبات المالية المستهدفة]، ومصدر الأموال قابل للتحقّق بموجب [سياسة مصدر الأموال والثروة]، ويبقى النشاط ضمن القطاعات المقبولة بموجب [سياسة بيان قابلية تحمّل المخاطر]. *(إذا كانت الدرجة = 22:)* تقلّ الدرجة بنقطة واحدة عن عتبة المخاطر المرتفعة، لذا فإن تغيّر عامل واحد سيرفع مستوى العناية المطلوبة. تنطبق العناية الواجبة المبسّطة مع مراقبة أوثق عند الحاجة. سنراجع الملف كل ستة أشهر، أو قبل ذلك عند وقوع حدث مُحفِّز، بما يتوافق مع [سياسة اعرف عميلك]. تتبع مراقبة المعاملات دورة المخاطر المتوسّطة. نستمرّ في العلاقة على أساس مشروط بموجب [سياسة قبول العلاقة ومراجعتها]. تُحفَظ هذه المذكرة سجلًّا لقرارنا.

---

## 4. EDD — high risk band  ☐ approved

**EN (source):**
> We assessed [Entity] on [date] using the Company's Risk Assessment methodology. The total score is [score], which places the customer in the high risk band. *(If escalations:)* This includes a mandatory escalation: [reasons]. *(If analyst override:)* The outcome was raised from [from] by an analyst override: [reason]. The main concerns come from factors such as the jurisdiction, the material sources, the delivery channel or the ownership structure. The customer is not based in a FATF blacklisted country, screening returned no matches on the UN, EU, OFAC or UAE lists under our [TFS policy], and the source of funds can be verified, so we may continue under enhanced controls within our [RAS policy]. Enhanced due diligence applies and senior management approval is recorded. We verify the owners and controllers under our [UBO policy], obtain documents that support the source of funds and wealth, and carry out enhanced checks under our [RS policy]. We will review the file at least every three months, or immediately if a trigger event occurs, in line with our [KYC policy]. Transaction monitoring follows the high risk cycle. Approved by [MLRO name] on [DD/MM/YYYY]. This note is kept as the record of our decision.

**AR (proposed, for review):**
> قيّمنا [الاسم القانوني للكيان] بتاريخ [يوم/شهر/سنة] باستخدام منهجية تقييم المخاطر لدى الشركة. بلغ مجموع الدرجات [الدرجة]، ما يضع العميل في فئة المخاطر المرتفعة. *(عند وجود تصعيد:)* يشمل ذلك تصعيداً إلزامياً: [الأسباب]. *(عند وجود تجاوز من المحلِّل:)* رُفِع الناتج من [الناتج السابق] بتجاوز من المحلِّل: [السبب]. تنبع المخاوف الرئيسية من عوامل مثل الاختصاص القضائي أو مصادر المواد أو قناة التعامل أو هيكل الملكية. لا يقع مقرّ العميل في دولة مدرجة على القائمة السوداء لمجموعة العمل المالي (FATF)، ولم يُسفر الفحص عن أي مطابقات على قوائم الأمم المتحدة أو الاتحاد الأوروبي أو OFAC أو الدولة بموجب [سياسة العقوبات المالية المستهدفة]، ويمكن التحقّق من مصدر الأموال، لذا يجوز لنا الاستمرار في ظل ضوابط معزّزة ضمن [سياسة بيان قابلية تحمّل المخاطر]. تنطبق العناية الواجبة المعزّزة ويُسجَّل اعتماد الإدارة العليا. نتحقّق من المالكين والمسيطرين بموجب [سياسة المالك المستفيد], ونحصل على المستندات الداعمة لمصدر الأموال والثروة, ونجري فحوصاً معزّزة بموجب [سياسة التوريد المسؤول]. سنراجع الملف مرة كل ثلاثة أشهر على الأقل, أو فوراً عند وقوع حدث مُحفِّز, بما يتوافق مع [سياسة اعرف عميلك]. تتبع مراقبة المعاملات دورة المخاطر المرتفعة. اعتمده [اسم مسؤول الإبلاغ عن غسل الأموال] بتاريخ [يوم/شهر/سنة]. تُحفَظ هذه المذكرة سجلًّا لقرارنا.

---

## Printed-report headings  ☐ approved

Most printed-report field labels reuse the keys already translated in the live
`I18N` dictionary (entity identification, screening evidence, sign-off, etc.).
The headings still needing a reviewer's eye:

| EN | AR (proposed) |
|---|---|
| Entity Risk Assessment | تقييم مخاطر الكيان |
| Risk Factor Breakdown | تفصيل عوامل المخاطر |
| Screening Evidence | أدلة الفحص |
| Assessment Notes & Risk Rationale | ملاحظات التقييم ومسوّغات المخاطر |
| Sign-Off & Attestation | التوقيع والإقرار |
| Audit Trail | مسار التدقيق |
| This output is decision support, not a decision. MLRO review required. | هذا المُخرَج وسيلة دعم للقرار وليس قراراً. تلزم مراجعة مسؤول الإبلاغ عن غسل الأموال. |

---

## After sign-off — how to integrate (engineering note)

Once a reviewer approves a block, wire it the same way the UI strings are
handled — a language-aware lookup, not a hard replacement:

1. Add the approved Arabic to a `NARRATIVE_AR` map keyed by band (mirroring the
   `ADVISORS` `roleAr`/`noteAr` pattern), with the runtime placeholders left as
   interpolation points.
2. In `buildNarrative()`, branch on `getLang()` to choose EN vs AR while keeping
   the existing placeholder substitution and the `POLICIES` injection.
3. For the printed report, ensure the Arabic caveat is **also rendered in the
   print view** (not only the on-screen banner) until the firm formally adopts
   the Arabic templates.

Until step 1 happens, `buildNarrative()` and the printed report stay
English-only by design.
