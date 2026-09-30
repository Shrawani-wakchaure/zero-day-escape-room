/**
 * Detective Desk Environment & Case Management
 */
class DeskManager {
  constructor() {
    this.currentRoom = "evidence_01";
    this.magnifierEnabled = false;
  }

  init(initialState) {
    this.currentRoom = initialState.current_room || "evidence_01";
    this.bindEvents();
    this.setupDetectiveCat();
    this.updateFolderTabs(initialState);
    this.switchRoom(this.currentRoom, false);

    // If game has already started, ensure active game view is visible
    if (initialState.game_started) {
      this.showGameView();
    } else {
      this.showDashboard();
    }

    // Apply any previously solved stamps in their dedicated stamp slots
    if (initialState.stamps) {
      Object.entries(initialState.stamps).forEach(([roomId, stampData]) => {
        this.applyStamp(roomId, stampData.text, false);
      });
    }
  }

  bindEvents() {
    // Dashboard / Switch Case Button
    const dashboardBtn = document.getElementById("btn-show-dashboard");
    if (dashboardBtn) {
      dashboardBtn.addEventListener("click", () => {
        window.vintageAudio.dialClick();
        this.toggleDashboard();
      });
    }

    // Select Case Buttons on the Intro Dashboard
    document.querySelectorAll(".btn-select-case").forEach(btn => {
      btn.addEventListener("click", async () => {
        const caseId = btn.getAttribute("data-case-id");
        const callsignInput = document.getElementById("dashboard-investigator-name");
        const callsign = (callsignInput ? callsignInput.value.trim() : "") || "Special Agent S.A.";

        window.vintageAudio.rubberStampThump();
        await this.selectCase(caseId, callsign);
      });
    });

    // Victory modal switch case button
    const victorySwitchBtn = document.getElementById("btn-victory-switch-case");
    if (victorySwitchBtn) {
      victorySwitchBtn.addEventListener("click", () => {
        document.getElementById("victory-modal")?.classList.remove("active");
        this.showDashboard();
      });
    }

    // Folder tab clicks
    document.querySelectorAll(".folder-tab").forEach(tab => {
      tab.addEventListener("click", () => {
        const roomId = tab.getAttribute("data-room");
        if (tab.classList.contains("locked")) {
          window.vintageAudio.dialClick();
          this.showFeedback("ACCESS RESTRICTED", "This evidence file is classified until preceding evidence is verified.", "info");
          return;
        }
        window.vintageAudio.typewriterClick();
        this.switchRoom(roomId);
      });
    });

    // Audio Toggle Button
    const audioBtn = document.getElementById("btn-toggle-audio");
    if (audioBtn) {
      audioBtn.addEventListener("click", () => {
        const muted = window.vintageAudio.toggleMute();
        audioBtn.textContent = muted ? "🔇 AUDIO: MUTED" : "🔊 AUDIO: ACTIVE";
        if (!muted) window.vintageAudio.dialClick();
      });
      audioBtn.textContent = window.vintageAudio.isMuted() ? "🔇 AUDIO: MUTED" : "🔊 AUDIO: ACTIVE";
    }

    // Reset Investigation Button
    const resetBtn = document.getElementById("btn-reset-game");
    if (resetBtn) {
      resetBtn.addEventListener("click", async () => {
        if (confirm("Restart current Case Archive? All unsealed evidence and timers will reset.")) {
          window.vintageAudio.rubberStampThump();
          await fetch("/api/reset", { method: "POST" });
          window.location.reload();
        }
      });
    }

    // Supervisor Field Notes Drawer
    const memoToggle = document.getElementById("btn-memo-toggle");
    const memoCard = document.getElementById("supervisor-memo-card");
    const unlockHintBtn = document.getElementById("btn-unlock-hint");

    if (memoToggle && memoCard) {
      memoToggle.addEventListener("click", () => {
        window.vintageAudio.dialClick();
        memoCard.classList.toggle("open");
      });
    }

    if (unlockHintBtn) {
      unlockHintBtn.addEventListener("click", async () => {
        window.vintageAudio.dialClick();
        try {
          const res = await fetch(`/api/hint/${this.currentRoom}`, { method: "POST" });
          const data = await res.json();

          if (data.status === "success") {
            window.vintageAudio.typewriterBell();
            const list = document.getElementById("memo-hints-list");
            if (list) {
              const item = document.createElement("div");
              item.className = "hint-entry";
              item.textContent = `[NOTE #${data.total_revealed}] ${data.hint}`;
              list.appendChild(item);
            }
            window.chronometer.sync(data.time_remaining_seconds, false);
            this.showFeedback("SUPERVISOR TELEGRAM", `Field hint unsealed. (-${data.penalty_applied}s penalty applied)`, "info");
          } else {
            this.showFeedback("FIELD NOTES", data.message, "info");
          }
        } catch (e) {
          console.error(e);
        }
      });
    }

    // Magnifying Glass Prop Toggle
    const magnifierBtn = document.getElementById("btn-magnifier-prop");
    if (magnifierBtn) {
      magnifierBtn.addEventListener("click", () => {
        window.vintageAudio.dialClick();
        this.toggleMagnifier();
      });
    }
  }

