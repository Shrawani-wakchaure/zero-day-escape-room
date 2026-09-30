/**
 * Application Entry Point and Initialization
 */
document.addEventListener("DOMContentLoaded", async () => {
  // Grab initial state from script tag or API
  let initialState = {};
  const stateScript = document.getElementById("initial-session-state");
  if (stateScript) {
    try {
      initialState = JSON.parse(stateScript.textContent);
    } catch (e) {
      console.error("Error parsing initial state:", e);
    }
  }

  if (!initialState.time_remaining_seconds) {
    try {
      const res = await fetch("/api/state");
      initialState = await res.json();
    } catch (e) {}
  }

  // Initialize Audio, Timer, Desk, and Puzzles
  window.vintageAudio.init();
  window.chronometer.init(
    initialState.time_remaining_seconds || 1200,
    initialState.game_completed || false
  );
  window.deskManager.init(initialState);
  window.puzzles.init();

  // Close modals on escape key or backdrop click
  document.querySelectorAll(".vintage-modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.classList.remove("active");
      }
    });
  });

  // Modal start / restart button
  const startBtn = document.getElementById("btn-modal-start");
  if (startBtn) {
    startBtn.addEventListener("click", async () => {
      const nameInput = document.getElementById("input-investigator-name");
      const name = (nameInput ? nameInput.value.trim() : "") || "Special Agent S.A.";
      window.vintageAudio.rubberStampThump();

      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ investigator_name: name })
      });
      const data = await res.json();
      document.getElementById("start-briefing-modal")?.classList.remove("active");
      window.location.reload();
    });
  }

  // First interaction user gesture for Web Audio unlock
  const unlockAudio = () => {
    window.vintageAudio.init();
    document.removeEventListener("click", unlockAudio);
    document.removeEventListener("keydown", unlockAudio);
  };
  document.addEventListener("click", unlockAudio, { once: true });
  document.addEventListener("keydown", unlockAudio, { once: true });
});
