/* MindFlex — Live activity ticker
 * Spec: docs/Screen-Specs.md §1.3 (Live Activity Ticker)
 */

const DEFAULT_TICKERS = [
  'Cognitive threat: keep your Memory above the AI line.',
  'Anonymous #4470 unlocked the MEM_SPEED_DEMON badge.',
  'AI does not get bored — neither should you.',
];

export class Ticker {
  constructor(trackEl) {
    this.track = trackEl;
    this.queue = [...DEFAULT_TICKERS];
    this.index = 0;
    this.interval = null;
    this.fallbackMessages = [...DEFAULT_TICKERS];
  }

  pushMessage(msg) {
    if (typeof msg === 'string' && msg.length > 0) {
      this.queue.push(msg);
    }
  }

  setMessages(messages) {
    this.queue = Array.isArray(messages) ? messages.slice() : [...DEFAULT_TICKERS];
    this.fallbackMessages = [...this.queue];
    this.index = 0;
  }

  render() {
    if (!this.track) return;
    const messages = this.queue.length > 0 ? this.queue : this.fallbackMessages;
    this.track.textContent = messages.join('   \u2022   ');
  }

  start() {
    if (this.interval) return;
    this.render();
    // Rotate the displayed message every 14s.
    this.interval = setInterval(() => {
      this.index = (this.index + 1) % Math.max(this.queue.length, 1);
      this.render();
    }, 14000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
}
