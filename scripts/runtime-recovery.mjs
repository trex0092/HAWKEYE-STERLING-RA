/* Recovery is earned by a validated response, never by the passage of time.
   These helpers are dependency-free and do not issue network requests. */
export const MAX_RETRY_AFTER_MS = 15 * 60 * 1000;

export function retryAfterDelayMs(value, nowMs = Date.now()) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text || text.startsWith('-')) return 0;
  const delay = /^\d+$/.test(text) ? Number(text) * 1000 : Date.parse(text) - nowMs;
  return Number.isFinite(delay) ? Math.min(MAX_RETRY_AFTER_MS, Math.max(0, delay)) : 0;
}

/* One queue per provider. Re-check after sleeping: a response from another
   in-flight request may have extended the shared Retry-After deadline. */
export class RequestStartGate {
  constructor(intervalMs = 0) {
    this.intervalMs = Math.max(0, Number(intervalMs) || 0);
    this.nextAt = 0;
    this.tail = Promise.resolve();
  }

  deferFor(delayMs) {
    const delay = Math.min(MAX_RETRY_AFTER_MS, Math.max(0, Number(delayMs) || 0));
    this.nextAt = Math.max(this.nextAt, Date.now() + delay);
  }

  async wait() {
    let release;
    const prior = this.tail;
    this.tail = new Promise(resolve => { release = resolve; });
    await prior;
    try {
      while (this.nextAt > Date.now()) {
        await new Promise(resolve => setTimeout(resolve, this.nextAt - Date.now()));
      }
      this.nextAt = Date.now() + this.intervalMs;
    } finally {
      release();
    }
  }

  reset() {
    this.nextAt = 0;
    this.tail = Promise.resolve();
  }
}

/* Tickets bind results to the circuit generation that admitted the request.
   Late responses cannot close a newer outage or interfere with its probe. */
export class RecoveryCircuit {
  constructor(threshold, cooldownMs) {
    this.threshold = Math.max(1, Number(threshold) || 1);
    this.cooldownMs = Math.max(1000, Number(cooldownMs) || 120000);
    this.epoch = 0;
    this.reset();
  }

  reset() {
    this.consecutiveFailures = 0;
    this.open = false;
    this.retryAt = 0;
    this.probing = false;
    this.probeTicket = null;
    this.epoch++;
  }

  canRequest(nowMs = Date.now()) {
    return !this.open || (!this.probing && nowMs >= this.retryAt);
  }

  permit(nowMs = Date.now()) {
    if (!this.canRequest(nowMs)) return null;
    const ticket = { epoch: this.epoch, probe: this.open };
    if (this.open) {
      this.probing = true;
      this.probeTicket = ticket;
    }
    return ticket;
  }

  accepts(ticket) {
    return !!ticket && ticket.epoch === this.epoch
      && (!this.open || ticket === this.probeTicket);
  }

  success(ticket = null) {
    if (this.open) {
      if (ticket !== this.probeTicket || !ticket || !this.accepts(ticket)) return;
      this.reset();
    } else if (!ticket || this.accepts(ticket)) {
      this.consecutiveFailures = 0;
    }
  }

  failure(ticket = null) {
    if (ticket && !this.accepts(ticket)) return false;
    if (this.open) {
      if (!ticket) { this.consecutiveFailures++; return false; }
      this.consecutiveFailures++;
      this.retryAt = Date.now() + this.cooldownMs;
      this.probing = false;
      this.probeTicket = null;
      this.epoch++;
      return false;
    }
    this.consecutiveFailures++;
    if (this.consecutiveFailures < this.threshold) return false;
    this.open = true;
    this.retryAt = Date.now() + this.cooldownMs;
    this.epoch++;
    return true;
  }
}
