window.KINGS = window.KINGS || {};

const MONTH_LEN = 30;
const MONTH_NAMES = [
  'Kırağı', 'Filizlenme', 'Çiçeklenme', 'Yaz Başı', 'Hasat Öncesi', 'Hasat',
  'Bereket', 'Sararma', 'Sonbahar', 'İlk Kırağı', 'Karakış', 'Sonkış',
];

class Calendar {
  constructor(start) {
    this.baseYear = start.year;
    this.totalHours = ((start.day - 1) * 24) + start.hour;
    this.paused = false;
  }
  advance(hours) {
    if (!this.paused) this.totalHours += hours;
  }
  get hour() { return Math.floor(this.totalHours % 24); }
  get dayIndex() { return Math.floor(this.totalHours / 24); }
  get day() { return (this.dayIndex % 360) % MONTH_LEN + 1; }
  get monthIndex() { return Math.floor((this.dayIndex % 360) / MONTH_LEN); }
  get year() { return this.baseYear + Math.floor(this.dayIndex / 360); }
  isNight() { const h = this.hour; return h < 6 || h >= 20; }
  label() {
    const h = String(this.hour).padStart(2, '0');
    return `${this.day} ${MONTH_NAMES[this.monthIndex]}, ${this.year} — ${h}:00`;
  }
}

KINGS.Calendar = Calendar;
