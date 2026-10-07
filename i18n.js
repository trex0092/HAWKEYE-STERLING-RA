/* Shared bilingual (EN/AR) engine for console.html + advisor.html.
   index.html carries its own embedded engine; all three share the hsra.lang
   key so the language choice is consistent across the suite.

   Scope: operational UI chrome only. Regulatory Q&A answers, tool playbooks,
   legal citations and filed-record prose intentionally stay English. */
(function () {
  var LANG_KEY = 'hsra.lang';
  var I18N = {
    'nav.assessment': { en: 'Assessment', ar: 'التقييم' },
    'nav.console': { en: 'Console', ar: 'لوحة العمليات' },
    'nav.advisor': { en: 'Advisor', ar: 'المستشار' },
    'nav.label': { en: 'Suite navigation', ar: 'التنقل بين صفحات المنظومة' },
    'skip.main': { en: 'Skip to main content', ar: 'تجاوز إلى المحتوى الرئيسي' },
    'session.remaining': { en: 'Time left in this unlocked session', ar: 'الوقت المتبقي في الجلسة المفتوحة' },

    'console.sub': { en: 'Operations Console', ar: 'لوحة العمليات' },
    'console.threatLevel': { en: 'THREAT LEVEL', ar: 'مستوى التهديد' },
    'console.processor': { en: 'PROCESSOR', ar: 'المعالج' },
    'console.uptime': { en: 'UPTIME', ar: 'مدة التشغيل' },
    'console.network': { en: 'NETWORK', ar: 'الشبكة' },
    'console.nominal': { en: 'NOMINAL', ar: 'طبيعي' },
    'console.secure': { en: 'SECURE', ar: 'آمنة' },
    'console.analystDuty': { en: '● AI ANALYST ON DUTY', ar: '● محلل الذكاء الاصطناعي المناوب' },
    'console.reassign': { en: 'Reassign Operator', ar: 'إعادة تعيين المشغّل' },
    'console.liveAlerts': { en: 'Live Alert Stream', ar: 'تدفق التنبيهات المباشر' },
    'console.refreshAsana': { en: 'Refresh from Asana', ar: 'تحديث من Asana' },
    'console.onDevice': { en: 'ON DEVICE', ar: 'على الجهاز' },
    'console.diligenceMix': { en: 'Diligence Mix', ar: 'توزيع العناية الواجبة' },
    'console.jurisdictionWatch': { en: 'Jurisdiction Watch', ar: 'مراقبة الاختصاصات' },
    'console.threat.critical': { en: 'CRITICAL', ar: 'حرج' },
    'console.threat.elevated': { en: 'ELEVATED', ar: 'مرتفع' },
    'console.threat.guarded': { en: 'GUARDED', ar: 'مراقَب' },
    'console.threat.nominal': { en: 'NOMINAL', ar: 'طبيعي' },
    'console.stat.entities': { en: 'Entities Monitored', ar: 'الكيانات الخاضعة للمراقبة' },
    'console.stat.alerts': { en: 'Open Alerts', ar: 'التنبيهات المفتوحة' },
    'console.stat.sanctions': { en: 'Sanctions Hits', ar: 'مطابقات العقوبات' },
    'console.stat.cleared': { en: 'Cases Cleared', ar: 'الحالات المكتملة' },
    'console.sub.complete': { en: '{n} complete', ar: '{n} مكتمل' },
    'console.sub.registerEncrypted': { en: 'register encrypted', ar: 'السجل مشفّر' },
    'console.sub.noEntities': { en: 'no entities yet', ar: 'لا توجد كيانات بعد' },
    'console.sub.overdueDraft': { en: '{overdue} overdue · {drafts} draft', ar: '{overdue} متأخرة · {drafts} مسودة' },
    'console.sub.overdue': { en: '{n} review overdue', ar: '{n} مراجعة متأخرة' },
    'console.sub.draft': { en: '{n} in draft', ar: '{n} مسودة' },
    'console.sub.noneOpen': { en: 'none open', ar: 'لا توجد عناصر مفتوحة' },
    'console.sub.doNotOnboard': { en: 'do not onboard', ar: 'لا تقم ببدء العلاقة' },
    'console.sub.noneFlagged': { en: 'none flagged', ar: 'لا توجد إشارات' },
    'console.sub.markedComplete': { en: 'marked complete', ar: 'تم تعليمها كمكتملة' },
    'console.sub.noneYet': { en: 'none yet', ar: 'لا توجد بعد' },
    'console.mix.empty': { en: 'No assessments yet — the diligence mix appears as entities are filed.', ar: 'لا توجد تقييمات بعد. سيظهر توزيع العناية الواجبة عند حفظ الكيانات.' },
    'console.mix.CDD': { en: 'CDD · Standard', ar: 'CDD · عناية واجبة معيارية' },
    'console.mix.SDD': { en: 'SDD · Enhanced monitoring', ar: 'SDD · مراقبة معززة' },
    'console.mix.EDD': { en: 'EDD · Enhanced', ar: 'EDD · عناية واجبة معززة' },
    'console.jur.empty': { en: 'No jurisdictions yet.', ar: 'لا توجد اختصاصات بعد.' },
    'console.sev.low': { en: 'Low', ar: 'منخفض' },
    'console.sev.med': { en: 'Med', ar: 'متوسط' },
    'console.sev.high': { en: 'High', ar: 'مرتفع' },
    'console.sev.proh': { en: 'Proh', ar: 'محظور' },
    'console.alert.encrypted': { en: 'This device’s register is encrypted — unlock it on the Assessment page to populate the console. Encrypted records are not counted here.', ar: 'سجل هذا الجهاز مشفّر. افتحه من صفحة التقييم لتعبئة لوحة العمليات. السجلات المشفّرة لا تُحتسب هنا.' },
    'console.alert.empty': { en: 'No assessments filed yet — file one in the Assessment tab to populate the console.', ar: 'لم يتم حفظ أي تقييم بعد. احفظ تقييماً من تبويب التقييم لتعبئة لوحة العمليات.' },
    'console.refreshing': { en: 'Refreshing from Asana…', ar: 'جارٍ التحديث من Asana…' },
    'console.refreshed': { en: 'Refreshed {n} from Asana', ar: 'تم تحديث {n} من Asana' },
    'console.refreshFailed': { en: '⚠ Refresh failed — the figures shown are NOT up to date. Try again.', ar: '⚠ فشل التحديث. الأرقام المعروضة غير محدثة. حاول مرة أخرى.' },
    'console.refreshNetworkFailed': { en: '⚠ Refresh failed (network) — the figures shown are NOT up to date. Try again.', ar: '⚠ فشل التحديث بسبب الشبكة. الأرقام المعروضة غير محدثة. حاول مرة أخرى.' },
    'console.band.CDD': { en: 'Customer Due Diligence', ar: 'العناية الواجبة بالعميل' },
    'console.band.SDD': { en: 'Simplified Due Diligence', ar: 'العناية الواجبة المبسطة' },
    'console.band.EDD': { en: 'Enhanced Due Diligence', ar: 'العناية الواجبة المعززة' },
    'console.band.PROHIBITED': { en: 'Prohibited — do not onboard', ar: 'محظور. لا تبدأ العلاقة' },

    'advisor.brand': { en: 'Hawkeye Sterling advisor.', ar: 'مستشار HAWKEYE STERLING.' },
    'advisor.tab.ask': { en: 'Ask the advisor', ar: 'اسأل المستشار' },
    'advisor.tab.qa': { en: 'Regulatory Q&A', ar: 'الأسئلة التنظيمية' },
    'advisor.tab.tools': { en: 'Super Tools', ar: 'الأدوات المتخصصة' },
    'advisor.hero.ready': { en: 'Ready when you are', ar: 'جاهز عندما تكون جاهزاً' },
    'advisor.hero.title': { en: 'Ask me anything about AML compliance.', ar: 'اسألني عن الامتثال لمكافحة غسل الأموال.' },
    'advisor.hero.lede': { en: 'Every answer comes with a cited legal basis, a clear decision guide, and the recommended next steps.', ar: 'كل إجابة تتضمن أساساً قانونياً موثقاً ودليل قرار واضحاً والخطوات التالية المقترحة.' },
    'advisor.hero.reviewing': { en: 'Reviewing the cited legal sources…', ar: 'جارٍ مراجعة المصادر القانونية المستشهد بها…' },
    'advisor.response': { en: 'Advisor response', ar: 'رد المستشار' },
    'advisor.youAsked': { en: 'You asked', ar: 'سؤالك' },
    'advisor.askAnother': { en: 'Ask another', ar: 'اسأل سؤالاً آخر' },
    'advisor.question': { en: 'Your question', ar: 'سؤالك' },
    'advisor.questionPlaceholder': { en: 'Ask a compliance question, e.g. what CDD applies to a cross-border gold shipment?', ar: 'اكتب سؤالاً عن الامتثال، مثلاً: ما العناية الواجبة المطلوبة لشحنة ذهب عبر الحدود؟' },
    'advisor.ask': { en: 'Ask the advisor', ar: 'اسأل المستشار' },
    'advisor.mode': { en: 'Mode', ar: 'الوضع' },
    'advisor.persona': { en: 'Advisor persona', ar: 'شخصية المستشار' },
    'advisor.mode.Speed': { en: 'Speed', ar: 'سريع' },
    'advisor.mode.Balanced': { en: 'Balanced', ar: 'متوازن' },
    'advisor.mode.Deep': { en: 'Deep', ar: 'متعمق' },
    'advisor.telemetry': { en: 'Advisor telemetry (on-device)', ar: 'قياسات المستشار (على الجهاز)' },
    'advisor.calls': { en: 'calls', ar: 'الاستدعاءات' },
    'advisor.today': { en: 'today', ar: 'اليوم' },
    'advisor.latencyP50': { en: 'latency p50', ar: 'زمن الاستجابة p50' },
    'advisor.latencyP95': { en: 'latency p95', ar: 'زمن الاستجابة p95' },
    'advisor.health': { en: 'health', ar: 'الحالة' },
    'advisor.healthy': { en: 'healthy', ar: 'سليم' },
    'advisor.lastFailed': { en: '⚠ last call failed', ar: '⚠ فشل آخر استدعاء' },
    'advisor.emptyQuestion': { en: 'Please enter a question for the advisor.', ar: 'يرجى إدخال سؤال للمستشار.' },
    'advisor.unavailable': { en: 'The advisor is unavailable — please try again.', ar: 'المستشار غير متاح حالياً. يرجى المحاولة مرة أخرى.' },
    'advisor.qa.title': { en: 'Regulatory Q&A', ar: 'الأسئلة التنظيمية' },
    'advisor.qa.desc': { en: 'Source-cited regulatory questions, grouped by topic and grounded in UAE Federal Decree-Law No. 10 of 2025, Cabinet Resolution No. (134) of 2025 and FATF. Pick a question to read its cited answer.', ar: 'أسئلة تنظيمية موثقة بالمصادر ومجمعة حسب الموضوع، ومستندة إلى المرسوم بقانون اتحادي لدولة الإمارات رقم 10 لسنة 2025 وقرار مجلس الوزراء رقم 134 لسنة 2025 ومعايير FATF. اختر سؤالاً لقراءة إجابته الموثقة.' },
    'advisor.qa.filter': { en: 'Filter questions…', ar: 'تصفية الأسئلة…' },
    'advisor.qa.noMatch': { en: 'No questions match “{q}”.', ar: 'لا توجد أسئلة مطابقة لـ «{q}».' },
    'advisor.citedBasis': { en: 'Cited basis', ar: 'الأساس المستشهد به' },
    'advisor.takeToAdvisor': { en: 'Take to the advisor', ar: 'انقل إلى المستشار' },
    'advisor.tools.title': { en: 'Super Tools', ar: 'الأدوات المتخصصة' },
    'advisor.tools.desc': { en: 'Specialist MLRO tools — every tool returns an instant, deterministic, citation-backed result keyed to the scenario. Pick a tool, fill the inputs, and run.', ar: 'أدوات متخصصة لمسؤول الإبلاغ عن غسل الأموال. تعيد كل أداة نتيجة فورية وحتمية ومدعومة بالمراجع وفق السيناريو. اختر أداة وأدخل البيانات ثم شغّلها.' },
    'advisor.tools.select': { en: 'Select tool', ar: 'اختر أداة' },
    'advisor.tools.run': { en: 'Run {tool}', ar: 'تشغيل {tool}' },
    'advisor.tools.escalation': { en: 'Get Escalation Decision', ar: 'احصل على قرار التصعيد' },
    'advisor.tools.context': { en: 'Case context / details', ar: 'سياق الحالة / التفاصيل' },
    'advisor.tools.contextPh': { en: 'Describe the scenario, transactions or behaviour. Use roles / categories (e.g. “a tier-1 PEP”, “a DPMS dealer”), not named parties.', ar: 'صِف السيناريو أو المعاملات أو السلوك. استخدم الأدوار أو الفئات بدلاً من أسماء الأطراف.' },
    'advisor.tools.subjectRequired': { en: 'Subject name is required.', ar: 'اسم الطرف مطلوب.' },
    'advisor.tools.contextRequired': { en: 'Please add some case context.', ar: 'يرجى إضافة سياق للحالة.' },
    'advisor.tools.compiling': { en: 'Compiling cited guidance…', ar: 'جارٍ إعداد الإرشادات الموثقة…' },
    'advisor.tools.brain': { en: 'Brain-powered analysis', ar: 'تحليل مدعوم بالمستشار الذكي' },
    'advisor.tools.deterministic': { en: 'Deterministic guidance', ar: 'إرشادات حتمية' },
    'advisor.tools.triggers': { en: 'Triggers & cited basis', ar: 'المحفزات والأساس المستشهد به' },
    'advisor.tools.recommended': { en: 'Recommended steps', ar: 'الخطوات المقترحة' },
    'advisor.tools.required': { en: 'Required actions', ar: 'الإجراءات المطلوبة' }
  };

  function raw(key, lang) {
    var e = I18N[key];
    return e ? (e[lang] != null ? e[lang] : e.en) : null;
  }
  function getLang() {
    try { return localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en'; }
    catch (e) { return 'en'; }
  }
  function format(value, vars) {
    var s = String(value == null ? '' : value);
    var v = vars || {};
    return s.replace(/\{([A-Za-z0-9_]+)\}/g, function (_, k) {
      return Object.prototype.hasOwnProperty.call(v, k) ? String(v[k]) : '{' + k + '}';
    });
  }
  function translate(key, vars) {
    var v = raw(key, getLang());
    return v == null ? null : format(v, vars);
  }

  function applyAttr(nodes, attr, keyAttr, lang) {
    for (var i = 0; i < nodes.length; i++) {
      var v = raw(nodes[i].getAttribute(keyAttr), lang);
      if (v != null) nodes[i].setAttribute(attr, v);
    }
  }

  function apply(lang) {
    lang = lang === 'ar' ? 'ar' : 'en';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    var h = document.documentElement;
    if (h) {
      h.lang = lang;
      if (h.setAttribute) h.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    }
    var nodes = document.querySelectorAll ? document.querySelectorAll('[data-i18n]') : [];
    for (var i = 0; i < nodes.length; i++) {
      var v = raw(nodes[i].getAttribute('data-i18n'), lang);
      if (v != null) nodes[i].textContent = v;
    }
    if (document.querySelectorAll) {
      applyAttr(document.querySelectorAll('[data-i18n-placeholder]'), 'placeholder', 'data-i18n-placeholder', lang);
      applyAttr(document.querySelectorAll('[data-i18n-aria]'), 'aria-label', 'data-i18n-aria', lang);
      applyAttr(document.querySelectorAll('[data-i18n-title]'), 'title', 'data-i18n-title', lang);
    }
    var tog = document.getElementById('langToggle');
    if (tog) tog.textContent = lang === 'ar' ? 'EN' : 'عربي';
    var cav = document.getElementById('i18nCaveat');
    if (cav) cav.classList.toggle('hidden', lang !== 'ar');

    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function' && typeof window.CustomEvent === 'function') {
      window.dispatchEvent(new window.CustomEvent('hsra:langchange', { detail: { lang: lang } }));
    }
  }

  window.hsT = translate;
  window.hsGetLang = getLang;
  window.hsToggleLang = function () { apply(getLang() === 'ar' ? 'en' : 'ar'); };
  window.hsApplyLang = apply;

  function boot() { apply(getLang()); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
