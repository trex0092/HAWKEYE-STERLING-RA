'use strict';

/* Optional shared-secret gate. Origin checks are only defense in depth; strict
 * token mode is required for confidential data. */
const crypto = require('crypto');

function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

function strictMode() {
  return /^(1|true|yes|on)$/i.test(String(process.env.APP_STRICT_TOKEN || ''));
}

function allowedOrigins() {
  const configured = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(value => value.trim().replace(/\/+$/, ''))
    .filter(Boolean);
  const site = String(process.env.URL || '').trim().replace(/\/+$/, '');
  const canonical = 'https://hawkeye-sterling-ra.netlify.app';
  return new Set([canonical, site, ...configured].filter(Boolean));
}

function requestOrigin(event) {
  const headers = (event && event.headers) || {};
  return String(headers.origin || headers.Origin || '').trim().replace(/\/+$/, '');
}

function originAllowed(event) {
  const origin = requestOrigin(event);
  return Boolean(origin) && allowedOrigins().has(origin);
}

function providedToken(event) {
  const headers = (event && event.headers) || {};
  return headers['x-app-token'] || headers['X-App-Token'] || '';
}

function tokenMatches(event, required) {
  const provided = providedToken(event);
  return Boolean(provided) && safeEqual(provided, required);
}

function sharedTokenOk(event) {
  const required = process.env.APP_SHARED_TOKEN;
  if (!required) return true;

  /* Non-strict mode permits only the configured same-origin browser path.
   * Arbitrary or forged Origin values must still present the token. */
  if (!strictMode() && originAllowed(event)) return true;
  return tokenMatches(event, required);
}

/* Data-bearing endpoints always require the token when configured. */
function dataTokenOk(event) {
  const required = process.env.APP_SHARED_TOKEN;
  if (!required) return true;
  return tokenMatches(event, required);
}

module.exports = { sharedTokenOk, dataTokenOk, strictMode };
