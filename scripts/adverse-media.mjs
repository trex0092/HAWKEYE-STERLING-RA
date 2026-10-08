/* Adverse-media screening — free, no API key, zero dependencies.

   GLOBAL coverage: for each customer we sweep Google News' public RSS endpoint
   (news.google.com/rss/search) across a worldwide matrix of country/language
   locales — each queried with AML risk terms IN THAT LANGUAGE — and cross-check
   the GDELT DOC 2.0 global index (65+ languages, machine-translated). Every
   recent article whose headline names the subject AND carries a risk term is an
   adverse-media hit for MLRO review. This is a SIGNAL, not a finding — false
   positives are expected and a hit means "look", never "guilty".

   Why locale + language breadth: negative news frequently breaks first in local
   /native-language press (Arabic, Spanish, Russian, Chinese, …). English-only
   screening leaves a large recall gap for a global customer base; GDELT is the
   worldwide net and the per-language Google News locales add regional depth.

   (Google's paid Programmable Search API and scraping the HTML results page are
   not free / not ToS-clean; the RSS feed is the legitimate free path.)

   Pure helpers (query building + RSS parsing + scoring) are unit-tested offline;
   the fetch wrapper is the only network part. */
import { readFileSync } from 'node:fs';
import { RecoveryCircuit, RequestStartGate, retryAfterDelayMs } from './runtime-recovery.mjs';
export { RequestStartGate, retryAfterDelayMs };

/* ── English risk terms (default) ─────────────────────────────────────────────
   Appended to the customer name. A hit on a "strong" term (see STRONG_LIST)
   escalates the band. */
export const ADVERSE_TERMS = [
  'fraud', 'money laundering', 'sanctions', 'sanctions evasion', 'terrorism',
  'terrorist financing', 'bribery', 'corruption', 'embezzlement', 'arrested',
  'indicted', 'convicted', 'trafficking', 'smuggling', 'tax evasion',
  'organized crime', 'wire fraud', 'ponzi scheme',
  /* Stem forms (matching is substring): the exact-word list above missed
     "sanctioned by OFAC", "laundered", "kickback scheme", "terror funding" and
     "guilty" headlines outright — measured recall losses on the benchmark
     corpus. Strictly additive. */
  'sanctioned', 'blacklisted', 'guilty', 'insider trading', 'counterfeit',
  'launder', 'kickback', 'terror funding', 'market manipulation', 'embezzle',
  'indict', 'convict', 'arrest', 'smuggl', 'traffick', 'extort', 'forgery',
  'narcotics', 'organised crime', 'conflict gold', 'ponzi', 'illegal mining',
  'contraband',
  /* ADDED 2026-09-26: proliferation financing (CPF) had zero coverage in this array despite
     being present in GDELT_RISK_TERMS/PY_PARITY_TERMS for the GDELT channel - meaning the
     GNews headline-matching channel could not surface a CPF-related headline at all. CPF is a
     core pillar of this entity's own regulatory mandate (UAE Cabinet Resolution 134/2025), so
     this was a real gap between the two screening channels, not a cosmetic one. */
  'proliferation financing', 'weapons of mass destruction', 'wmd', 'dual-use',
  'chemical weapons', 'biological weapons', 'arms trafficking', 'weapons smuggling',
  /* Genuine additions verified absent from every term array in this file (ADVERSE_TERMS,
     GDELT_RISK_TERMS, GDELT_EXTRA_TERMS, PY_PARITY_TERMS) before being added - not
     re-added duplicates of what a categorized-keyword-list screenshot already covered. */
  'court case', 'fined', 'unlawful', 'verdict', 'tax fraud', 'vat fraud', 'cyber fraud',
  'financing of terrorism'
];

/* WEAK (generic, high-noise) terms: they flag a story FOR THE RECORD but a
   weak-only match scores tier 'weak' (75/medium) so downstream consumers can
   keep it out of escalation weight — a "political rally" or a commercial
   "lawsuit" headline must never carry money-laundering weight. Adding these
   is recall-monotone: pre-hardening they matched nothing at all. */
export const WEAK_TERMS = new Set([
  'political', 'politician', 'lawsuit', 'litigation', 'breach', 'unlawful',
  'illegal', 'esg', 'pollution', 'greenwashing', 'court case',
  'verdict', 'fined', 'nuclear', 'exploitation', 'conflict of interest',
  'deforestation'
]);
for (const t of WEAK_TERMS) ADVERSE_TERMS.push(t);

/* ── Python-parity scoring terms (screen.py ADVERSE_KEYWORDS) ─────────────────
   Every keyword the Python engine flags on must flag here too: both engines
   screen the SAME customers daily, so a term only screen.py knows is a headline
   the Python run reports and the JS digest silently drops — no list entry, no
   band escalation, hit:false with nothing marked partial or errored. These had
   no substring cover in ALL_TERMS ("cartel", "mafia", "bribe", "corrupt",
   "debarred", "proliferation financing", "ransomware", "modern slavery",
   "conflict minerals", "prison", …).

   SCORING ONLY — deliberately NOT pushed into ADVERSE_TERMS, which is also
   OR-joined into every Google News query: appending these takes the per-locale
   query URL from ~1.5KB to ~3KB, and a query Google rejects returns zero items,
   trading a scoring gap for a RETRIEVAL gap. Scoring is where the loss is:
   gdeltUrl already ASKS for 'cartel' / 'proliferation financing' / 'raid' /
   'seized' and nothing scored those items on arrival. Widening the term set can
   only add matches to an item, never remove one. */
export const PY_PARITY_TERMS = [
  // Sanctions / proliferation / terrorism
  'sanction', 'embargo', 'designated terrorist', 'extremist', 'radicalis',
  'radicaliz', 'militant', 'proliferation financing', 'weapons of mass destruction',
  'wmd', 'dual-use', 'export control', 'chemical weapons', 'biological weapons',
  'debarred',
  // Financial crime / corruption
  'financial crime', 'economic crime', 'pyramid scheme', 'asset misappropriation',
  'misuse of funds', 'bribe', 'corrupt', 'kleptocracy', 'state capture',
  'abuse of power', 'identity theft', 'blackmail',
  // Enforcement / legal status
  'prosecute', 'litigate', 'felon', 'imprisonment', 'jail', 'prison', 'theft',
  'murder', 'politic',
  // Organised crime / cyber
  'mafia', 'cartel', 'illicit', 'cybercrime', 'ransomware', 'darknet',
  /* Terms the GDELT query has ASKED FOR all along with nothing to score them —
     the exact defect PY_PARITY_TERMS was created to fix, left half-closed. An
     item retrieved because it mentioned a raid or an asset freeze arrived and
     scored zero on the very words that surfaced it. Found by the invariant that
     every retrieval term must also be a scoring term. */
  'investigation', 'raid', 'seized', 'asset freeze', 'prosecution',
  // ESG / minerals / human rights
  'human rights', 'forced labour', 'forced labor', 'modern slavery',
  'child labour', 'child labor', 'conflict minerals', 'blood diamond',
  'environmental violation', 'toxic waste', 'land grabbing', 'indigenous rights',
  'due diligence failure'
];
/* The generics among them are weak-tier in screen.py (KEYWORD_TIER_WEAK) — mirror
   that tiering, or an ESG/"human rights" headline would arrive at tier 'normal'
   here and 'weak' there. Added AFTER the push above so they widen SCORING only,
   and only for terms that matched nothing before: no existing match is downgraded. */
for (const t of ['politic', 'litigate', 'dual-use', 'human rights',
  'environmental violation', 'toxic waste', 'land grabbing', 'indigenous rights',
  'due diligence failure']) WEAK_TERMS.add(t);

/* Arabic-language risk terms — for a UAE deployment, adverse media often breaks
   in Arabic press first. Querying these (against Arabic Google News) closes a
   recall gap English-only screening leaves open. Matching is Unicode-aware (see
   normalize), so an Arabic-script subject name matches an Arabic headline; a
   Latin-only name simply finds nothing in Arabic press (correct — not a false
   clear, since the English + GDELT queries still run). */
export const ADVERSE_TERMS_AR = [
  'احتيال', 'غسل الأموال', 'عقوبات', 'إرهاب', 'تمويل الإرهاب',
  'رشوة', 'فساد', 'اختلاس', 'اعتقال', 'إدانة', 'تهريب', 'الاتجار بالبشر',
  // Verified 2026-09-26 against UAE government sources (u.ae, Federal Decree-Law No. 20 of 2018's
  // own title) and an Arabic policy-analysis source using precise legal/financial terminology -
  // not machine-translated guesses.
  'تمويل التنظيمات غير المشروعة', 'التهرب الضريبي', 'الجريمة المنظمة',
  'انتشار أسلحة الدمار الشامل'
];

/* ── Multilingual risk-term dictionaries ──────────────────────────────────────
   One list per language: money laundering · fraud · sanctions · terrorism ·
   terrorist financing · bribery · corruption · embezzlement · arrested ·
   convicted (+ trafficking/smuggling where idiomatic). Terms are matched
   diacritic-insensitively and script-aware (see normalize). Extend freely. */
