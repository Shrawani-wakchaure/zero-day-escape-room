/**
 * Desk Chronometer Countdown Controller
 */
class ChronometerTimer {
  constructor() {
    this.displayEl = document.getElementById("chronometer-digits");
    this.statusEl = document.getElementById("chronometer-status");
    this.remainingSeconds = 1200;
    this.intervalId = null;
    this.isCompleted = false;
    this.isGameOver = false;
  }

  init(initialSeconds, isCompleted = false) {
    this.remainingSeconds = initialSeconds;
    this.isCompleted = isCompleted;
    this.render();

    if (!this.isCompleted && this.remainingSeconds > 0) {
      this.start();
    }
  }

  start() {
    if (this.intervalId) clearInterval(this.intervalId);

    this.intervalId = setInterval(() => {
      if (this.isCompleted) {
        clearInterval(this.intervalId);
        return;
      }

      if (this.remainingSeconds > 0) {
        this.remainingSeconds--;
        this.render();

        // Audio ticking when in critical danger (< 180s)
        if (this.remainingSeconds <= 180 && this.remainingSeconds % 5 === 0) {
          window.vintageAudio.chronometerAlert();
        }
      } else {
        clearInterval(this.intervalId);
        this.handleTimeExpired();
      }
    }, 1000);
  }

  sync(secondsRemaining, isCompleted) {
    this.remainingSeconds = secondsRemaining;
    this.isCompleted = isCompleted;
    this.render();

    if (this.isCompleted && this.intervalId) {
      clearInterval(this.intervalId);
      if (this.statusEl) {
        this.statusEl.textContent = "SYSTEM SECURED";
        this.statusEl.style.color = "#4be070";
      }
    }
  }

  render() {
    if (!this.displayEl) return;

    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    const formatted = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    this.displayEl.textContent = formatted;

    if (this.remainingSeconds <= 180 && !this.isCompleted) {
      this.displayEl.classList.add("warning");
      if (this.statusEl) {
        this.statusEl.textContent = "CRITICAL INTEGRITY";
        this.statusEl.style.color = "#ff4444";
      }
    } else {
      this.displayEl.classList.remove("warning");
      if (this.statusEl && !this.isCompleted) {
        this.statusEl.textContent = "INTEGRITY ACTIVE";
        this.statusEl.style.color = "#55d475";
      }
    }
  }

  handleTimeExpired() {
    this.isGameOver = true;
    const modal = document.getElementById("game-over-modal");
    if (modal) {
      modal.classList.add("active");
    }
    window.vintageAudio.rubberStampThump();
  }
}

window.chronometer = new ChronometerTimer();
