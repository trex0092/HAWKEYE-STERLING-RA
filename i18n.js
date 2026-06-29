/* Shared bilingual (EN/AR) engine for console.html + advisor.html.
   index.html carries its own embedded engine; all three share the hsra.lang
   key so the language choice is consistent across the suite.

   Machine-assisted UI translation for accessibility. The dynamic content on
   these pages (live console telemetry, the advisor Q&A corpus and tool
   playbooks) intentionally stays English until a qualified Arabic AML reviewer
   signs it off — surfaced via #i18nCaveat in Arabic mode. */
(function () {
  var LANG_KEY = 'hsra.lang';
  var I18N = {
    'nav.assessment': { en: 'Assessment', ar: 'التقييم' },
    'nav.console':    { en: 'Console', ar: 'لوحة العمليات' },
    'nav.advisor':    { en: 'Advisor', ar: 'المستشار' },
    'console.sub':    { en: 'Operations Console', ar: 'لوحة العمليات' }
  };
  function t(key, lang) { var e = I18N[key]; return e ? (e[lang] != null ? e[lang] : e.en) : null; }
  function getLang() { try { return localStorage.getItem(LANG_KEY) === 'ar' ? 'ar' : 'en'; } catch (e) { return 'en'; } }

  /* Note: the i18n CSS (caveat bar, #langToggle, [dir=rtl] inputs) lives in the
     page stylesheets (console.css / advisor.css), not injected at runtime, so the
     CSP needs no inline <style> (style-src stays 'self'). */

  function apply(lang) {
    lang = lang === 'ar' ? 'ar' : 'en';
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    var h = document.documentElement;
    if (h) { h.lang = lang; h.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr'); }
    var nodes = document.querySelectorAll ? document.querySelectorAll('[data-i18n]') : [];
    for (var i = 0; i < nodes.length; i++) {
      var v = t(nodes[i].getAttribute('data-i18n'), lang);
      if (v != null) nodes[i].textContent = v;
    }
    var tog = document.getElementById('langToggle'); if (tog) tog.textContent = lang === 'ar' ? 'EN' : 'عربي';
    var cav = document.getElementById('i18nCaveat'); if (cav) cav.classList.toggle('hidden', lang !== 'ar');
  }

  window.hsToggleLang = function () { apply(getLang() === 'ar' ? 'en' : 'ar'); };
  window.hsApplyLang = apply;

  function boot() { apply(getLang()); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