export const LANG_TERMS = {
  en: ADVERSE_TERMS,
  ar: ADVERSE_TERMS_AR,
  es: ['fraude', 'lavado de dinero', 'blanqueo de capitales', 'sanciones', 'terrorismo',
    'financiación del terrorismo', 'soborno', 'corrupción', 'malversación', 'detenido',
    'condenado', 'narcotráfico', 'contrabando',
    // Verified 2026-09-27 against Argentina's UIF (argentina.gob.ar/uif, InfoLEG) and Mexico's
    // UIF (uif.gob.mx, under Hacienda/SHCP) - covers both active sanctions-extra.json sources
    // sharing this language (ar-repet/ar-repet-entidades, mx-sat-69b).
    'lavado de activos', 'reporte de operación sospechosa', 'operaciones inusuales',
    'sujeto obligado', 'recursos de procedencia ilícita'],
  fr: ['fraude', "blanchiment d'argent", 'sanctions', 'terrorisme', 'financement du terrorisme',
    'corruption', 'pot-de-vin', 'détournement de fonds', 'arrêté', 'condamné', 'trafic', 'contrebande',
    // Verified 2026-09-27 against TRACFIN's own site (economie.gouv.fr/tracfin) and the Code
    // monétaire et financier (Légifrance) - covers France, Canada, Morocco, Belgium and Monaco,
    // all active sanctions-extra.json sources sharing this language.
    'blanchiment de capitaux', 'LCB-FT', 'déclaration de soupçon', 'fraude fiscale',
    'abus de biens sociaux', 'bénéficiaire effectif'],
  de: ['Betrug', 'Geldwäsche', 'Sanktionen', 'Terrorismus', 'Terrorismusfinanzierung',
    'Bestechung', 'Korruption', 'Veruntreuung', 'verhaftet', 'verurteilt', 'Schmuggel', 'Menschenhandel',
    // Verified 2026-09-27 against MROS (fedpol.admin.ch - Switzerland's official Money
    // Laundering Reporting Office) and the Geldwäschereigesetz (GwG) - covers the active
    // sanctions-extra.json sources for Switzerland (ch-seco, ch-seco-opensanctions).
    'Verdachtsmeldung', 'Finanzintermediär', 'Sorgfaltspflicht'],
  pt: ['fraude', 'lavagem de dinheiro', 'sanções', 'terrorismo', 'financiamento do terrorismo',
    'suborno', 'corrupção', 'desvio de dinheiro', 'preso', 'condenado', 'tráfico', 'contrabando',
    // Verified 2026-09-27 against COAF (Brazil's FIU, under Banco Central) and Banco Central
    // Circular 3.978/2020 - Brazil is the highest-value active sanctions-extra.json target for
    // this language (4 sources: br-bcb-qgi, br-bcb-qgp, br-tcu-inidoneos, br-tcu-inabilitados).
    // Restored 2026-09-27 after being silently lost to a stale-base overwrite in a later PR
    // (#614) that was built from an outdated in-memory copy of this file - see that PR's own
    // commit message for the full root-cause note.
    'comunicação de operação suspeita', 'evasão de divisas', 'crime organizado'],
  ru: ['мошенничество', 'отмывание денег', 'санкции', 'терроризм', 'финансирование терроризма',
    'взяточничество', 'коррупция', 'растрата', 'арестован', 'осуждён', 'контрабанда'],
  zh: ['欺诈', '诈骗', '洗钱', '制裁', '恐怖主义', '恐怖融资', '贿赂', '腐败', '挪用公款', '被捕', '定罪', '走私', '贩运'],
  it: ['frode', 'riciclaggio di denaro', 'sanzioni', 'terrorismo', 'finanziamento del terrorismo',
    'corruzione', 'tangente', 'appropriazione indebita', 'arrestato', 'condannato', 'traffico', 'contrabbando'],
  tr: ['dolandırıcılık', 'kara para aklama', 'yaptırımlar', 'terörizm', 'terörün finansmanı',
    'rüşvet', 'yolsuzluk', 'zimmet', 'tutuklandı', 'mahkûm', 'kaçakçılık',
    // Verified 2026-09-26 against MASAK's own site (masak.hmb.gov.tr) and authoritative Turkish
    // AML/CFT legal sources - not machine-translated guesses.
    'terörizmin finansmanı', 'terör örgütü', 'organize suç', 'uyuşturucu ticareti',
    'vergi kaçakçılığı', 'sahtecilik', 'müsadere'],
  ja: ['詐欺', 'マネーロンダリング', '資金洗浄', '制裁', 'テロ', 'テロ資金供与', '贈収賄', '汚職', '横領', '逮捕', '有罪', '密輸',
    // Verified 2026-09-27 against JAFIC (npa.go.jp, Japan Financial Intelligence Center under
    // the National Police Agency) and the Act on Prevention of Transfer of Criminal Proceeds -
    // covers the active sanctions-extra.json source jp-mof.
    '疑わしい取引の届出', '資産凍結', '犯罪収益'],
  ko: ['사기', '자금세탁', '제재', '테러', '테러자금', '뇌물', '부패', '횡령', '체포', '유죄', '밀수'],
  hi: ['धोखाधड़ी', 'मनी लॉन्ड्रिंग', 'प्रतिबंध', 'आतंकवाद', 'आतंकी वित्तपोषण', 'रिश्वत', 'भ्रष्टाचार', 'गबन', 'गिरफ्तार', 'दोषी', 'तस्करी',
    // Verified 2026-09-27 against FIU-IND (fiuindia.gov.in / dor.gov.in, India's Financial
    // Intelligence Unit) and the Prevention of Money Laundering Act, 2002 (PMLA) - covers the
    // active sanctions-extra.json source in-mha.
    'संदिग्ध लेनदेन रिपोर्ट', 'धन शोधन निवारण अधिनियम', 'प्रवर्तन निदेशालय'],
  id: ['penipuan', 'pencucian uang', 'sanksi', 'terorisme', 'pendanaan terorisme', 'suap',
    'korupsi', 'penggelapan', 'ditangkap', 'terpidana', 'penyelundupan',
    // Verified 2026-09-27 against PPATK (ppatk.go.id, Indonesia's FIU) and UU No. 8 Tahun
    // 2010 - covers the active sanctions-extra.json source id-dttot.
    'transaksi keuangan mencurigakan', 'tindak pidana pencucian uang', 'penyedia jasa keuangan'],
  fa: ['کلاهبرداری', 'پولشویی', 'تحریم', 'تروریسم', 'تأمین مالی تروریسم', 'رشوه', 'فساد', 'اختلاس', 'دستگیر', 'محکوم', 'قاچاق'],
  ur: ['دھوکہ دہی', 'منی لانڈرنگ', 'پابندیاں', 'دہشت گردی', 'دہشت گردی کی مالی معاونت', 'رشوت', 'بدعنوانی', 'غبن', 'گرفتار', 'اسمگلنگ',
    // Verified 2026-09-27 against Pakistan's FMU (fmu.gov.pk, established under the AML Act
    // 2010) and financial press coverage of FMU/State Bank guidance - covers the active
    // sanctions-extra.json source pk-nacta.
    'مشکوک لین دین', 'نامزد غیر مالیاتی کاروباری ادارے', 'اصل مالکان'],
  uk: ['шахрайство', 'відмивання грошей', 'санкції', 'тероризм', 'фінансування тероризму',
    'хабарництво', 'корупція', 'розтрата', 'заарештований', 'засуджений', 'контрабанда',
    // Verified 2026-09-27 against Ukraine's AML/CFT law ("Про запобігання та протидію
    // легалізації (відмиванню) доходів...") and Держфінмоніторинг (fiu.gov.ua, Ukraine's
    // FIU) - covers the active sanctions-extra.json source ua-nsdc.
    'легалізація доходів', 'фінансовий моніторинг', 'підозрілі операції'],
  nl: ['fraude', 'witwassen', 'sancties', 'terrorisme', 'terrorismefinanciering', 'omkoping',
    'corruptie', 'verduistering', 'gearresteerd', 'veroordeeld', 'smokkel',
    // Verified 2026-09-27 against FIU-Nederland (fiu-nederland.nl) and the Wwft (Wet ter
    // voorkoming van witwassen en financieren van terrorisme) - covers the active
    // sanctions-extra.json sources nl-terror (Netherlands) and be-fod (Belgium, Dutch
    // being one of its three official languages).
    'ongebruikelijke transactie', 'meldplicht', 'poortwachters'],
  // ── Extended worldwide language coverage (weaponised global sweep) ──
  pl: ['oszustwo', 'pranie pieniędzy', 'sankcje', 'terroryzm', 'finansowanie terroryzmu',
    'łapówka', 'korupcja', 'sprzeniewierzenie', 'aresztowany', 'skazany', 'przemyt'],
  sv: ['bedrägeri', 'penningtvätt', 'sanktioner', 'terrorism', 'terrorismfinansiering',
    'muta', 'korruption', 'förskingring', 'gripen', 'dömd', 'smuggling'],
  no: ['svindel', 'hvitvasking', 'sanksjoner', 'terrorisme', 'terrorfinansiering',
    'bestikkelse', 'korrupsjon', 'underslag', 'arrestert', 'dømt', 'smugling'],
  da: ['svindel', 'hvidvask', 'sanktioner', 'terrorisme', 'terrorfinansiering',
    'bestikkelse', 'korruption', 'underslæb', 'anholdt', 'dømt', 'smugling'],
  fi: ['petos', 'rahanpesu', 'pakotteet', 'terrorismi', 'terrorismin rahoitus',
    'lahjonta', 'korruptio', 'kavallus', 'pidätetty', 'tuomittu', 'salakuljetus'],
  ro: ['fraudă', 'spălare de bani', 'sancțiuni', 'terorism', 'finanțarea terorismului',
    'mită', 'corupție', 'delapidare', 'arestat', 'condamnat', 'contrabandă'],
  cs: ['podvod', 'praní špinavých peněz', 'sankce', 'terorismus', 'financování terorismu',
    'úplatek', 'korupce', 'zpronevěra', 'zatčen', 'odsouzen', 'pašování'],
  sk: ['podvod', 'pranie špinavých peňazí', 'sankcie', 'terorizmus', 'financovanie terorizmu',
    'úplatok', 'korupcia', 'sprenevera', 'zatknutý', 'odsúdený', 'pašovanie'],
  hu: ['csalás', 'pénzmosás', 'szankciók', 'terrorizmus', 'terrorizmus finanszírozása',
    'megvesztegetés', 'korrupció', 'sikkasztás', 'letartóztatták', 'elítélték', 'csempészet'],
  el: ['απάτη', 'ξέπλυμα χρήματος', 'κυρώσεις', 'τρομοκρατία', 'χρηματοδότηση τρομοκρατίας',
    'δωροδοκία', 'διαφθορά', 'υπεξαίρεση', 'συνελήφθη', 'καταδικάστηκε', 'λαθρεμπόριο'],
  bg: ['измама', 'изпиране на пари', 'санкции', 'тероризъм', 'финансиране на тероризъм',
    'подкуп', 'корупция', 'присвояване', 'арестуван', 'осъден', 'контрабанда'],
  sr: ['prevara', 'pranje novca', 'sankcije', 'terorizam', 'korupcija', 'mito', 'uhapšen',
    'krijumčarenje', 'превара', 'прање новца', 'санкције', 'тероризам', 'корупција'],
  he: ['הונאה', 'הלבנת הון', 'סנקציות', 'טרור', 'מימון טרור', 'שוחד', 'שחיתות', 'מעילה',
    'נעצר', 'הורשע', 'הברחה',
    // Verified 2026-09-27 against IMPA (gov.il, Israel's Money Laundering and Terror Financing
    // Prohibition Authority) and Bank of Israel (boi.org.il) - covers Israel, an active
    // sanctions-extra.json source (il-nbctf, il-nbctf-orgs).
    'דיווח בלתי רגיל', 'עבירת מקור', 'הכר את הלקוח'],
  th: ['ฉ้อโกง', 'ฟอกเงิน', 'คว่ำบาตร', 'ก่อการร้าย', 'สนับสนุนการก่อการร้าย', 'สินบน',
    'ทุจริต', 'ยักยอก', 'ถูกจับ', 'ลักลอบ',
    // Verified 2026-09-27 against AMLO (amlo.go.th, Thailand's Anti-Money Laundering Office)
    // and the Anti-Money Laundering Act B.E. 2542 - covers the active sanctions-extra.json
    // source th-designated (named directly after the second term added here).
    'ธุรกรรมที่มีเหตุอันควรสงสัย', 'บุคคลที่ถูกกำหนด'],
  vi: ['gian lận', 'rửa tiền', 'trừng phạt', 'khủng bố', 'tài trợ khủng bố', 'hối lộ',
    'tham nhũng', 'biển thủ', 'bị bắt', 'kết án', 'buôn lậu'],
  ms: ['penipuan', 'pengubahan wang haram', 'sekatan', 'keganasan', 'pembiayaan keganasan',
    'rasuah', 'salah guna dana', 'ditangkap', 'penyeludupan',
    // Verified 2026-09-27 against Bank Negara Malaysia (amlcft.bnm.gov.my) and the AMLA 2001
    // (Anti-Money Laundering, Anti-Terrorism Financing and Proceeds of Unlawful Activities Act)
    // - covers the active sanctions-extra.json source my-moha.
    'laporan transaksi mencurigakan', 'institusi pelapor', 'sekatan kewangan yang disasarkan'],
  tl: ['pandaraya', 'parusa', 'terorismo', 'pagpopondo sa terorismo', 'suhol', 'korupsiyon',
    'malversasyon', 'inaresto', 'nahatulan',
    // Verified 2026-09-27 against real Filipino-language news coverage of actual AMLC
    // (Anti-Money Laundering Council, amlc.gov.ph) proceedings - covers the active
    // sanctions-extra.json source ph-amlc. Only one addition, deliberately: Philippine
    // AML discourse, even in Filipino-language reporting, consistently keeps "money
    // laundering", "AMLC" and "covered transactions" in English rather than translating
    // them (confirmed across multiple independent news sources on the same 2026 AMLC
    // hearing) - inventing Tagalog forms for those would not match real usage.
    'kahina-hinalang transaksyon'],
  sw: ['ulaghai', 'utakatishaji fedha', 'vikwazo', 'ugaidi', 'ufadhili wa ugaidi', 'rushwa',
    'ufisadi', 'ubadhirifu', 'amekamatwa', 'magendo'],
  bn: ['জালিয়াতি', 'অর্থ পাচার', 'নিষেধাজ্ঞা', 'সন্ত্রাস', 'সন্ত্রাসে অর্থায়ন', 'ঘুষ', 'দুর্নীতি',
    'আত্মসাৎ', 'গ্রেপ্তার', 'পাচার'],
  ta: ['மோசடி', 'பணமோசடி', 'தடைகள்', 'பயங்கரவாதம்', 'லஞ்சம்', 'ஊழல்', 'கையாடல்', 'கைது', 'கடத்தல்'],
  // ── High-risk-region languages (2026-08-05, adversarially-verified native AML lexicons) ──
  // Central Asia & Caucasus, South & SE Asia, Africa, Balkans & Baltics. Terms feed
  // ALL_TERMS, so even the languages WITHOUT a Google News edition (uz, lo, ha, so, am,
  // mk) improve scoring of GDELT's original-language titles.
  az: ['pul yuyulması', 'çirkli pulların yuyulması', 'fırıldaqçılıq', 'dələduzluq', 'sanksiyalar', 'terrorçuluq', 'terrorçuluğun maliyyələşdirilməsi', 'rüşvətxorluq', 'rüşvət', 'korrupsiya', 'mənimsəmə', 'vəsaitlərin mənimsənilməsi', 'həbs edildi', 'həbs olundu', 'məhkum edildi', 'insan alveri', 'qanunsuz alver', 'qaçaqmalçılıq'],
  kk: ['ақшаны жылыстату', 'ақша жылыстату', 'алаяқтық', 'санкциялар', 'терроризм', 'лаңкестік', 'терроризмді қаржыландыру', 'лаңкестікті қаржыландыру', 'пара алу', 'парақорлық', 'сыбайлас жемқорлық', 'коррупция', 'қаражатты иемдену', 'жымқыру', 'қамауға алынды', 'сотталды', 'кінәлі деп танылды', 'адам саудасы', 'контрабанда'],
  uz: ['pul yuvish', 'jinoiy yo\'l bilan olingan pullarni legallashtirish', 'firibgarlik', 'sanksiyalar', 'terrorizm', 'terrorizmni moliyalashtirish', 'pora', 'poraxo\'rlik', 'korrupsiya', 'mansab suiiste\'moli', 'mablag\'ni o\'zlashtirish', 'hibsga olindi', 'qamoqqa olindi', 'sudlandi', 'aybdor deb topildi', 'odam savdosi', 'kontrabanda'],
  ka: ['ფულის გათეთრება', 'თაღლითობა', 'სანქციები', 'ტერორიზმი', 'ტერორიზმის დაფინანსება', 'ქრთამი', 'მექრთამეობა', 'კორუფცია', 'მითვისება', 'გაფლანგვა', 'დააკავეს', 'დაკავებულია', 'მსჯავრი დაედო', 'გაასამართლეს', 'ტრეფიკინგი', 'ადამიანით ვაჭრობა', 'კონტრაბანდა'],
  hy: ['փողերի լվացում', 'դրամի լվացում', 'խարդախություն', 'պատժամիջոցներ', 'սանկցիաներ', 'ահաբեկչություն', 'ահաբեկչության ֆինանսավորում', 'կաշառք', 'կաշառակերություն', 'կոռուպցիա', 'յուրացում', 'ձերբակալվել է', 'ձերբակալվեց', 'դատապարտվել է', 'մեղավոր ճանաչվեց', 'թրաֆիքինգ', 'մարդկանց առևտուր', 'մաքսանենգություն'],
  ne: ['सम्पत्ति शुद्धीकरण', 'ठगी', 'प्रतिबन्ध', 'आतंकवाद', 'आतंकवादी वित्तपोषण', 'घुस', 'भ्रष्टाचार', 'हिनामिना', 'पक्राउ', 'दोषी ठहर', 'तस्करी', 'चोरी निकासी'],
  si: ['මුදල් විශුද්ධිකරණය', 'වංචාව', 'සම්බාධක', 'ත්‍රස්තවාදය', 'ත්‍රස්තවාදී මූල්‍යකරණය', 'අල්ලස', 'දූෂණය', 'අවභාවිතය', 'අත්අඩංගුවට', 'වරදකරු', 'ජාවාරම'],
  pa: ['ਮਨੀ ਲਾਂਡਰਿੰਗ', 'ਧੋਖਾਧੜੀ', 'ਪਾਬੰਦੀਆਂ', 'ਅੱਤਵਾਦ', 'ਅੱਤਵਾਦੀ ਫੰਡਿੰਗ', 'ਰਿਸ਼ਵਤ', 'ਭ੍ਰਿਸ਼ਟਾਚਾਰ', 'ਗਬਨ', 'ਗ੍ਰਿਫਤਾਰ', 'ਦੋਸ਼ੀ', 'ਤਸਕਰੀ', 'ਸਮਗਲਿੰਗ'],
  mr: ['मनी लाँडरिंग', 'फसवणूक', 'निर्बंध', 'दहशतवाद', 'दहशतवादी अर्थपुरवठा', 'लाच', 'भ्रष्टाचार', 'अपहार', 'अटक', 'दोषी', 'तस्करी', 'चोरटी वाहतूक'],
  my: ['ငွေကြေးခဝါချမှု', 'လိမ်လည်မှု', 'ပိတ်ဆို့အရေးယူမှု', 'အကြမ်းဖက်ဝါဒ', 'အကြမ်းဖက်မှု', 'အကြမ်းဖက်မှုကို ငွေကြေးထောက်ပံ့မှု', 'လာဘ်ပေးလာဘ်ယူမှု', 'အဂတိလိုက်စားမှု', 'ငွေအလွဲသုံးစားမှု', 'ဖမ်းဆီး', 'ပြစ်ဒဏ်ချမှတ်', 'လူကုန်ကူးမှု', 'မှောင်ခိုကူးသန်းမှု', 'မှောင်ခိုတင်သွင်းမှု'],
  km: ['ការសម្អាតប្រាក់', 'ការក្លែងបន្លំ', 'ទណ្ឌកម្ម', 'ភេរវកម្ម', 'ការផ្តល់ហិរញ្ញប្បទានដល់ភេរវកម្ម', 'ការសូកប៉ាន់', 'សំណូក', 'អំពើពុករលួយ', 'ចាប់ខ្លួន', 'កាត់ទោស', 'ការជួញដូរមនុស្ស', 'ការនាំចូលដោយខុសច្បាប់'],
  lo: ['ການຟອກເງິນ', 'ການສໍ້ໂກງ', 'ມາດຕະການຄວ່ຳບາດ', 'ການລົງໂທດ', 'ການກໍ່ການຮ້າຍ', 'ການສະໜອງທຶນໃຫ້ການກໍ່ການຮ້າຍ', 'ການໃຫ້ສິນບົນ', 'ການສໍ້ລາດບັງຫຼວງ', 'ການຍັກຍອກເງິນ', 'ຖືກຈັບກຸມ', 'ຖືກຕັດສິນລົງໂທດ', 'ການຄ້າມະນຸດ', 'ການລັກລອບຄ້າ', 'ການລັກລອບຂົນສົ່ງ'],
  ha: ['halasta kuɗin haram', 'zamba', 'takunkumi', 'ta\'addanci', 'tallafin ta\'addanci', 'cin hanci', 'cin hanci da rashawa', 'almubazzaranci', 'an kama', 'an samu da laifi', 'fataucin mutane', 'fasa-kwauri'],
  so: ['dhaqidda lacagta', 'khiyaano', 'cunaqabatayn', 'argagixiso', 'maalgelinta argagixisada', 'laaluush', 'musuqmaasuq', 'la xiray', 'xukun lagu riday', 'ganacsiga dadka', 'tahriib'],
  am: ['ሕገ-ወጥ የገንዘብ ዝውውር', 'ማጭበርበር', 'ማዕቀብ', 'ሽብርተኝነት', 'ሽብርተኝነትን በገንዘብ መደገፍ', 'ጉቦ', 'ሙስና', 'እምነት ማጉደል', 'ታሰረ', 'ጥፋተኛ ተባለ', 'ሕገ-ወጥ የሰዎች ዝውውር', 'ኮንትሮባንድ'],
  af: ['geldwassery', 'bedrog', 'sanksies', 'terrorisme', 'terreurfinansiering', 'omkopery', 'korrupsie', 'verduistering', 'gearresteer', 'skuldig bevind', 'mensehandel', 'smokkelary'],
  sq: ['pastrim parash', 'mashtrim', 'sanksione', 'terrorizëm', 'financim i terrorizmit', 'ryshfet', 'korrupsion', 'përvetësim', 'arrestuar', 'dënuar', 'trafikim', 'kontrabandë'],
  hr: ['pranje novca', 'prijevara', 'sankcije', 'terorizam', 'financiranje terorizma', 'podmićivanje', 'korupcija', 'pronevjera', 'uhićen', 'osuđen', 'trgovina ljudima', 'krijumčarenje'],
  sl: ['pranje denarja', 'goljufija', 'sankcije', 'terorizem', 'financiranje terorizma', 'podkupovanje', 'korupcija', 'poneverba', 'aretiran', 'obsojen', 'trgovina z ljudmi', 'tihotapljenje'],
  lt: ['pinigų plovimas', 'sukčiavimas', 'sankcijos', 'terorizmas', 'terorizmo finansavimas', 'kyšininkavimas', 'korupcija', 'pasisavinimas', 'suimtas', 'nuteistas', 'prekyba žmonėmis', 'kontrabanda'],
  lv: ['naudas atmazgāšana', 'krāpšana', 'sankcijas', 'terorisms', 'terorisma finansēšana', 'kukuļošana', 'korupcija', 'piesavināšanās', 'aizturēts', 'notiesāts', 'cilvēku tirdzniecība', 'kontrabanda',
    // Verified 2026-09-27 against Latvia's FID (fid.gov.lv, Finanšu izlūkošanas dienests -
    // Financial Intelligence Unit) and the NILLTPFN law (Noziedzīgi iegūtu līdzekļu
    // legalizācijas un terorisma un proliferācijas finansēšanas novēršanas likums) - covers
    // the active sanctions-extra.json source lv-fid. Deliberately a small addition: only
    // terms directly verified against these sources, not further generic vocabulary.
    'noziedzīgi iegūtu līdzekļu legalizācija', 'terorisma un proliferācijas finansēšana', 'pamatotas aizdomas'],
  et: ['rahapesu', 'pettus', 'sanktsioonid', 'terrorism', 'terrorismi rahastamine', 'altkäemaks', 'korruptsioon', 'omastamine', 'vahistatud', 'süüdi mõistetud', 'inimkaubandus', 'salakaubavedu'],
  mk: ['перење пари', 'измама', 'санкции', 'тероризам', 'финансирање на тероризам', 'поткуп', 'корупција', 'проневера', 'уапсен', 'осуден', 'трговија со луѓе', 'криумчарење'],
  /* Added 2026-10-08 with the te-IN, ml-IN and gu-IN Google News editions. Deliberately small:
     each term below was counted in the headlines those editions actually returned on 2026-10-08
     (the audit fetch, query = the money-laundering term), not taken from a dictionary. Counts:
     te (71 items): మనీ లాండరింగ్ 14, అరెస్ట్ 5, అరెస్టు 2, మోసం 1, అవినీతి 1;
     ml (96 items): കള്ളപ്പണം വെളുപ്പിക്കൽ 28, തട്ടിപ്പ് 2, അറസ്റ്റ് 2, അഴിമതി 1;
     gu (100 items): મની લોન્ડરિંગ 43, કૌભાંડ 8, ધરપકડ 6, છેતરપિંડી 5, દોષિત 1.
     Sanctions / terrorism / bribery terms are not added for these languages yet: the audit
     feeds did not exercise them, and an unverified term is worse than none. */
  te: ['మనీ లాండరింగ్', 'మోసం', 'అవినీతి', 'అరెస్ట్', 'అరెస్టు'],
  ml: ['കള്ളപ്പണം വെളുപ്പിക്കൽ', 'തട്ടിപ്പ്', 'അഴിമതി', 'അറസ്റ്റ്'],
  gu: ['મની લોન્ડરિંગ', 'છેતરપિંડી', 'કૌભાંડ', 'ધરપકડ', 'દોષિત']
};

