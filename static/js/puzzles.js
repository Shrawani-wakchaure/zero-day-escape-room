/**
 * Interactive Mechanics for Evidence Rooms 01 through 04
 */
class EvidenceRoomManager {
  constructor() {
    this.selectedLogIp = null;
    this.selectedPatchId = null;
    this.magnifierActive = false;
  }

  init() {
    this.bindRoom01();
    this.bindRoom02();
    this.bindRoom03();
    this.bindRoom04();
  }

  // ------------------------------------------------------------------------
  // ROOM 01: LOG ANALYZER
  // ------------------------------------------------------------------------
  bindRoom01() {
    const table = document.getElementById("log-table-body");
    const filterInput = document.getElementById("log-search-filter");
    const targetIpInput = document.getElementById("isolate-target-ip");
    const isolateBtn = document.getElementById("btn-isolate-ip");

    if (table) {
      table.addEventListener("click", (e) => {
        const row = e.target.closest(".log-row");
        if (!row) return;

        window.vintageAudio.typewriterClick();

        document.querySelectorAll(".log-row").forEach(r => r.classList.remove("selected"));
        row.classList.add("selected");

        const ip = row.getAttribute("data-ip");
        this.selectedLogIp = ip;
        if (targetIpInput) targetIpInput.value = ip;
      });
    }

    if (filterInput) {
      filterInput.addEventListener("input", (e) => {
        window.vintageAudio.typewriterClick();
        const term = e.target.value.toLowerCase();
        document.querySelectorAll(".log-row").forEach(row => {
          const text = row.textContent.toLowerCase();
          row.style.display = text.includes(term) ? "" : "none";
        });
      });
    }

    if (isolateBtn) {
      isolateBtn.addEventListener("click", () => {
        const ip = (targetIpInput ? targetIpInput.value.trim() : "") || this.selectedLogIp;
        if (!ip) {
          alert("Please select or enter an IP address from the server logs to isolate.");
          return;
        }
        this.submitRoom01(ip);
      });
    }
  }

