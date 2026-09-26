// Populates the #hsra-legal-footer element with links to the privacy policy and terms pages.
// Deliberately a tiny, separate, same-origin script rather than inline markup or inline styles,
// consistent with this repo's own CSP convention (script-src 'self', style-src 'self', no
// 'unsafe-inline' anywhere) - see the netlify.toml header comment for why.
'use strict';

(function () {
  var footer = document.getElementById('hsra-legal-footer');
  if (!footer) return;

  footer.style.cssText = 'padding:14px 18px;text-align:center;font-family:Manrope,system-ui,sans-serif;'
    + 'font-size:.78rem;opacity:.6;border-top:1px solid rgba(255,255,255,.08)';

  var privacyLink = document.createElement('a');
  privacyLink.href = 'privacy-policy.html';
  privacyLink.textContent = 'Privacy Policy';
  privacyLink.style.cssText = 'color:inherit;text-decoration:none;margin:0 8px';

  var sep = document.createTextNode('·');

  var termsLink = document.createElement('a');
  termsLink.href = 'terms.html';
  termsLink.textContent = 'Terms';
  termsLink.style.cssText = 'color:inherit;text-decoration:none;margin:0 8px';

  footer.appendChild(privacyLink);
  footer.appendChild(sep);
  footer.appendChild(termsLink);
})();