/* Union of every language's terms — the term set used when scoring the merged,
   multi-locale item stream. */
export const ALL_TERMS = [...new Set([...Object.values(LANG_TERMS).flat(), ...PY_PARITY_TERMS])];

/* "Strong" (escalating) predicates across languages: money laundering, sanctions
   (+ evasion), terrorism, terrorist financing. A hit on any of these → high band. */
const STRONG_LIST = [
  'money laundering', 'sanctions', 'sanctions evasion', 'terrorism', 'terrorist financing',
  'غسل الأموال', 'عقوبات', 'إرهاب', 'تمويل الإرهاب',
  'lavado de dinero', 'blanqueo de capitales', 'sanciones', 'terrorismo', 'financiación del terrorismo',
  "blanchiment d'argent", 'terrorisme', 'financement du terrorisme',
  'Geldwäsche', 'Sanktionen', 'Terrorismus', 'Terrorismusfinanzierung',
  'lavagem de dinheiro', 'sanções', 'financiamento do terrorismo',
  'отмывание денег', 'санкции', 'терроризм', 'финансирование терроризма',
  '洗钱', '制裁', '恐怖主义', '恐怖融资',
  'riciclaggio di denaro', 'sanzioni', 'finanziamento del terrorismo',
  'kara para aklama', 'yaptırımlar', 'terörizm', 'terörün finansmanı',
  'マネーロンダリング', '資金洗浄', 'テロ資金供与',
  '자금세탁', '테러', '테러자금',
  'मनी लॉन्ड्रिंग', 'आतंकवाद', 'आतंकी वित्तपोषण',
  'pencucian uang', 'terorisme', 'pendanaan terorisme',
  'پولشویی', 'تروریسم', 'تأمین مالی تروریسم',
  'منی لانڈرنگ', 'دہشت گردی',
  'відмивання грошей', 'санкції', 'тероризм', 'фінансування тероризму',
  'witwassen', 'sancties', 'terrorisme', 'terrorismefinanciering',
  // High-risk-region languages (2026-08-05): money laundering / sanctions / terrorism / TF predicates
  'pul yuyulması', 'çirkli pulların yuyulması', 'sanksiyalar', 'terrorçuluq', 'terrorçuluğun maliyyələşdirilməsi',
  'ақшаны жылыстату', 'ақша жылыстату', 'санкциялар', 'терроризм', 'лаңкестік', 'терроризмді қаржыландыру', 'лаңкестікті қаржыландыру',
  'pul yuvish', 'jinoiy yo\'l bilan olingan pullarni legallashtirish', 'terrorizm', 'terrorizmni moliyalashtirish',
  'ფულის გათეთრება', 'სანქციები', 'ტერორიზმი', 'ტერორიზმის დაფინანსება',
  'փողերի լվացում', 'դրամի լվացում', 'պատժամիջոցներ', 'սանկցիաներ', 'ահաբեկչություն', 'ահաբեկչության ֆինանսավորում',
  'सम्पत्ति शुद्धीकरण', 'प्रतिबन्ध', 'आतंकवाद', 'आतंकवादी वित्तपोषण',
  'මුදල් විශුද්ධිකරණය', 'සම්බාධක', 'ත්‍රස්තවාදය', 'ත්‍රස්තවාදී මූල්‍යකරණය',
  'ਮਨੀ ਲਾਂਡਰਿੰਗ', 'ਪਾਬੰਦੀਆਂ', 'ਅੱਤਵਾਦ', 'ਅੱਤਵਾਦੀ ਫੰਡਿੰਗ',
  'मनी लाँडरिंग', 'निर्बंध', 'दहशतवाद', 'दहशतवादी अर्थपुरवठा',
  'ငွေကြေးခဝါချမှု', 'ပိတ်ဆို့အရေးယူမှု', 'အကြမ်းဖက်ဝါဒ', 'အကြမ်းဖက်မှုကို ငွေကြေးထောက်ပံ့မှု',
  'ការសម្អាតប្រាក់', 'ទណ្ឌកម្ម', 'ភេរវកម្ម', 'ការផ្តល់ហិរញ្ញប្បទានដល់ភេរវកម្ម',
  'ການຟອກເງິນ', 'ມາດຕະການຄວ່ຳບາດ', 'ການກໍ່ການຮ້າຍ', 'ການສະໜອງທຶນໃຫ້ການກໍ່ການຮ້າຍ',
  'halasta kuɗin haram', 'takunkumi', 'ta\'addanci', 'tallafin ta\'addanci',
  'dhaqidda lacagta', 'cunaqabatayn', 'argagixiso', 'maalgelinta argagixisada',
  'ሕገ-ወጥ የገንዘብ ዝውውር', 'ማዕቀብ', 'ሽብርተኝነት', 'ሽብርተኝነትን በገንዘብ መደገፍ',
  'geldwassery', 'sanksies', 'terrorisme', 'terreurfinansiering',
  'pastrim parash', 'sanksione', 'terrorizëm', 'financim i terrorizmit',
  'pranje novca', 'sankcije', 'terorizam', 'financiranje terorizma',
  'pranje denarja', 'terorizem',
  'pinigų plovimas', 'sankcijos', 'terorizmas', 'terorizmo finansavimas',
  'naudas atmazgāšana', 'sankcijas', 'terorisms', 'terorisma finansēšana',
  'rahapesu', 'sanktsioonid', 'terrorism', 'terrorismi rahastamine',
  'перење пари', 'санкции', 'тероризам', 'финансирање на тероризам',
  'మనీ లాండరింగ్', 'കള്ളപ്പണം വെളുപ്പിക്കൽ', 'મની લોન્ડરિંગ'
];
const STRONG_TERMS = new Set(STRONG_LIST);