  async submitRoom01(ip) {
    try {
      const res = await fetch("/api/validate/evidence_01", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: ip })
      });
      const data = await res.json();

      if (data.status === "success") {
        window.vintageAudio.rubberStampThump();
        window.deskManager.showFeedback("EVIDENCE VERIFIED", data.message, "success");
        window.deskManager.applyStamp("evidence_01", data.stamp.text);
        window.chronometer.sync(data.state.time_remaining_seconds, data.state.game_completed);
        window.deskManager.updateFolderTabs(data.state);
        
        setTimeout(() => {
          window.vintageAudio.typewriterBell();
          window.deskManager.switchRoom("evidence_02");
        }, 1200);
      } else {
        window.vintageAudio.typewriterClick();
        window.deskManager.showFeedback("ISOLATION REJECTED", data.message, "error");
        if (data.state) {
          window.chronometer.sync(data.state.time_remaining_seconds, data.state.game_completed);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting IP isolation: " + err);
    }
  }

  // ------------------------------------------------------------------------
  // ROOM 02: SECURITY POLICY (IAM / JWT / ROLES)
  // ------------------------------------------------------------------------
  bindRoom02() {
    const textarea = document.getElementById("iam-policy-editor");
    const submitBtn = document.getElementById("btn-submit-iam");

    if (textarea) {
      textarea.addEventListener("input", () => {
        window.vintageAudio.typewriterClick();
        this.evaluatePolicyChecklist();
      });

      // Quick fix buttons
      const btnFixPrincipal = document.getElementById("btn-fix-principal");
      const btnFixActions = document.getElementById("btn-fix-actions");
      const btnFixResource = document.getElementById("btn-fix-resource");
      const btnFixFormat = document.getElementById("btn-fix-format");

      if (btnFixPrincipal) {
        btnFixPrincipal.addEventListener("click", () => {
          window.vintageAudio.dialClick();
          this.applyPolicyQuickFix("principal");
        });
      }

      if (btnFixActions) {
        btnFixActions.addEventListener("click", () => {
          window.vintageAudio.dialClick();
          this.applyPolicyQuickFix("actions");
        });
      }

      if (btnFixResource) {
        btnFixResource.addEventListener("click", () => {
          window.vintageAudio.dialClick();
          this.applyPolicyQuickFix("resource");
        });
      }

      if (btnFixFormat) {
        btnFixFormat.addEventListener("click", () => {
          window.vintageAudio.typewriterBell();
          this.formatPolicyJson();
        });
      }

      // Initial checklist evaluation
      this.evaluatePolicyChecklist();
    }

    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const val = textarea.value;
        this.submitRoom02(val);
      });
    }
  }

  applyPolicyQuickFix(fixType) {
    const textarea = document.getElementById("iam-policy-editor");
    if (!textarea) return;
    try {
      const obj = JSON.parse(textarea.value);

      // AWS IAM format (Case 1)
      if (obj.Statement && obj.Statement.length > 0) {
        if (fixType === "principal") {
          obj.Statement[0]["Principal"] = "arn:aws:iam::123456789012:role/ForensicsOfficer";
          obj.Statement[0]["Sid"] = "ForensicsReadOnlyAccess";
        } else if (fixType === "actions") {
          obj.Statement[0]["Action"] = ["s3:GetObject", "s3:ListBucket"];
        } else if (fixType === "resource") {
          obj.Statement[0]["Resource"] = ["arn:aws:s3:::case-files-archive", "arn:aws:s3:::case-files-archive/*"];
        }
      }
      // JWT Auth Policy (Case 2)
      else if (obj.AllowedAlgorithms !== undefined) {
        if (fixType === "principal") {
          obj["AllowedAlgorithms"] = ["RS256"];
          obj["RequireSignature"] = true;
        } else if (fixType === "actions") {
          obj["VerifyIssuer"] = true;
        } else if (fixType === "resource") {
          obj["Audience"] = "scada-telemetry-gateway";
        }
      }
      // PostgreSQL Role Policy (Case 3)
      else if (obj.RoleName !== undefined) {
        if (fixType === "principal") {
          obj["SuperUser"] = false;
          obj["CreateDB"] = false;
        } else if (fixType === "actions") {
          obj["GrantedPermissions"] = ["SELECT", "INSERT"];
        } else if (fixType === "resource") {
          obj["TargetTables"] = ["vault_transactions"];
        }
      }

      textarea.value = JSON.stringify(obj, null, 2);
      this.evaluatePolicyChecklist();
    } catch (e) {
      alert("Invalid JSON format. Please format JSON first.");
    }
  }

  formatPolicyJson() {
    const textarea = document.getElementById("iam-policy-editor");
    if (!textarea) return;
    try {
      const obj = JSON.parse(textarea.value);
      textarea.value = JSON.stringify(obj, null, 2);
    } catch (e) {
      alert("JSON Syntax error: " + e.message);
    }
  }

  evaluatePolicyChecklist() {
    const textarea = document.getElementById("iam-policy-editor");
    if (!textarea) return;

    const checkPrincipal = document.getElementById("check-principal");
    const checkAction = document.getElementById("check-action");
    const checkResource = document.getElementById("check-resource");
    if (!checkPrincipal || !checkAction || !checkResource) return;

    try {
      const obj = JSON.parse(textarea.value);

      // Case 1: AWS IAM
      if (obj.Statement && obj.Statement[0]) {
        const st = obj.Statement[0];
        const pStr = JSON.stringify(st.Principal || "");
        this.updateCheckItem(checkPrincipal, pStr && !pStr.includes("*") && pStr.includes("ForensicsOfficer"));

        const aStr = JSON.stringify(st.Action || "");
        this.updateCheckItem(checkAction, aStr && !aStr.includes("*") && !aStr.includes("AdministratorAccess") && aStr.includes("s3:GetObject"));

        const rStr = JSON.stringify(st.Resource || "");
        this.updateCheckItem(checkResource, rStr && !rStr.includes('"*"') && rStr.includes("case-files-archive"));
      }
      // Case 2: JWT Policy
      else if (obj.AllowedAlgorithms !== undefined) {
        const algs = obj.AllowedAlgorithms || [];
        this.updateCheckItem(checkPrincipal, !algs.includes("none") && algs.includes("RS256"));
        this.updateCheckItem(checkAction, obj.RequireSignature === true);
        this.updateCheckItem(checkResource, obj.Audience && obj.Audience !== "*" && obj.Audience.includes("scada"));
      }
      // Case 3: DB Role
      else if (obj.RoleName !== undefined) {
        this.updateCheckItem(checkPrincipal, obj.SuperUser === false && obj.CreateDB === false);
        const perms = JSON.stringify(obj.GrantedPermissions || "");
        this.updateCheckItem(checkAction, !perms.includes("ALL") && perms.includes("SELECT"));
        const tables = JSON.stringify(obj.TargetTables || "");
        this.updateCheckItem(checkResource, !tables.includes("*") && tables.includes("vault_transactions"));
      }
    } catch (e) {}
  }

  updateCheckItem(el, passed) {
    if (!el) return;
    if (passed) {
      el.classList.add("passed");
      el.querySelector(".checklist-icon").textContent = "✔";
    } else {
      el.classList.remove("passed");
      el.querySelector(".checklist-icon").textContent = "✖";
    }
  }

  async submitRoom02(policyJson) {
    try {
      const res = await fetch("/api/validate/evidence_02", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ policy_json: policyJson })
      });
      const data = await res.json();

      if (data.status === "success") {
        window.vintageAudio.rubberStampThump();
        window.deskManager.showFeedback("COMPLIANCE VERIFIED", data.message, "success");
        window.deskManager.applyStamp("evidence_02", data.stamp.text);
        window.chronometer.sync(data.state.time_remaining_seconds, data.state.game_completed);
        window.deskManager.updateFolderTabs(data.state);

        setTimeout(() => {
          window.vintageAudio.typewriterBell();
          window.deskManager.switchRoom("evidence_03");
        }, 1200);
      } else {
        window.vintageAudio.typewriterClick();
        window.deskManager.showFeedback("AUDIT REJECTED", data.message, "error");
        if (data.state) {
          window.chronometer.sync(data.state.time_remaining_seconds, data.state.game_completed);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting policy: " + err);
    }
  }

  // ------------------------------------------------------------------------
  // ROOM 03: CRYPTO HANDSHAKE (BLUEPRINT)
  // ------------------------------------------------------------------------
  bindRoom03() {
    const selects = ["crypto-proto", "crypto-kex", "crypto-cipher", "crypto-mac"];
    selects.forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener("change", () => {
          window.vintageAudio.dialClick();
          this.updateCryptoDiagram();
        });
      }
    });

    const submitBtn = document.getElementById("btn-submit-crypto");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        const proto = document.getElementById("crypto-proto").value;
        const kex = document.getElementById("crypto-kex").value;
        const cipher = document.getElementById("crypto-cipher").value;
        const mac = document.getElementById("crypto-mac").value;

        if (!proto || !kex || !cipher || !mac) {
          alert("Please select values for all four cryptographic parameters.");
          return;
        }

        this.submitRoom03(proto, kex, cipher, mac);
      });
    }
  }

  updateCryptoDiagram() {
    const proto = document.getElementById("crypto-proto")?.value;
    const kex = document.getElementById("crypto-kex")?.value;
    const cipher = document.getElementById("crypto-cipher")?.value;
    const mac = document.getElementById("crypto-mac")?.value;
    const tunnel = document.getElementById("diagram-tunnel-line");

    if (proto && kex && cipher && mac) {
      if (tunnel) tunnel.classList.add("connected");
    } else {
      if (tunnel) tunnel.classList.remove("connected");
    }
  }

  async submitRoom03(proto, kex, cipher, mac) {
    try {
      const res = await fetch("/api/validate/evidence_03", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          protocol: proto,
          key_exchange: kex,
          cipher: cipher,
          mac: mac
        })
      });
      const data = await res.json();

      if (data.status === "success") {
        window.vintageAudio.rubberStampThump();
        window.deskManager.showFeedback("TUNNEL DECRYPTED", data.message, "success");
        window.deskManager.applyStamp("evidence_03", data.stamp.text);
        
        // Show decrypted teletype ticker
        const tape = document.getElementById("decrypted-transmission-tape");
        if (tape) {
          tape.style.display = "block";
          tape.textContent = data.decrypted_payload;
        }

        window.chronometer.sync(data.state.time_remaining_seconds, data.state.game_completed);
        window.deskManager.updateFolderTabs(data.state);

        setTimeout(() => {
          window.vintageAudio.typewriterBell();
          window.deskManager.switchRoom("evidence_04");
        }, 1500);
      } else {
        window.vintageAudio.typewriterClick();
        window.deskManager.showFeedback("HANDSHAKE FAILED", data.message, "error");
        if (data.state) {
          window.chronometer.sync(data.state.time_remaining_seconds, data.state.game_completed);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting cryptographic handshake: " + err);
    }
  }

  // ------------------------------------------------------------------------
  // ROOM 04: ZERO-DAY PATCH (CODING)
  // ------------------------------------------------------------------------
  bindRoom04() {
    const cards = document.querySelectorAll(".patch-candidate-card");
    cards.forEach(card => {
      card.addEventListener("click", () => {
        window.vintageAudio.typewriterClick();
        cards.forEach(c => c.classList.remove("selected"));
        card.classList.add("selected");
        this.selectedPatchId = card.getAttribute("data-patch-id");
      });
    });

    const submitBtn = document.getElementById("btn-submit-patch");
    if (submitBtn) {
      submitBtn.addEventListener("click", () => {
        if (!this.selectedPatchId) {
          alert("Please select a candidate security patch to test.");
          return;
        }
        this.submitRoom04(this.selectedPatchId);
      });
    }
  }

  async submitRoom04(patchId) {
    const consoleEl = document.getElementById("exploit-console");
    if (consoleEl) {
      consoleEl.style.display = "block";
      consoleEl.innerHTML = "> INITIATING REGRESSION EXPLOIT TEST HARNESS...\n> AUDITING PATCH AGAINST ACTIVE EXPLOIT VECTORS...\n";
    }

    try {
      const res = await fetch("/api/validate/evidence_04", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patch_id: patchId })
      });
      const data = await res.json();

      if (consoleEl && data.test_results) {
        let logHtml = "> INITIATING REGRESSION EXPLOIT TEST HARNESS...\n";
        data.test_results.forEach(tr => {
          const isPass = tr.status.includes("BLOCKED") || tr.status.includes("ALLOWED");
          const cls = isPass ? "pass" : "fail";
          logHtml += `<div class="exploit-result-line ${cls}">[TEST] Payload: "${tr.payload}" --> Result: ${tr.status}</div>`;
        });
        consoleEl.innerHTML = logHtml;
      }

      if (data.status === "success") {
        window.vintageAudio.rubberStampThump();
        window.deskManager.showFeedback("VULNERABILITY SEALED", data.message, "success");
        window.deskManager.applyStamp("evidence_04", data.stamp.text);
        window.chronometer.sync(data.state.time_remaining_seconds, true);
        window.deskManager.updateFolderTabs(data.state);

        setTimeout(() => {
          window.vintageAudio.victoryFanfare();
          window.deskManager.showVictoryModal(data.score, data.state.investigator_name);
        }, 1200);
      } else {
        window.vintageAudio.typewriterClick();
        window.deskManager.showFeedback("REGRESSION FAILED", data.message, "error");
        if (data.state) {
          window.chronometer.sync(data.state.time_remaining_seconds, data.state.game_completed);
        }
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting patch: " + err);
    }
  }
}

window.puzzles = new EvidenceRoomManager();
