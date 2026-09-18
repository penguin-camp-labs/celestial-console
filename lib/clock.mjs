// Smooth only the displayed timestamp; astronomy continues at its existing rate.
export class DisplayClock {
  constructor() {
    this.from = 0;
    this.to = 0;
    this.start = 0;
    this.arrived = 0;
    this.duration = 100;
    this.active = false;
  }
  value(now) {
    const alpha = Math.max(0, Math.min(1, (now - this.start) / this.duration));
    return this.from + (this.to - this.from) * alpha;
  }
  sample(time, now, enabled) {
    if (!enabled || !this.active) {
      this.from = this.to = time;
      this.start = this.arrived = now;
      this.active = enabled;
      return time;
    }
    if (time !== this.to) {
      this.from = this.value(now);
      this.duration = Math.max(50, Math.min(200, now - this.arrived));
      this.to = time;
      this.start = this.arrived = now;
    }
    return this.value(now);
  }
}