/* ── Worldwide Google News locale matrix ──────────────────────────────────────
   { id, hl (UI language), gl (country), ceid (country:lang), lang (LANG_TERMS
   key) }. Regional English editions (US/GB/IN/AE/…) are kept separate because
   local press differs; non-English locales query their own language's terms.
   Tunable at runtime with ADVERSE_MEDIA_LOCALES (comma-separated ids). */
export const LOCALES = [
  /* AUDITED 2026-09-26: every entry above and below was re-tested live against Google News RSS
     (randomized order, 2.5s spacing, checked twice) by comparing the response's OWN <language> tag
     to what this entry claims - not just checking for http 200, which is what let the removed
     entries slip in as "edition-confirmed" on 2026-08-05 despite silently returning a DIFFERENT
     edition (fa-IR, ur-PK, tl-PH, da-DK, sw-KE, sw-TZ, az-AZ, kk-KZ, ka-GE, hy-AM, ne-NP, si-LK,
     my-MM, km-KH, af-ZA, sq-AL, hr-HR - 17 entries removed, each one verified to have no working
     hl/gl combination, not just the one on file). A false 'confirmed' entry is worse than no entry:
     it reports a language as screened when it silently was not. Going forward, "edition-confirmed"
     for a new locale means the response's own <language>/ceid metadata was checked to match, not
     just that the request returned 200 - see the audit method in PR discussion for the exact test. */

  // English — global regional editions
  { id: 'en-US', hl: 'en-US', gl: 'US', ceid: 'US:en', lang: 'en' },
  { id: 'en-GB', hl: 'en-GB', gl: 'GB', ceid: 'GB:en', lang: 'en' },
  { id: 'en-IN', hl: 'en-IN', gl: 'IN', ceid: 'IN:en', lang: 'en' },
  { id: 'en-AE', hl: 'en-AE', gl: 'AE', ceid: 'AE:en', lang: 'en' },
  { id: 'en-SG', hl: 'en-SG', gl: 'SG', ceid: 'SG:en', lang: 'en' },
  { id: 'en-AU', hl: 'en-AU', gl: 'AU', ceid: 'AU:en', lang: 'en' },
  { id: 'en-NG', hl: 'en-NG', gl: 'NG', ceid: 'NG:en', lang: 'en' },
  { id: 'en-ZA', hl: 'en-ZA', gl: 'ZA', ceid: 'ZA:en', lang: 'en' },
  { id: 'en-PK', hl: 'en-PK', gl: 'PK', ceid: 'PK:en', lang: 'en' },
  { id: 'en-PH', hl: 'en-PH', gl: 'PH', ceid: 'PH:en', lang: 'en' },
  // Arabic
  { id: 'ar-AE', hl: 'ar', gl: 'AE', ceid: 'AE:ar', lang: 'ar' },
  { id: 'ar-SA', hl: 'ar', gl: 'SA', ceid: 'SA:ar', lang: 'ar' },
  { id: 'ar-EG', hl: 'ar', gl: 'EG', ceid: 'EG:ar', lang: 'ar' },
  // Spanish
  { id: 'es-ES', hl: 'es', gl: 'ES', ceid: 'ES:es', lang: 'es' },
  { id: 'es-MX', hl: 'es-419', gl: 'MX', ceid: 'MX:es-419', lang: 'es' },
  { id: 'es-AR', hl: 'es-419', gl: 'AR', ceid: 'AR:es-419', lang: 'es' },
  // French
  { id: 'fr-FR', hl: 'fr', gl: 'FR', ceid: 'FR:fr', lang: 'fr' },
  { id: 'fr-CA', hl: 'fr', gl: 'CA', ceid: 'CA:fr', lang: 'fr' },
  // German
  { id: 'de-DE', hl: 'de', gl: 'DE', ceid: 'DE:de', lang: 'de' },
  { id: 'de-CH', hl: 'de', gl: 'CH', ceid: 'CH:de', lang: 'de' },
  // Portuguese
  { id: 'pt-BR', hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-419', lang: 'pt' },
  { id: 'pt-PT', hl: 'pt-PT', gl: 'PT', ceid: 'PT:pt-150', lang: 'pt' },
  // Russian / Ukrainian
  { id: 'ru-RU', hl: 'ru', gl: 'RU', ceid: 'RU:ru', lang: 'ru' },
  { id: 'uk-UA', hl: 'uk', gl: 'UA', ceid: 'UA:uk', lang: 'uk' },
  // Chinese
  { id: 'zh-CN', hl: 'zh-CN', gl: 'CN', ceid: 'CN:zh-Hans', lang: 'zh' },
  { id: 'zh-TW', hl: 'zh-TW', gl: 'TW', ceid: 'TW:zh-Hant', lang: 'zh' },
  { id: 'zh-HK', hl: 'zh-HK', gl: 'HK', ceid: 'HK:zh-Hant', lang: 'zh' },
  // Other major languages
  { id: 'it-IT', hl: 'it', gl: 'IT', ceid: 'IT:it', lang: 'it' },
  { id: 'tr-TR', hl: 'tr', gl: 'TR', ceid: 'TR:tr', lang: 'tr' },
  { id: 'ja-JP', hl: 'ja', gl: 'JP', ceid: 'JP:ja', lang: 'ja' },
  { id: 'ko-KR', hl: 'ko', gl: 'KR', ceid: 'KR:ko', lang: 'ko' },
  { id: 'hi-IN', hl: 'hi', gl: 'IN', ceid: 'IN:hi', lang: 'hi' },
  { id: 'id-ID', hl: 'id', gl: 'ID', ceid: 'ID:id', lang: 'id' },
  { id: 'nl-NL', hl: 'nl', gl: 'NL', ceid: 'NL:nl', lang: 'nl' },
  // ── Extended worldwide coverage (weaponised global sweep) ──
  // More MENA / Gulf
  { id: 'ar-QA', hl: 'ar', gl: 'QA', ceid: 'QA:ar', lang: 'ar' },
  { id: 'ar-KW', hl: 'ar', gl: 'KW', ceid: 'KW:ar', lang: 'ar' },
  { id: 'ar-BH', hl: 'ar', gl: 'BH', ceid: 'BH:ar', lang: 'ar' },
  { id: 'ar-OM', hl: 'ar', gl: 'OM', ceid: 'OM:ar', lang: 'ar' },
  { id: 'ar-JO', hl: 'ar', gl: 'JO', ceid: 'JO:ar', lang: 'ar' },
  { id: 'ar-LB', hl: 'ar', gl: 'LB', ceid: 'LB:ar', lang: 'ar' },
  { id: 'ar-IQ', hl: 'ar', gl: 'IQ', ceid: 'IQ:ar', lang: 'ar' },
  { id: 'ar-MA', hl: 'ar', gl: 'MA', ceid: 'MA:ar', lang: 'ar' },
  { id: 'he-IL', hl: 'he', gl: 'IL', ceid: 'IL:he', lang: 'he' },
  // More Asia
  { id: 'th-TH', hl: 'th', gl: 'TH', ceid: 'TH:th', lang: 'th' },
  { id: 'vi-VN', hl: 'vi', gl: 'VN', ceid: 'VN:vi', lang: 'vi' },
  { id: 'ms-MY', hl: 'ms', gl: 'MY', ceid: 'MY:ms', lang: 'ms' },
  { id: 'bn-BD', hl: 'bn', gl: 'BD', ceid: 'BD:bn', lang: 'bn' },
  { id: 'ta-IN', hl: 'ta', gl: 'IN', ceid: 'IN:ta', lang: 'ta' },
  // More Europe
  { id: 'pl-PL', hl: 'pl', gl: 'PL', ceid: 'PL:pl', lang: 'pl' },
  { id: 'sv-SE', hl: 'sv', gl: 'SE', ceid: 'SE:sv', lang: 'sv' },
  { id: 'no-NO', hl: 'no', gl: 'NO', ceid: 'NO:no', lang: 'no' },
  { id: 'fi-FI', hl: 'fi', gl: 'FI', ceid: 'FI:fi', lang: 'fi' },
  { id: 'el-GR', hl: 'el', gl: 'GR', ceid: 'GR:el', lang: 'el' },
  { id: 'ro-RO', hl: 'ro', gl: 'RO', ceid: 'RO:ro', lang: 'ro' },
  { id: 'cs-CZ', hl: 'cs', gl: 'CZ', ceid: 'CZ:cs', lang: 'cs' },
  { id: 'sk-SK', hl: 'sk', gl: 'SK', ceid: 'SK:sk', lang: 'sk' },
  { id: 'hu-HU', hl: 'hu', gl: 'HU', ceid: 'HU:hu', lang: 'hu' },
  { id: 'bg-BG', hl: 'bg', gl: 'BG', ceid: 'BG:bg', lang: 'bg' },
  { id: 'sr-RS', hl: 'sr', gl: 'RS', ceid: 'RS:sr', lang: 'sr' },
  // More Africa / South Asia English + Swahili
  { id: 'en-KE', hl: 'en-KE', gl: 'KE', ceid: 'KE:en', lang: 'en' },
  { id: 'en-GH', hl: 'en-GH', gl: 'GH', ceid: 'GH:en', lang: 'en' },
  // More Latin America
  { id: 'es-CO', hl: 'es-419', gl: 'CO', ceid: 'CO:es-419', lang: 'es' },
  { id: 'es-CL', hl: 'es-419', gl: 'CL', ceid: 'CL:es-419', lang: 'es' },
  { id: 'es-PE', hl: 'es-419', gl: 'PE', ceid: 'PE:es-419', lang: 'es' },
  // ── High-risk-region editions (2026-08-05, edition-confirmed languages) ──
  // Central Asia & Caucasus
  // South & Southeast Asia
  { id: 'pa-IN', hl: 'pa', gl: 'IN', ceid: 'IN:pa', lang: 'pa' },
  { id: 'mr-IN', hl: 'mr', gl: 'IN', ceid: 'IN:mr', lang: 'mr' },
  // Africa
  // Balkans & Baltics
  { id: 'sl-SI', hl: 'sl', gl: 'SI', ceid: 'SI:sl', lang: 'sl' },
  { id: 'lt-LT', hl: 'lt', gl: 'LT', ceid: 'LT:lt', lang: 'lt' },
  { id: 'lv-LV', hl: 'lv', gl: 'LV', ceid: 'LV:lv', lang: 'lv' },
  { id: 'et-EE', hl: 'et', gl: 'EE', ceid: 'EE:et', lang: 'et' },

  /* AUDITED 2026-09-27: added after cross-referencing every enabled country in
     sanctions-extra.json against this list to find countries with active
     sanctions screening but zero local-language news coverage. Same method as
     the 2026-09-26 audit above: -L to follow redirects, then compare the
     redirect's own gl/ceid AND actual article content against an
     already-confirmed edition for that country/language, not just HTTP 200.
     Tried and REJECTED (silently substitutes a DIFFERENT country's edition -
     confirmed no distinct Google News RSS edition exists for these):
       lk-LK (en-LK -> silently served en-US)
       mc-MC (fr-MC -> silently served fr-FR, gl changed MC to FR)
       tn-TN (ar + gl=TN -> silently served EG's Arabic edition)
       mu-MU (en-MU -> silently served en-US)
       kg-KG (ru + gl=KG -> silently served RU's Russian edition)
       fr-LB (fr + gl=LB -> silently served FR:fr; 2026-09-28, 34 items, all
              French outlets e.g. lemonde.fr / lefigaro.fr, no Lebanese press.
              Candidate taken from an external project's feed list, then
              tested with the method above)
     Do not re-add these without a materially different query - they were
     tested, not merely absent. */
  { id: 'en-NZ', hl: 'en-NZ', gl: 'NZ', ceid: 'NZ:en', lang: 'en' },
  { id: 'nl-BE', hl: 'nl', gl: 'BE', ceid: 'BE:nl', lang: 'nl' },
  { id: 'fr-BE', hl: 'fr', gl: 'BE', ceid: 'BE:fr', lang: 'fr' },

  /* AUDITED 2026-09-28: each candidate fetched live (the RSS search endpoint,
     query "money laundering" or its local-language form) and compared with an
     already-confirmed edition of the same language on the same query: the
     final ceid must equal the requested one, AND the article set must differ
     from the confirmed edition, AND the country's own press must be present.
     Accepted, with the measured evidence:
       en-IE  kept IE:en; 19/100 sources on .ie (RTE, Irish Times); 53/100 overlap with US:en
       en-CA  kept CA:en; 9/100 sources on .ca (CBC, gov.bc.ca); 72/100 with US:en, 56/100 with IE:en
       de-AT  kept AT:de; 25/100 sources on .at (Kurier, WKO); 50/100 overlap with DE:de
       es-US  kept US:es-419; 13/100 US Spanish-language outlets (Telemundo, Univision),
              none in US:en; 41/100 overlap with MX:es-419
     Tried and REJECTED:
       da-DK  (DK:da -> silently served NO:no, the Norwegian edition)
       en-TZ, en-UG, en-ZW, en-BW, en-NA, en-ET  (ceid kept, but 0-1/100 sources on
              the country's own domain and 82-94/100 identical to EACH OTHER: one
              generic international-English feed echoing the requested ceid, not
              six country editions)
       es-VE  (0/100 .ve sources; 73/100 identical to US:es-419)
       fr-SN  (0/100 .sn sources; 72/100 identical to FR:fr)
     Second batch, same day and method:
       en-MY  ACCEPTED: kept MY:en; Malaysian press present (thestar.com.my,
              freemalaysiatoday.com; 5/100 on .my); 64/100 overlap with US:en and
              71/100 with the generic English feed (whose members share 82-94/100)
       fr-MA  ACCEPTED: kept MA:fr; 9/100 sources on .ma (le360.ma); 69/100 overlap
              with FR:fr (French-language Moroccan press, alongside ar-MA)
       REJECTED: pt-AO (-> silently served PT:pt-150); es-UY, es-EC, es-PA,
              es-DO, es-CR (all five -> silently served US:es-419, byte-identical);
              fr-CI (-> silently served FR:fr)
     Same rule as the audits above: do not re-add without new evidence. */
  { id: 'en-IE', hl: 'en-IE', gl: 'IE', ceid: 'IE:en', lang: 'en' },
  { id: 'en-CA', hl: 'en-CA', gl: 'CA', ceid: 'CA:en', lang: 'en' },
  { id: 'de-AT', hl: 'de', gl: 'AT', ceid: 'AT:de', lang: 'de' },
  { id: 'es-US', hl: 'es-419', gl: 'US', ceid: 'US:es-419', lang: 'es' },
  { id: 'en-MY', hl: 'en-MY', gl: 'MY', ceid: 'MY:en', lang: 'en' },
  { id: 'fr-MA', hl: 'fr', gl: 'MA', ceid: 'MA:fr', lang: 'fr' },

  /* AUDITED 2026-10-08: same method as 2026-09-28 (final ceid must equal the requested one,
     the country's own press must be present, and the article set must differ from an
     already-confirmed edition of the same language fetched with the same query). Accepted:
       fr-CH  kept CH:fr; 50/100 sources on .ch (24heures, rts, letemps, 20min); 39/100 overlap
              with FR:fr (query "blanchiment")
       te-IN  kept IN:te; 71 items, 49/71 from Telugu outlets (andhrajyothy, samayam, ap7am);
              no other Telugu edition exists to compare against
       ml-IN  kept IN:ml; 96 items, 56/96 from Malayalam outlets (doolnews, mathrubhumi, manorama)
       gu-IN  kept IN:gu; 100 items, 78/100 from Gujarati outlets (divyabhaskar, tv9gujarati)
     Tried and REJECTED (silently served another edition, or a generic feed):
       kn-IN (-> IN:hi, 0 items); es-CU (ceid kept, 3/100 .cu, 77/100 identical to US:es-419);
       ru-BY, ru-KZ, uz-UZ, mn-MN (-> RU:ru); fr-LU, fr-DZ, fr-TN, fr-CM (-> FR:fr);
       de-LU (-> DE:de); is-IS, en-MT, en-NP, en-MM, en-KH (-> US:en); el-CY (-> GR:el);
       ar-DZ, ar-LY, ar-SY, ar-YE, ar-SD, ar-PS (-> EG:ar); es-GT, es-BO, es-PY (-> US:es-419);
       pt-MZ (-> PT:pt-150).
     Not yet tested: es-HN, es-SV, es-NI, es-PR, en-JM, en-TT, en-ZM, en-RW, en-MW, en-BN,
       en-FJ, en-PG, pt-CV. Do not re-add a rejected id without new evidence. */
  { id: 'fr-CH', hl: 'fr', gl: 'CH', ceid: 'CH:fr', lang: 'fr' },
  { id: 'te-IN', hl: 'te', gl: 'IN', ceid: 'IN:te', lang: 'te' },
  { id: 'ml-IN', hl: 'ml', gl: 'IN', ceid: 'IN:ml', lang: 'ml' },
  { id: 'gu-IN', hl: 'gu', gl: 'IN', ceid: 'IN:gu', lang: 'gu' },
];

/* The locale set to sweep this run — all of LOCALES unless narrowed by the
   ADVERSE_MEDIA_LOCALES env (comma-separated ids), so an operator can dial
   coverage vs runtime without a code change. Unknown ids are ignored. */
export function activeLocales() {
  const sel = String(process.env.ADVERSE_MEDIA_LOCALES || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!sel.length) return LOCALES;
  const picked = LOCALES.filter(l => sel.includes(l.id));
  return picked.length ? picked : LOCALES;
}

/* ── Per-run locale BUDGET + rotation (screen.py parity) ─────────────────────
   Sweeping the full matrix per subject is the empirically-known way to get ZERO
   coverage, not more: the Python engine's workflow records that 14 locales ×
   16 workers tripped Google News' per-IP limiter and 805/838 subjects came back
   with no adverse-media coverage at all, while a small budget swept the whole
   book clean (weekly-adverse-media.yml, ADVERSE_LOCALES note). This side of the
   codebase ran ALL locales (70+) per subject with no cap — the same failure
   shape, silently. Port the Python fix: a budget (default 8 — the same default
   the Python workflow pins), the same pinned core editions every run, and a
   deterministic daily rotation over the remaining markets so every edition is
   swept within a bounded number of days instead of never. */
export const CORE_LOCALE_IDS = ['en-US', 'en-GB', 'en-AE', 'tr-TR', 'ar-AE'];

/* Ports screen.py _resolve_locale_count: "all"/"full"/"max"/"*" ⇒ the whole
   matrix; integers clamp to [1, total]; junk/unset ⇒ the safe default of 8. */
export function resolveLocaleBudget(raw, total) {
  const s = String(raw == null ? '' : raw).trim().toLowerCase();
  if (['all', 'full', 'max', '*'].includes(s)) return total;
  const n = Number.parseInt(s, 10);
  if (Number.isFinite(n) && /^[+-]?\d+$/.test(s)) return Math.max(1, Math.min(total, n));
  return Math.min(8, total);
}

/* The budgeted sweep for one run: the pinned core editions (the markets the
   book actually trades with), then a rotating daily window over the rest of
   the matrix. Deterministic in the UTC day, so a same-day re-run sweeps the
   same markets (reproducible evidence). Budget: ADVERSE_LOCALES (count — the
   same env name and semantics the Python engine uses). */
export function budgetedLocales(now = new Date(), budget = null, pool = LOCALES) {
  const total = pool.length;
  if (!total) return [];
  const b = Math.max(1, Math.min(total,
    budget != null ? budget : resolveLocaleBudget(process.env.ADVERSE_LOCALES, total)));
  const core = pool.filter(l => CORE_LOCALE_IDS.includes(l.id)).slice(0, b);
  const rest = pool.filter(l => !CORE_LOCALE_IDS.includes(l.id));
  const room = b - core.length;
  if (room <= 0 || !rest.length) return core.length ? core : pool.slice(0, b);
  const day = Math.floor(now.getTime() / 86400000);   // UTC day ordinal
  const start = ((day * room) % rest.length + rest.length) % rest.length;
  const picked = [];
  for (let i = 0; i < Math.min(room, rest.length); i++) picked.push(rest[(start + i) % rest.length]);
  return [...core, ...picked];
}

/* Runs to sweep every market once at this budget (0 ⇒ never: budget ≤ core). */
export function rotationCycleDays(budget = null, pool = LOCALES) {
  const total = pool.length;
  const b = Math.max(1, Math.min(total,
    budget != null ? budget : resolveLocaleBudget(process.env.ADVERSE_LOCALES, total)));
  const coreN = Math.min(pool.filter(l => CORE_LOCALE_IDS.includes(l.id)).length, b);
  const rest = total - coreN;
  if (!rest) return 1;
  const room = b - coreN;
  if (room <= 0) return 0;
  return Math.ceil(rest / room);
}

/* Build the Google News RSS search URL for a subject. The OR-joined risk terms
   keep it to a single request per locale. hl/gl/ceid pin English (US) results. */
export function adverseMediaUrl(name, terms = ADVERSE_TERMS) {
  const q = '"' + String(name).trim() + '" (' + terms.map(t => '"' + t + '"').join(' OR ') + ')';
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=en-US&gl=US&ceid=US:en';
}

/* Arabic-language Google News RSS — same shape, Arabic risk terms, AE/Arabic
   locale so Arabic-language press is returned. */
export function adverseMediaUrlAr(name, terms = ADVERSE_TERMS_AR) {
  const q = '"' + String(name).trim() + '" (' + terms.map(t => '"' + t + '"').join(' OR ') + ')';
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q) + '&hl=ar&gl=AE&ceid=AE:ar';
}