  setupDetectiveCat() {
    const catBtn = document.getElementById("cat-avatar-btn");
    const bubble = document.getElementById("cat-speech-bubble");
    const closeBtn = document.getElementById("btn-close-cat-bubble");
    const hintBtn = document.getElementById("btn-cat-hint");
    const petBtn = document.getElementById("btn-cat-pet");
    const speechText = document.getElementById("cat-speech-text");

    const petQuips = [
      "Purrrrr... nice scratching, partner! My whiskers smell an adversary trying to sneak past our defenses.",
      "Purrrrr... cyber adversaries hate laser pointers and strict IAM least-privilege policies!",
      "Mrrrow! A well-petted feline is a sharp forensic investigator. Keep inspecting those clues!",
      "Purrr... fun fact: I can smell an unescaped SQL query from five miles away.",
      "Purrrrr... my magnifying glass never lies. Check the anomalous parameters carefully!",
      "Mew! Don't let the chronometer stress you out. We have 9 lives, but this server only has one!"
    ];

    if (catBtn && bubble) {
      catBtn.addEventListener("click", () => {
        window.vintageAudio.catMeow();
        this.animateCat("bounce");
        bubble.classList.toggle("open");
        if (bubble.classList.contains("open")) {
          this.refreshCatHints(this.currentRoom);
        }
      });
    }

    if (closeBtn && bubble) {
      closeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        bubble.classList.remove("open");
      });
    }

    if (hintBtn) {
      hintBtn.addEventListener("click", async (e) => {
        e.stopPropagation();
        window.vintageAudio.catMeow();
        this.animateCat("bounce");

        try {
          const res = await fetch(`/api/hint/${this.currentRoom}`, { method: "POST" });
          const data = await res.json();

          if (data.status === "success") {
            window.vintageAudio.typewriterBell();
            if (speechText) {
              speechText.innerHTML = `<em>*Meow!*</em> Inspector Whiskers caught a scent:<br/><strong>[CLUE #${data.total_revealed}]</strong> ${data.hint}`;
            }
            this.renderCatHints(data.hints_revealed || []);

            // Also update supervisor memo drawer if open
            const memoList = document.getElementById("memo-hints-list");
            if (memoList) {
              const item = document.createElement("div");
              item.className = "hint-entry";
              item.textContent = `[NOTE #${data.total_revealed}] ${data.hint}`;
              memoList.appendChild(item);
            }

            window.chronometer.sync(data.time_remaining_seconds, false);
            this.showFeedback("INSPECTOR WHISKERS DISPATCH", `Feline clue unsealed! (-${data.penalty_applied}s penalty applied)`, "info");
          } else if (data.status === "no_more_hints") {
            if (speechText) {
              speechText.innerHTML = `<em>*Purrr...*</em> All field clues for this evidence file have been unsealed, partner! Review our findings and lock down the threat!`;
            }
            this.renderCatHints(data.hints || data.hints_revealed || []);
            this.showFeedback("INSPECTOR WHISKERS", "All field clues already uncovered.", "info");
          } else {
            this.showFeedback("INSPECTOR WHISKERS", data.message || "No hints available.", "info");
          }
        } catch (err) {
          console.error("Error requesting hint:", err);
        }
      });
    }

    if (petBtn) {
      petBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        window.vintageAudio.catPurr();
        this.animateCat("purr");
        const randomQuip = petQuips[Math.floor(Math.random() * petQuips.length)];
        if (speechText) {
          speechText.innerHTML = randomQuip;
        }
        this.showFeedback("INSPECTOR WHISKERS", "Purrrrr... morale boosted! Claws sharp, focus clear.", "success");
      });
    }

    // Close speech bubble on outside click
    document.addEventListener("click", (e) => {
      const widget = document.getElementById("detective-cat-widget");
      if (widget && !widget.contains(e.target) && bubble && bubble.classList.contains("open")) {
        bubble.classList.remove("open");
      }
    });
  }

  animateCat(type = "bounce") {
    const catImg = document.getElementById("cat-avatar-img");
    if (!catImg) return;
    const animClass = type === "purr" ? "anim-purr" : "anim-bounce";
    catImg.classList.remove("anim-bounce", "anim-purr");
    void catImg.offsetWidth;
    catImg.classList.add(animClass);
    setTimeout(() => {
      catImg.classList.remove(animClass);
    }, 700);
  }

  async refreshCatHints(roomId) {
    try {
      const res = await fetch(`/api/hint/${roomId}`, { method: "GET" });
      const data = await res.json();
      if (data.status === "success" && data.hints_revealed && data.hints_revealed.length > 0) {
        this.renderCatHints(data.hints_revealed);
      } else {
        const container = document.getElementById("cat-hints-container");
        if (container) container.innerHTML = "";
      }
    } catch (e) {
      console.error("Error refreshing cat hints:", e);
    }
  }

  renderCatHints(hints) {
    const hintsContainer = document.getElementById("cat-hints-container");
    if (!hintsContainer) return;
    hintsContainer.innerHTML = "";
    hints.forEach((h, idx) => {
      const card = document.createElement("div");
      card.className = "cat-hint-card";
      card.innerHTML = `<strong>🐾 Clue #${idx + 1}:</strong> ${h}`;
      hintsContainer.appendChild(card);
    });
  }

  showDashboard() {
    const dash = document.getElementById("intro-dashboard-view");
    const game = document.getElementById("active-game-view");
    const chrono = document.getElementById("chronometer-wrapper");

    if (dash) dash.style.display = "flex";
    if (game) game.style.display = "none";
    if (chrono) chrono.style.display = "none";
  }

  showGameView() {
    const dash = document.getElementById("intro-dashboard-view");
    const game = document.getElementById("active-game-view");
    const chrono = document.getElementById("chronometer-wrapper");

    if (dash) dash.style.display = "none";
    if (game) game.style.display = "flex";
    if (chrono) chrono.style.display = "flex";
  }

  toggleDashboard() {
    const dash = document.getElementById("intro-dashboard-view");
    if (dash && dash.style.display !== "none") {
      this.showGameView();
    } else {
      this.showDashboard();
    }
  }

  async selectCase(caseId, callsign) {
    try {
      const res = await fetch("/api/select_case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          investigator_name: callsign,
          start_game: true
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        this.showFeedback("CASE UNSEALED", data.message, "success");
        // Reload to load the selected room's templates & server state
        setTimeout(() => {
          window.location.reload();
        }, 500);
      }
    } catch (e) {
      alert("Error opening case file: " + e);
    }
  }

  toggleMagnifier() {
    this.magnifierEnabled = !this.magnifierEnabled;
    const body = document.body;
    if (this.magnifierEnabled) {
      body.classList.add("magnifier-mode");
      this.showFeedback("MAGNIFYING GLASS", "Forensic inspection active. Hover over logs to illuminate anomalies.", "info");
      
      document.querySelectorAll(".log-row").forEach(row => {
        const text = row.textContent;
        if (text.includes("cmd=") || text.includes("Kali") || text.includes("python-requests") || text.includes("502") || text.includes("pg_sleep")) {
          row.style.background = "#fff4cc";
        }
      });
    } else {
      body.classList.remove("magnifier-mode");
      document.querySelectorAll(".log-row").forEach(row => {
        if (!row.classList.contains("selected")) {
          row.style.background = "";
        }
      });
    }
  }

  async switchRoom(roomId, notifyServer = true) {
    this.currentRoom = roomId;

    // Update tab styles
    document.querySelectorAll(".folder-tab").forEach(tab => {
      tab.classList.toggle("active", tab.getAttribute("data-room") === roomId);
    });

    // Update evidence paper content views
    document.querySelectorAll(".evidence-room-view").forEach(view => {
      view.style.display = view.id === `view-${roomId}` ? "block" : "none";
    });

    // Reset hints list container for this room
    const list = document.getElementById("memo-hints-list");
    if (list) list.innerHTML = "";

    // Refresh Detective Cat greeting and hints for new room
    const speechText = document.getElementById("cat-speech-text");
    if (speechText) {
      const roomLabels = {
        evidence_01: "Evidence 01 (Log Forensics)",
        evidence_02: "Evidence 02 (Security Policy)",
        evidence_03: "Evidence 03 (Crypto Blueprint)",
        evidence_04: "Evidence 04 (Zero-Day Patch)"
      };
      const label = roomLabels[roomId] || roomId;
      speechText.innerHTML = `<em>*Sniff sniff*...</em> Examining <strong>${label}</strong>. Need me to inspect the evidence with my magnifying glass? Click <strong>Meow for Clue</strong> below!`;
    }
    this.refreshCatHints(roomId);

    if (notifyServer) {
      try {
        await fetch("/api/select_room", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ room_id: roomId })
        });
      } catch (e) {}
    }
  }

  updateFolderTabs(state) {
    const unlocked = state.unlocked_rooms || ["evidence_01"];
    const solved = state.solved_rooms || {};

    document.querySelectorAll(".folder-tab").forEach(tab => {
      const rid = tab.getAttribute("data-room");
      const isUnlocked = unlocked.includes(rid);
      const isSolved = Boolean(solved[rid]);

      tab.classList.toggle("locked", !isUnlocked);
      tab.classList.toggle("solved", isSolved);

      const icon = tab.querySelector(".tab-status-icon");
      if (icon) {
        if (isSolved) {
          icon.textContent = "✔";
        } else if (isUnlocked) {
          icon.textContent = "📂";
        } else {
          icon.textContent = "🔒";
        }
      }
    });
  }

  applyStamp(roomId, stampText, playSound = true) {
    const stampBox = document.getElementById(`stamp-box-${roomId}`);
    if (stampBox) {
      stampBox.innerHTML = `
        <div class="rubber-stamp stamp-green stamp-angle-slight stamp-slam-effect">
          ${stampText}
        </div>
      `;
    }

    if (playSound) {
      window.vintageAudio.rubberStampThump();
    }
  }

  showFeedback(title, msg, type = "info") {
    const banner = document.getElementById("desk-notification-banner");
    if (!banner) return;

    if (this.feedbackTimer) clearTimeout(this.feedbackTimer);

    banner.className = `desk-notification-banner ${type} show`;
    banner.innerHTML = `<strong>${title}:</strong> ${msg}`;

    this.feedbackTimer = setTimeout(() => {
      banner.classList.remove("show");
      setTimeout(() => {
        if (!banner.classList.contains("show")) {
          banner.innerHTML = "";
        }
      }, 300);
    }, 4500);
  }

  showVictoryModal(score, investigatorName) {
    const modal = document.getElementById("victory-modal");
    if (modal) {
      const scoreEl = document.getElementById("modal-final-score");
      const nameEl = document.getElementById("modal-investigator-name");
      if (scoreEl) scoreEl.textContent = score;
      if (nameEl) nameEl.textContent = investigatorName;
      modal.classList.add("active");
    }
  }
}

window.deskManager = new DeskManager();
