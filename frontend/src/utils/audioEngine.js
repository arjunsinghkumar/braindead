/**
 * Smooth tone generator for neurofeedback. Volume tracks `score` (0..1).
 */
export default class AudioFeedback {
  constructor({ frequency = 432, maxVolume = 0.3 } = {}) {
    this.maxVolume = maxVolume;
    this.frequency = frequency;
    this.ctx = null;
    this.osc = null;
    this.gain = null;
    this.started = false;
  }

  start() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    this.ctx = new Ctx();
    this.osc = this.ctx.createOscillator();
    this.gain = this.ctx.createGain();
    this.osc.type = "sine";
    this.osc.frequency.value = this.frequency;
    this.gain.gain.value = 0;
    this.osc.connect(this.gain);
    this.gain.connect(this.ctx.destination);
    this.osc.start();
    this.started = true;
  }

  setScore(score) {
    if (!this.started || !this.gain || !this.ctx) return;
    const target = Math.max(0, Math.min(1, score)) * this.maxVolume;
    const t = this.ctx.currentTime;
    this.gain.gain.cancelScheduledValues(t);
    this.gain.gain.linearRampToValueAtTime(target, t + 0.1);
  }

  stop() {
    if (!this.started) return;
    try {
      const t = this.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.linearRampToValueAtTime(0, t + 0.4);
      setTimeout(() => {
        try {
          this.osc.stop();
          this.ctx.close();
        } catch {}
        this.osc = null;
        this.gain = null;
        this.ctx = null;
        this.started = false;
      }, 500);
    } catch {}
  }
}