/* Generic per-locale Google News RSS URL: quotes the name, OR-joins that
   locale's language risk terms, and pins hl/gl/ceid. The ceid colon is left
   literal (URL-safe in a query value; Google requires the `country:lang` form).*/
export function adverseMediaUrlFor(name, loc) {
  const terms = LANG_TERMS[loc.lang] || ADVERSE_TERMS;
  const q = '"' + String(name).trim() + '" (' + terms.map(t => '"' + t + '"').join(' OR ') + ')';
  return 'https://news.google.com/rss/search?q=' + encodeURIComponent(q)
    + '&hl=' + encodeURIComponent(loc.hl) + '&gl=' + encodeURIComponent(loc.gl) + '&ceid=' + loc.ceid;
}

/* GDELT DOC 2.0 API — a free, no-key GLOBAL news index spanning 65+ languages
   and outlets that Google News RSS does not surface (it machine-translates, so
   English risk terms still reach non-English coverage). The worldwide backbone
   of the sweep; the per-locale Google News queries add regional depth. */
export const GDELT_RISK_TERMS = [
  'sanctions', 'sanctions evasion', 'money laundering', 'launder', 'fraud',
  'corruption', 'bribery', 'embezzlement', 'terrorism', 'terrorist financing',
  'proliferation financing', 'organized crime', 'cartel', 'trafficking',
  'smuggling', 'narcotics', 'tax evasion', 'ponzi', 'indicted', 'convicted',
  'arrested', 'investigation', 'raid', 'seized', 'asset freeze', 'blacklisted'
];
/* Typologies the SCORER has always known but the RETRIEVAL query never asked
   for. PY_PARITY_TERMS were added scoring-only and deliberately kept out of the
   Google News query, because that query is already ~1.5KB per locale and one
   Google rejects returns zero items — trading a scoring gap for a retrieval gap
   is a bad trade. That reasoning is sound for Google News and does NOT transfer
   to GDELT: GDELT is a separate engine, one request per subject, and its query
   carried only 26 terms. So an article about a subject's ransomware indictment,
   kleptocracy allegations or modern-slavery prosecution could be scored
   perfectly — if something else happened to surface it. Nothing asked.

   These are the typology terms worth RETRIEVING on, drawn from the FATF-shaped
   categories the scorer already recognises. Kept to terms specific enough to be
   evidence of the typology rather than generic newswire vocabulary. */
