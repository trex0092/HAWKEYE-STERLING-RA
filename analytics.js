// Google Analytics 4 - consent-gated, CSP-safe (no inline scripts anywhere).
//
// *** REPLACE G-XXXXXXXXXX BELOW WITH THIS PROPERTY'S REAL GA4 MEASUREMENT ID BEFORE DEPLOY. ***
// This is a placeholder - Claude has no way to know or invent a real ID, and won't pretend to.
// Get yours from analytics.google.com > Admin > Data Streams > (your stream) > Measurement ID.
//
// Required CSP domains (already added to netlify.toml), per Google's own guidance:
//   script-src:  https://www.googletagmanager.com
//   connect-src: https://www.google-analytics.com https://*.analytics.google.com
// Sources: https://developers.google.com/tag-platform/tag-manager/web/csp
//          https://content-security-policy.com/examples/google-analytics/
//
// gtag.js is only requested after the visitor clicks Accept below - never on page load, and
// never during an automated test run - so this does not trip the lighthouse
// resource-summary:third-party:count:0 gate in lighthouserc.json.
'use strict';

const GA4_MEASUREMENT_ID = 'G-XXXXXXXXXX';
const CONSENT_KEY = 'hsra-analytics-consent';

window.dataLayer = window.dataLayer || [];
function gtag() { window.dataLayer.push(arguments); }

function loadGoogleAnalytics() {
  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA4_MEASUREMENT_ID);
  document.head.appendChild(s);
  gtag('js', new Date());
  gtag('config', GA4_MEASUREMENT_ID, { anonymize_ip: true });
}

function removeBanner(bar) {
  if (bar && bar.parentNode) bar.parentNode.removeChild(bar);
}

function showConsentBanner() {
  const bar = document.createElement('div');
  bar.id = 'analytics-consent-banner';
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', 'Analytics consent');
  // CSP-safe styling per this repo's own convention (netlify.toml comment): CSSOM, not inline style="".
  bar.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:9999;'
    + 'background:#0A0E16;color:#E6E9EF;padding:14px 18px;display:flex;gap:14px;'
    + 'align-items:center;justify-content:space-between;flex-wrap:wrap;'
    + 'font-family:Manrope,system-ui,sans-serif;font-size:.85rem;line-height:1.4;'
    + 'border-top:1px solid rgba(255,255,255,.12);box-shadow:0 -2px 10px rgba(0,0,0,.4)';

  const text = document.createElement('span');
  text.textContent = 'This site can use Google Analytics to understand how it is used. '
    + 'Your case data always stays on your device either way - see the ';
  const link = document.createElement('a');
  link.href = '/privacy-policy.html';
  link.textContent = 'privacy policy';
  link.style.cssText = 'color:#7DD3FC';
  text.appendChild(link);
  text.appendChild(document.createTextNode('.'));

  const btns = document.createElement('div');
  btns.style.cssText = 'display:flex;gap:8px;flex-shrink:0';

  const accept = document.createElement('button');
  accept.type = 'button';
  accept.textContent = 'Accept';
  const decline = document.createElement('button');
  decline.type = 'button';
  decline.textContent = 'Decline';
  [accept, decline].forEach((b) => {
    b.style.cssText = 'padding:6px 14px;border-radius:6px;border:1px solid rgba(255,255,255,.25);'
      + 'background:transparent;color:inherit;font:inherit;cursor:pointer';
  });

  accept.addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'granted');
    removeBanner(bar);
    loadGoogleAnalytics();
  });
  decline.addEventListener('click', () => {
    localStorage.setItem(CONSENT_KEY, 'denied');
    removeBanner(bar);
  });

  btns.appendChild(accept);
  btns.appendChild(decline);
  bar.appendChild(text);
  bar.appendChild(btns);
  document.body.appendChild(bar);
}

const existingConsent = localStorage.getItem(CONSENT_KEY);
if (existingConsent === 'granted') {
  loadGoogleAnalytics();
} else if (existingConsent !== 'denied') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', showConsentBanner);
  } else {
    showConsentBanner();
  }
}