export const GDELT_EXTRA_TERMS = [
  // Financial crime
  'financial crime', 'economic crime', 'wire fraud', 'accounting fraud',
  'asset misappropriation', 'identity theft', 'pyramid scheme', 'insider trading',
  'market manipulation', 'counterfeiting', 'kickback', 'forgery', 'extortion',
  // Terrorist financing / proliferation
  'designated terrorist', 'extremist', 'radicalisation', 'militant',
  'weapons of mass destruction', 'chemical weapons', 'biological weapons',
  'arms trafficking', 'weapons smuggling', 'dual-use', 'export control',
  // Corruption / organised crime
  'kleptocracy', 'state capture', 'abuse of power', 'misuse of funds',
  'conflict of interest', 'mafia', 'human trafficking', 'drug trafficking',
  'people smuggling', 'forced labour', 'modern slavery', 'wildlife trafficking',
  // Cyber
  'cybercrime', 'ransomware', 'darknet',
  // Legal / enforcement status
  'prosecuted', 'prosecution', 'imprisonment', 'blackmail', 'debarred',
  'regulatory breach', 'litigation', 'felon', 'jail', 'murder', 'theft',
  // Stems of typologies already asked for in a longer form: GDELT matches whole
  // words, so "corruption" does not retrieve an article that only says
  // "corrupt".
  'corrupt', 'bribe', 'wmd', 'litigate', 'prosecute',
  // Genuinely missing from this file's term arrays before 2026-09-26 (verified, not assumed):
  'court case', 'fined', 'unlawful', 'verdict', 'tax fraud', 'vat fraud', 'cyber fraud',
  'financing of terrorism',
];

/* DELIBERATELY NOT RETRIEVED: 'politic'. The scorer keeps it as a weak-tier
   signal, which is right — but as a GDELT retrieval term it is the one entry on
   the typology list that would do harm. The query is name-scoped and GDELT caps
   a subject at 250 records, so for any public figure — and the PEP layer this
   screen now carries is 422,223 office-holders — "politic" returns ordinary
   political coverage that crowds genuine financial-crime reporting out of the
   cap. That trades real recall for noise, which is the opposite of the point.
   Scoring keeps it; retrieval does not ask for it. */

/* A GDELT query that the API rejects returns null from fetchSource, which costs
   the ENTIRE worldwide backbone for that subject — strictly worse than asking
   for fewer terms. So the extras are admitted only while the built query stays
   under a conservative length, and checkAdverseMedia falls back to the proven
   base set if the wide query fails. Expansion can add recall; it must never be
   able to subtract it. */
export const GDELT_QUERY_MAX = Number(process.env.GDELT_QUERY_MAX) || 1600;

export function gdeltTerms(name, extra = GDELT_EXTRA_TERMS, max = GDELT_QUERY_MAX) {
  const out = [...GDELT_RISK_TERMS];
  const len = (ts) => gdeltQueryString(name, ts).length;
  for (const t of extra) {
    if (out.includes(t)) continue;
    out.push(t);
    if (len(out) > max) { out.pop(); break; }
  }
  return out;
}

export function gdeltQueryString(name, terms) {
  return '"' + String(name).trim() + '" (' + terms.map(t => t.includes(' ') ? '"' + t + '"' : t).join(' OR ') + ')';
}

export function gdeltUrl(name, terms = gdeltTerms(name)) {
  const q = gdeltQueryString(name, terms);
  const span = String(process.env.ADVERSE_MEDIA_TIMESPAN || '12m');
  /* GDELT caps maxrecords at 250 — fetch at the API maximum by default: the
     screen's mandate is maximum worldwide recall, and this is one request per
     subject either way (volume, not request rate). Scoring downstream gates
     precision. ADVERSE_MEDIA_MAXRECORDS lowers it without a code change if a
     shared runner ever trips GDELT's per-IP throttle. */
  const maxRec = Math.max(1, Math.min(250, Number(process.env.ADVERSE_MEDIA_MAXRECORDS) || 250));
  return 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + encodeURIComponent(q)
    + '&mode=artlist&format=json&maxrecords=' + maxRec + '&sort=datedesc&timespan=' + encodeURIComponent(span);
}

/* A cooldown only admits one probe. Validated probe coverage, not elapsed
   time or a late pre-outage response, is what closes the circuit. */
export const ADVERSE_RECOVERY_COOLDOWN_MS = Math.min(900000,
  Math.max(1000, Number(process.env.ADVERSE_RECOVERY_COOLDOWN_MS) || 120000));
export const GDELT_BREAKER_AFTER = Number(process.env.GDELT_BREAKER_AFTER) || 5;
export const gdeltBreakerState = new RecoveryCircuit(GDELT_BREAKER_AFTER, ADVERSE_RECOVERY_COOLDOWN_MS);
export function resetGdeltBreaker() { gdeltBreakerState.reset(); }
export function gdeltBreakerPermit(nowMs = Date.now()) { return gdeltBreakerState.permit(nowMs); }
export function gdeltBreakerRecordSuccess(ticket = null) { gdeltBreakerState.success(ticket); }
export function gdeltBreakerRecordFailure(ticket = null) {
  if (gdeltBreakerState.failure(ticket)) {
    console.warn('adverse-media: GDELT circuit OPEN; coverage remains unavailable until a validated cooldown probe succeeds');
  }
}

const RSS_ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function decode(x) {
  const cp = n => { try { return String.fromCodePoint(n); } catch { return ''; } };
  return String(x).replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, n) => RSS_ENT[n])
    .replace(/&#(\d+);/g, (_, d) => cp(+d))                       // fromCodePoint: astral planes (>U+FFFF), not just the BMP
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => cp(parseInt(h, 16)));
}

/* Parse a Google News RSS feed → [{ title, link, source, date, description }].
   The description carries the article's first lines (HTML-wrapped): risk terms
   often sit below a neutral headline ("X steps back from board duties" …
   "follows his arrest last week"), so it is captured, tag-stripped and bounded
   for scoring alongside the title. */
export function parseRss(xml) {
  /* NULL means "could not ask", [] means "asked, nothing found" — fetchSource
     passes the distinction straight to checkAdverseMedia, which counts a null
     locale as failed coverage instead of a clean sweep. A body with no feed
     envelope at all is not an empty feed: Google News answers HTTP 200 with a
     consent/interstitial page when it throttles a runner IP, and scoring that
     as "no adverse media" cleared the subject on coverage that never ran. An
     RSS endpoint always returns a document, so absence of the envelope — not
     absence of items — is the failure signal. */
  const s = String(xml == null ? '' : xml);
  if (!/<(rss|feed|channel)\b/i.test(s)) return null;
  const items = [], re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(s))) {
    const b = m[1];
    const tag = n => { const t = new RegExp('<' + n + '\\b[^>]*>([\\s\\S]*?)<\\/' + n + '>').exec(b); return t ? decode(t[1]).trim() : ''; };
    const title = tag('title');
    if (!title) continue;
    const description = tag('description')
      .replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1000);
    items.push({ title, link: tag('link'), source: tag('source'), date: tag('pubDate'), description });
  }
  return items;
}

/* Corporate/legal-form and generic trade boilerplate. A real headline almost
   never carries the legal suffix ("Al Haramain General Trading LLC" is reported
   as "Al Haramain …"), so requiring EVERY such token to appear in the headline
   is a systematic false negative for exactly the UAE-corporate name shapes this
   deployment screens. These are dropped from the name-match token set (with a
   fallback to the full set when a name is nothing but boilerplate). */
const CORP_STOP_MEDIA = new Set([
  'llc','fze','fzc','fzco','fze','dmcc','dwc','pjsc','psc','pvt','ltd','limited',
  'plc','inc','incorporated','corp','corporation','co','company','group','holding',
  'holdings','international','intl','global','est','establishment','trading','trade',
  'general','commercial','contracting','industries','industrial','enterprises',
  'enterprise','services','service','investment','investments','sons','bros',
  'brothers','partners','associates','and','the','for',
]);
/* Score adverse-media items for a subject. Requires the customer name to appear
   in the headline (Google News OR-matches loosely) AND a risk term to be present,
   so we don't flag an unrelated article that merely shares a surname. Returns
   { hit, score, band, top, count, terms[] }. Pass ALL_TERMS to score a merged
   multi-language stream. */
export function scoreAdverseMedia(name, items, terms = ADVERSE_TERMS) {
  const nm = normalize(name);
  // Prefer tokens ≥3 chars; but for short multi-token names (e.g. "Xi Bo",
  // common in East-Asian names) that filter is empty — fall back to ≥2 so the
  // subject is still matchable rather than silently never flagged.
  let nameTokens = nm.split(' ').filter(t => t.length >= 3);
  if (!nameTokens.length) nameTokens = nm.split(' ').filter(t => t.length >= 2);
  // Drop corporate/legal boilerplate so a headline needn't carry "LLC / General
  // Trading" to match; keep the full set only when the name is all boilerplate.
  const sig = nameTokens.filter(t => !CORP_STOP_MEDIA.has(t));
  if (sig.length) nameTokens = sig;
  const matched = [];
  for (const it of (items || [])) {
    /* Scan the headline AND the description snippet: risk terms (and often
       the full subject name) sit below a neutral headline. Widening the
       haystack is strictly recall-monotone — a title-only match still holds. */
    const title = normalize(it.title);
    const desc = normalize(it.description || '');
    const hay = desc ? title + ' ' + desc : title;
    const hasName = nameTokens.length > 0 && nameTokens.every(t => hay.includes(t));
    if (!hasName) continue;
    const hitTerms = terms.filter(t => hay.includes(normalize(t)));
    if (!hitTerms.length) continue;
    matched.push({ ...it, terms: hitTerms });
  }
  if (!matched.length) return { hit: false, score: 0, band: 'low', top: null, count: 0, terms: [], tier: null };
  const strong = matched.some(a => a.terms.some(t => STRONG_TERMS.has(t)));
  /* weak-only: every matched term across every matched item is a generic —
     still a hit (flagged for the record), but tier 'weak' at 75/medium so
     consumers keep it out of escalation weight until corroborated. */
  const weakOnly = !strong && matched.every(a => a.terms.every(t => WEAK_TERMS.has(t)));
  const allTerms = [...new Set(matched.flatMap(a => a.terms))];
  return {
    hit: true,
    score: strong ? 90 : (weakOnly ? 75 : 80),
    band: strong ? 'high' : 'medium',
    top: matched[0],
    count: matched.length,
    terms: allTerms,
    tier: strong ? 'strong' : (weakOnly ? 'weak' : 'normal')
  };
}

function normalize(s) {
  return String(s == null ? '' : s).normalize('NFKD')
    // Strip ONLY combining marks — Latin diacritics (U+0300–U+036F) and Arabic
    // harakat/tatweel/superscript-alef — using explicit code points so the class
    // can never widen into base letters (Cyrillic, Arabic, Hebrew, …). So
    // "Muḥammad"→"muhammad" and "مُحَمَّد"→"محمد" normalise stably, while Cyrillic
    // ("санкции") and CJK ("洗钱") pass through intact.
    .replace(/[\u0300-\u036f\u0640\u064b-\u0655\u0670]/g, '')
    .toLowerCase()
    // Keep letters/numbers of ANY script (Latin + Arabic + Cyrillic + CJK + …);
    // previously [^a-z0-9] silently dropped all non-Latin, defeating cross-script matching.
    // Keep the remaining combining marks (\p{M}) too: Indic and Southeast-Asian scripts
    // write vowels and the virama as marks, so treating them as separators shredded
    // "राम" into "र म" and a native-script name never reached the >=2-char token
    // filter in scoreAdverseMedia (found 2026-10-08 while adding te/ml/gu).
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
}

/* Parse a GDELT DOC 2.0 artlist JSON response → [{ title, link, source, date }],
   the same item shape parseRss yields, so scoreAdverseMedia handles both.

   NULL means "could not ask", [] means "asked, nothing found" — and the caller
   depends on the difference: `gd !== null` is what marks GDELT as a working
   backbone, and a null makes the run partial (or errored, if Google News is
   down too) so a standing adverse-media match is carried forward instead of
   cleared. This used to return [] for ANY unparseable body, which is the
   silent-false-clear this repo exists to prevent: GDELT answers HTTP 200 with
   a plain-text complaint when a query is rejected and with an HTML error page
   when it is overloaded, and both were being scored as a clean sweep of the
   entire worldwide index.

   A body that is empty or whitespace is the one benign case — GDELT returns it
   for some zero-result queries — so that alone still means "nothing found". */
export function parseGdelt(body) {
  const raw = typeof body === 'string' ? body : null;
  if (raw !== null && raw.trim() === '') return [];
  let json;
  try { json = raw !== null ? JSON.parse(raw) : body; } catch { return null; }
  /* Valid JSON without an `articles` array is an error envelope, not a result
     set — GDELT's own zero-result shape is {"articles":[]}. */
  if (!json || typeof json !== 'object' || !Array.isArray(json.articles)) return null;
  const arts = json.articles;
  return arts.map(a => ({
    title: decode(String(a.title || '')),
    link: String(a.url || ''),
    source: String(a.domain || ''),
    date: String(a.seendate || '')
  })).filter(x => x.title);
}

/* Canonical identity of one article link: lowercase host minus www., path
   only — query/fragment stripped, so the SAME article re-served under rotating
   utm/tracking params ("?utm_source=rss" today, "?ncid=twitter" tomorrow)
   dedupes to one item instead of inflating counts. Empty for unparseable
   links (caller falls back to the normalized title). */
export function canonicalLink(link) {
  const m = /^https?:\/\/([^/?#]+)([^?#]*)/i.exec(String(link == null ? '' : link).trim());
  if (!m) return '';
  let host = m[1].toLowerCase();
  if (host.startsWith('www.')) host = host.slice(4);
  return host + m[2].replace(/\/+$/, '');
}

/* De-duplicate merged items across locales/sources by CANONICAL link
   (fallback: normalized title), so the same wire story surfaced in many
   editions — or the same URL under fresh tracking params — is counted once. */
export function dedupItems(items) {
  const seen = new Set(), out = [];
  for (const it of (items || [])) {
    const key = canonicalLink(it && it.link) || normalize(it && it.title);
    if (!key || seen.has(key)) continue;
    seen.add(key); out.push(it);
  }
  return out;
}

/* Source-credibility tier (1 best … 3 default) from data/source-credibility.json —
   ANNOTATION/ORDERING only, never a gate. Degrades quietly to all-tier-3 when
   the file is unavailable (ranking is quality-of-life, not a control). */
let SOURCE_TIERS = new Map();
try {
  const tiersData = JSON.parse(readFileSync(new URL('../data/source-credibility.json', import.meta.url), 'utf8'));
  for (const [tier, key] of [[1, 'tier1'], [2, 'tier2']]) {
    for (const dom of (tiersData[key] || [])) SOURCE_TIERS.set(String(dom).toLowerCase(), tier);
  }
} catch { /* ordering-only feature — engines run unaffected */ }

export function sourceTierFor(item) {
  const m = /^https?:\/\/([^/?#]+)/i.exec(String((item && (item.link || item.url)) || ''));
  if (m) {
    let host = m[1].toLowerCase();
    if (host.startsWith('www.')) host = host.slice(4);
    while (host) {
      const t = SOURCE_TIERS.get(host);
      if (t) return t;
      const dot = host.indexOf('.');
      if (dot < 0) break;
      host = host.slice(dot + 1);
    }
  }
  const name = String((item && item.source) || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (name) {
    for (const [dom, tier] of SOURCE_TIERS) {
      if (dom.split('.')[0] === name) return tier;
    }
  }
  return 3;
}

/* Fetch one source with a per-request timeout. Returns the parsed item array,
   or null on any failure (so the caller can tell "no hits" from "couldn't ask").
   `note(ok, status)` — optional per-result observer (the Google News breaker). */
export const GNEWS_MIN_INTERVAL_MS = Math.max(0, Number(process.env.GNEWS_MIN_INTERVAL_MS) || 400);
export const GDELT_MIN_INTERVAL_MS = Math.max(0, Number(process.env.GDELT_MIN_INTERVAL_MS) || 5000);
export const BING_MIN_INTERVAL_MS = Math.max(0, Number(process.env.BING_MIN_INTERVAL_MS) || 1000);
export const ADVERSE_BACKBONE_MAX_ATTEMPTS = Math.max(1,
  Math.min(5, Number(process.env.ADVERSE_BACKBONE_MAX_ATTEMPTS) || 5));

// Some providers return 429 without Retry-After. Back off the shared queue anyway.
export const ADVERSE_RATE_LIMIT_BACKOFF_MS = Math.min(900000,
  Math.max(1000, Number(process.env.ADVERSE_RATE_LIMIT_BACKOFF_MS) || 30000));

const _gnewsGate = new RequestStartGate(GNEWS_MIN_INTERVAL_MS);
const _gdeltGate = new RequestStartGate(GDELT_MIN_INTERVAL_MS);
const _bingGate = new RequestStartGate(BING_MIN_INTERVAL_MS);

export function resetAdverseMediaRateGates() {
  _gnewsGate.reset();
  _gdeltGate.reset();
  _bingGate.reset();
}

/* Fetch one source with a run-global start gate. The screening engine processes
   several subjects concurrently, and each subject also sweeps several locales.
   Without a gate those two concurrency layers multiplied into bursts of dozens
   of requests per second from one runner IP, which tripped Google/GDELT
   protection and degraded nearly the whole book. */
async function fetchSource(url, parse, accept, timeoutMs, note, gate = null, permit = null) {
  if (gate) await gate.wait();
  // Check admission AFTER queueing: an earlier request may have opened it.
  const ticket = permit ? permit() : null;
  if (permit && !ticket) return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal, redirect: 'follow',
      headers: { 'user-agent': 'HawkeyeSterling-AdverseMedia/1.0', Accept: accept }
    });
    if (!res.ok) {
      if (gate) gate.deferFor(retryAfterDelayMs(res.headers?.get?.('retry-after'))
        || (res.status === 429 ? ADVERSE_RATE_LIMIT_BACKOFF_MS : 0));
      if (note) note(false, res.status, ticket);
      return null;
    }
    const items = parse(await res.text());
    // HTTP 200 consent/error pages are not successful screening coverage.
    if (note) note(items !== null, res.status, ticket);
    return items;
  } catch { if (note) note(false, 0, ticket); return null; }
  finally { clearTimeout(t); }
}

/* Google News uses the same bounded recovery policy. Only the en-US global
   backbone may probe an open circuit; regional traffic waits for recovery. */
const GNEWS_BREAKER_AFTER = Math.max(1, Number(process.env.GNEWS_BREAKER_AFTER) || 25);
const _gnews = new RecoveryCircuit(GNEWS_BREAKER_AFTER, ADVERSE_RECOVERY_COOLDOWN_MS);
export function gnewsBreakerOpen() { return _gnews.open; }
export function resetGnewsBreaker() { _gnews.reset(); }
export function gnewsCanRequest(localeId = 'en-US', nowMs = Date.now()) {
  return !_gnews.open || (localeId === 'en-US' && _gnews.canRequest(nowMs));
}
export function gnewsBreakerPermit(localeId = 'en-US', nowMs = Date.now()) {
  return gnewsCanRequest(localeId, nowMs) ? _gnews.permit(nowMs) : null;
}
export function noteGnewsResult(ok, status, ticket = null) {
  if (ok) { _gnews.success(ticket); return; }
  if (ticket?.probe || [429, 403, 503, 0].includes(status)) {
    if (_gnews.failure(ticket)) {
      console.error('adverse-media: Google News circuit OPEN; only one en-US probe is admitted after cooldown');
    }
  }
}
function fetchGoogleNews(name, loc, timeoutMs) {
  if (!gnewsCanRequest(loc.id)) return Promise.resolve(null);
  return fetchSource(adverseMediaUrlFor(name, loc), parseRss,
    'application/rss+xml, application/xml, text/xml', timeoutMs,
    noteGnewsResult, _gnewsGate, () => gnewsBreakerPermit(loc.id));
}

/* ── Bing News RSS — independent THIRD news backbone (screen.py parity) ──────
   Google News and GDELT meter shared runner IPs independently and have both
   refused the same run before (the Python engine's 10-14 Jul record); Bing News
   serves a free, no-key RSS endpoint on a THIRD rate-limit pool, so worldwide
   headline recall needs three simultaneous refusals to go dark.
   Kill-switch: BING_NEWS=0 (same env as the Python engine). */
export function bingNewsUrl(name, terms = ADVERSE_TERMS) {
  const q = '"' + String(name).trim() + '" (' + terms.map(t => '"' + t + '"').join(' OR ') + ')';
  return 'https://www.bing.com/news/search?q=' + encodeURIComponent(q) + '&format=rss';
}

/* Run async `fn` over `items` with bounded concurrency, so a wide locale sweep
   does not fire dozens of simultaneous requests at one host (which Google News
   throttles). Preserves input order. */
export async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const width = Math.max(1, Math.min(limit, items.length));
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: width }, worker));
  return out;
}

/* One subject's GDELT fetch: the widened typology query first, then — only if
   GDELT refuses it — the proven base set, so the expansion can never cost the
   subject its worldwide backbone. Only a failure of BOTH counts toward the
   run-level breaker (a rejected long query is not a down feed). */
async function fetchGdelt(name, timeoutMs) {
  const ticket = gdeltBreakerPermit();
  if (!ticket) return null;
  const permit = () => gdeltBreakerState.accepts(ticket) ? ticket : null;
  const wide = gdeltTerms(name);
  let wideStatus = 0;
  const noteWide = (_ok, status) => { wideStatus = status; };
  let gd = await fetchSource(gdeltUrl(name, wide), parseGdelt,
    'application/json', timeoutMs, noteWide, _gdeltGate, permit);
  // A 429 is not a query rejection. A shorter query consumes the same quota.
  if (gd === null && wideStatus !== 429 && wide.length > GDELT_RISK_TERMS.length && permit()) {
    console.warn('adverse-media: GDELT rejected the widened query; retrying on the base term set');
    gd = await fetchSource(gdeltUrl(name, GDELT_RISK_TERMS), parseGdelt,
      'application/json', timeoutMs, null, _gdeltGate, permit);
  }
  if (gd === null) gdeltBreakerRecordFailure(ticket);
  else gdeltBreakerRecordSuccess(ticket);
  return gd;
}

/* Network: fetch + screen one subject's adverse media across the WORLDWIDE locale
   matrix (per-language Google News editions) plus GDELT's global index, merging
   and de-duplicating every item before scoring against ALL_TERMS (all languages).

   Degradation is honest, never a false clear:
   - errored → the two global backbones (en-US Google News AND GDELT) were both
     unreachable, so we effectively could not screen; the caller must not clear a
     standing adverse-media match.
   - partial → at least one backbone answered but some locales failed; coverage is
     narrowed, not absent.
   The return shape is a superset of the original { hit, score, band, top, count,
   terms } — existing callers are unaffected. Tunables: ADVERSE_MEDIA_LOCALES,
   ADVERSE_MEDIA_CONCURRENCY, ADVERSE_MEDIA_TIMESPAN, opts.{concurrency,locales}. */
export async function checkAdverseMedia(name, { timeoutMs = 20000, concurrency, locales } = {}) {
  const xmlAccept = 'application/rss+xml, application/xml, text/xml';
  const explicitIds = String(process.env.ADVERSE_MEDIA_LOCALES || '').trim();
  const localeSet = locales || (explicitIds ? activeLocales() : budgetedLocales());
  const conc = Math.max(1, concurrency || Number(process.env.ADVERSE_MEDIA_CONCURRENCY) || 6);
  const bingOn = process.env.BING_NEWS !== '0';

  // Independent providers start independently. GDELT queueing or a timeout
  // must not prevent Google News and Bing from being asked. Their own shared
  // gates still enforce pacing, and every response is validated before use.
  let bingStatus = 0;
  const fetchBing = async () => {
    let status = 0;
    const items = await fetchSource(bingNewsUrl(name), parseRss, xmlAccept, timeoutMs,
      (_ok, s) => { status = s; }, _bingGate);
    bingStatus = status;
    return items;
  };

  const [gd, initialBing, localeResults] = await Promise.all([
    fetchGdelt(name, timeoutMs),
    bingOn ? fetchBing() : Promise.resolve(null),
    mapPool(localeSet, conc, loc =>
      fetchGoogleNews(name, loc, timeoutMs).then(items => ({ id: loc.id, items }))),
  ]);
  let bgRaw = initialBing;
  let bingAttempts = bingOn ? 1 : 0;

  let retryAttempted = false;
  let retryRecovered = false;
  const firstEnUs = localeResults.find(r => r.id === 'en-US');
  const firstOk = !!((firstEnUs && firstEnUs.items !== null) || gd !== null || (bingOn && bgRaw !== null));
  const retryEnUs = (gnewsCanRequest('en-US') && (!firstEnUs || firstEnUs.items === null))
    ? localeSet.find(loc => loc.id === 'en-US')
    : null;

  if (!firstOk && ((bingOn && bgRaw === null) || retryEnUs)) {
    retryAttempted = true;
    const retryDelayMs = Math.max(0, Number(process.env.ADVERSE_BACKBONE_RETRY_MS) || 3000);

    /* Do not declare a subject unscreened on one transient Bing refusal. The
       previous path made exactly one immediate retry while the full-book sweep
       was still pressuring the provider, leaving 111/906 subjects with zero
       backbone coverage. Bing is the independent third pool, so give only the
       ZERO-coverage subjects a small bounded retry ladder. The run-global gate
       still serialises starts and honors Retry-After/429 deferrals. */
    while (bingOn && bgRaw === null && bingAttempts < ADVERSE_BACKBONE_MAX_ATTEMPTS) {
      const waitMs = retryDelayMs ? Math.min(30000, retryDelayMs * 2 ** Math.max(0, bingAttempts - 1)) : 0;
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
      bgRaw = await fetchBing();
      bingAttempts++;
    }

    /* Google en-US gets one recovery probe only when its breaker admits it.
       Never bypass the breaker just to turn an assurance badge green. */
    if (retryEnUs) {
      const items = await fetchGoogleNews(name, retryEnUs, timeoutMs);
      const idx = localeResults.findIndex(r => r.id === 'en-US');
      if (idx >= 0) localeResults[idx] = { id: 'en-US', items };
      else localeResults.push({ id: 'en-US', items });
    }
  }

  const bg = bgRaw === null ? null : bgRaw.map(it => ({ ...it, source: it.source || 'Bing News' }));
  const enUs = localeResults.find(r => r.id === 'en-US');
  const okLocales = localeResults.filter(r => r.items !== null);
  const backbones = {
    googleNews: okLocales.length > 0,
    googleNewsEnUs: !!(enUs && enUs.items !== null),
    gdelt: gd !== null,
    bingEnabled: bingOn,
    bing: bingOn && bg !== null,
  };
  const backboneOk = backbones.googleNewsEnUs || backbones.gdelt || backbones.bing;
  retryRecovered = retryAttempted && backboneOk;

  if (!backboneOk) {
    return {
      errored: true,
      error: 'global adverse-media backbones unreachable after bounded gated retries (Google News en-US + GDELT'
        + (bingOn ? ' + Bing News' : '') + ')',
      localesQueried: localeSet.length,
      backbones,
      backboneStatus: { bing: bingStatus, bingAttempts },
      retryAttempted,
      retryRecovered,
    };
  }

  const items = dedupItems([...okLocales.flatMap(r => r.items), ...(gd || []), ...(bg || [])]);
  const result = scoreAdverseMedia(name, items, ALL_TERMS);
  const sourcesOk = okLocales.length + (gd !== null ? 1 : 0) + (bingOn && bg !== null ? 1 : 0);
  const sourcesTotal = localeSet.length + 1 + (bingOn ? 1 : 0);
  const failed = sourcesTotal - sourcesOk;
  const fullMatrix = localeSet.length >= LOCALES.length;

  const out = {
    ...result,
    localesQueried: localeSet.length,
    fullMatrix,
    sourcesOk,
    sourcesFailed: failed,
    itemsScanned: items.length,
    backbones,
    backboneStatus: { bing: bingStatus, bingAttempts },
    retryAttempted,
    retryRecovered,
  };
  return failed ? { ...out, partial: true } : out;
}
