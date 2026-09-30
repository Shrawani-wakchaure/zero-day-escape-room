import os
import json
import time
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify, session, redirect, url_for

app = Flask(__name__)
app.secret_key = os.environ.get("FLASK_SECRET_KEY", "vintage-zero-day-cold-case-archive-key-1987")

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CASES_FILE = os.path.join(BASE_DIR, "data", "cases.json")
PUZZLES_FILE = os.path.join(BASE_DIR, "data", "puzzles.json")

def load_json_file(filepath):
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading {filepath}: {e}")
        return {}

def get_cases_data():
    return load_json_file(CASES_FILE)

def get_puzzles_data():
    return load_json_file(PUZZLES_FILE)

def init_session(investigator_name=None, case_id=None, start_timer=False):
    cases_data = get_cases_data()
    all_cases = cases_data.get("cases", {})
    
    # Pick case
    selected_case_id = case_id or session.get("active_case") or cases_data.get("active_case", "operation_cold_breach")
    if selected_case_id not in all_cases:
        selected_case_id = "operation_cold_breach"
        
    case_meta = all_cases.get(selected_case_id, {})
    timer_total = case_meta.get("default_timer_seconds", 1200)

    session["active_case"] = selected_case_id
    session["game_started"] = start_timer
    session["start_timestamp"] = time.time() if start_timer else None
    session["total_timer_seconds"] = timer_total
    session["penalty_seconds"] = 0
    session["current_room"] = "evidence_01"
    session["unlocked_rooms"] = ["evidence_01"]
    session["solved_rooms"] = {}
    session["stamps"] = {}
    session["hints_unlocked"] = {
        "evidence_01": 0,
        "evidence_02": 0,
        "evidence_03": 0,
        "evidence_04": 0
    }
    session["attempts"] = {
        "evidence_01": 0,
        "evidence_02": 0,
        "evidence_03": 0,
        "evidence_04": 0
    }
    session["investigator_name"] = investigator_name or session.get("investigator_name", "Special Agent S.A.")
    session["game_completed"] = False
    session["game_over"] = False
    session["completion_time_seconds"] = None
    session["final_score"] = 0

def calculate_time_remaining():
    if not session.get("game_started") or not session.get("start_timestamp"):
        return session.get("total_timer_seconds", 1200)

    if session.get("game_completed") and session.get("completion_time_seconds") is not None:
        elapsed = session["completion_time_seconds"]
    else:
        elapsed = time.time() - session.get("start_timestamp", time.time())
    
    total = session.get("total_timer_seconds", 1200)
    penalties = session.get("penalty_seconds", 0)
    remaining = max(0, int(total - elapsed - penalties))

    if remaining <= 0 and not session.get("game_completed"):
        session["game_over"] = True

    return remaining

def calculate_investigator_score():
    base_score = 1000
    solved_count = len(session.get("solved_rooms", {}))
    time_remaining = calculate_time_remaining()
    
    # 250 points per solved puzzle
    room_points = solved_count * 250
    # Bonus for remaining seconds (up to 500)
    time_bonus = int(min(500, time_remaining * 0.5))
    # Deductions for hints used (40 pts each)
    total_hints = sum(session.get("hints_unlocked", {}).values())
    hint_deductions = total_hints * 40
    # Deductions for failed attempts (15 pts each)
    total_attempts = sum(session.get("attempts", {}).values()) - solved_count
    attempt_deductions = max(0, total_attempts) * 15

    score = max(100, base_score + room_points + time_bonus - hint_deductions - attempt_deductions)
    return score

def get_active_puzzle_data():
    puzzles = get_puzzles_data()
    active_case = session.get("active_case", "operation_cold_breach")
    return puzzles.get(active_case, puzzles.get("operation_cold_breach", {}))

def get_active_case_data():
    cases_data = get_cases_data()
    all_cases = cases_data.get("cases", {})
    active_case = session.get("active_case", "operation_cold_breach")
    return all_cases.get(active_case, list(all_cases.values())[0] if all_cases else {})

def get_state_dict():
    remaining = calculate_time_remaining()
    score = calculate_investigator_score()
    cases_data = get_cases_data()
    active_case_meta = get_active_case_data()

    return {
        "active_case": session.get("active_case", "operation_cold_breach"),
        "case_metadata": active_case_meta,
        "available_cases": cases_data.get("cases", {}),
        "game_started": session.get("game_started", False),
        "current_room": session.get("current_room", "evidence_01"),
        "unlocked_rooms": session.get("unlocked_rooms", ["evidence_01"]),
        "solved_rooms": session.get("solved_rooms", {}),
        "stamps": session.get("stamps", {}),
        "hints_unlocked": session.get("hints_unlocked", {}),
        "attempts": session.get("attempts", {}),
        "time_remaining_seconds": remaining,
        "investigator_name": session.get("investigator_name", "Special Agent S.A."),
        "game_completed": session.get("game_completed", False),
        "game_over": session.get("game_over", False),
        "score": score
    }

@app.before_request
def ensure_session():
    if "active_case" not in session or "unlocked_rooms" not in session:
        init_session()

@app.route("/")
def index():
    cases_data = get_cases_data()
    active_case_meta = get_active_case_data()
    puzzles = get_active_puzzle_data()
    
    return render_template(
        "index.html",
        cases_data=cases_data,
        case=active_case_meta,
        puzzles=puzzles,
        session_state=get_state_dict()
    )

@app.route("/api/cases", methods=["GET"])
def get_cases():
    cases_data = get_cases_data()
    return jsonify(cases_data.get("cases", {}))

@app.route("/api/state", methods=["GET"])
def get_state():
    return jsonify(get_state_dict())

@app.route("/api/select_case", methods=["POST"])
def select_case():
    data = request.get_json(silent=True) or {}
    case_id = data.get("case_id", "operation_cold_breach")
    investigator_name = data.get("investigator_name", "").strip() or session.get("investigator_name", "Special Agent S.A.")
    start_timer = data.get("start_game", True)

    init_session(investigator_name=investigator_name, case_id=case_id, start_timer=start_timer)
    return jsonify({
        "status": "success",
        "message": f"Escape Room unsealed: {case_id}",
        "state": get_state_dict()
    })

@app.route("/api/start", methods=["POST"])
def start_game():
    data = request.get_json(silent=True) or {}
    investigator_name = data.get("investigator_name", "").strip() or session.get("investigator_name", "Special Agent S.A.")
    case_id = data.get("case_id") or session.get("active_case", "operation_cold_breach")
    
    init_session(investigator_name=investigator_name, case_id=case_id, start_timer=True)
    return jsonify({
        "status": "success",
        "message": "Cold Case Archive unsealed. Timer ticking.",
        "state": get_state_dict()
    })

@app.route("/api/reset", methods=["POST"])
def reset_game():
    init_session(start_timer=True)
    return jsonify({
        "status": "success",
        "message": "Case file reset to initial state.",
        "state": get_state_dict()
    })

@app.route("/api/select_room", methods=["POST"])
def select_room():
    data = request.get_json(silent=True) or {}
    room_id = data.get("room_id")
    unlocked = session.get("unlocked_rooms", ["evidence_01"])
    if room_id in unlocked:
        session["current_room"] = room_id
        return jsonify({"status": "success", "current_room": room_id})
    return jsonify({"status": "error", "message": "Evidence file is still locked or classified."}), 403

@app.route("/api/hint/<evidence_id>", methods=["GET", "POST"])
def get_hint(evidence_id):
    puzzles = get_active_puzzle_data()
    if evidence_id not in puzzles:
        return jsonify({"status": "error", "message": "Invalid evidence ID"}), 404

    hints = puzzles[evidence_id].get("hints", [])
    current_count = session.get("hints_unlocked", {}).get(evidence_id, 0)

    # GET request: return already-unlocked hints without incurring penalty
    if request.method == "GET":
        return jsonify({
            "status": "success",
            "hints_revealed": hints[:current_count],
            "total_revealed": current_count,
            "total_available": len(hints),
            "time_remaining_seconds": calculate_time_remaining()
        })

    # POST request: unseal the next available hint with a 30s penalty
    if current_count >= len(hints):
        return jsonify({
            "status": "no_more_hints",
            "message": "All available field notes for this evidence have already been unsealed.",
            "hints": hints,
            "hints_revealed": hints,
            "total_revealed": len(hints),
            "total_available": len(hints)
        })

    # Deduct 30 seconds penalty
    session["penalty_seconds"] = session.get("penalty_seconds", 0) + 30
    session["hints_unlocked"][evidence_id] = current_count + 1
    session.modified = True

    return jsonify({
        "status": "success",
        "hint": hints[current_count],
        "hints_revealed": hints[:current_count + 1],
        "total_revealed": current_count + 1,
        "total_available": len(hints),
        "penalty_applied": 30,
        "time_remaining_seconds": calculate_time_remaining()
    })

@app.route("/api/validate/evidence_01", methods=["POST"])
def validate_evidence_01():
    session["attempts"]["evidence_01"] = session["attempts"].get("evidence_01", 0) + 1
    session.modified = True

    data = request.get_json(silent=True) or {}
    submitted_ip = str(data.get("ip", "")).strip()

    puzzles = get_active_puzzle_data()
    puzzle = puzzles.get("evidence_01", {})
    target_ip = puzzle.get("anomalous_ip")

    if submitted_ip == target_ip:
        now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
        session["solved_rooms"]["evidence_01"] = now_str
        session["stamps"]["evidence_01"] = {
            "text": puzzle.get("stamp_text", "IP ISOLATED & QUARANTINED"),
            "date": now_str,
            "target": target_ip
        }
        if "evidence_02" not in session["unlocked_rooms"]:
            session["unlocked_rooms"].append("evidence_02")
        session.modified = True

        return jsonify({
            "status": "success",
            "message": puzzle.get("success_message", "IP Isolated successfully."),
            "stamp": session["stamps"]["evidence_01"],
            "next_room": "evidence_02",
            "state": get_state_dict()
        })
    else:
        session["penalty_seconds"] = session.get("penalty_seconds", 0) + 15
        session.modified = True
        return jsonify({
            "status": "incorrect",
            "message": f"IP '{submitted_ip}' is legitimate internal infrastructure or a benign crawler. Scrutinize the access logs for unauthorized intrusion attempts.",
            "penalty_applied": 15,
            "state": get_state_dict()
        }), 400

@app.route("/api/validate/evidence_02", methods=["POST"])
def validate_evidence_02():
    session["attempts"]["evidence_02"] = session["attempts"].get("evidence_02", 0) + 1
    session.modified = True

    data = request.get_json(silent=True) or {}
    policy_raw = data.get("policy_json")
    principal = data.get("principal")
    actions = data.get("actions")
    resource = data.get("resource")

    active_case = session.get("active_case", "operation_cold_breach")
    puzzles = get_active_puzzle_data()
    puzzle = puzzles.get("evidence_02", {})

    errors = []

    # CASE 1: OPERATION COLD BREACH (AWS IAM Policy)
    if active_case == "operation_cold_breach":
        parsed_statement = None
        if policy_raw:
            try:
                policy_dict = json.loads(policy_raw)
                statements = policy_dict.get("Statement", [])
                if statements and isinstance(statements, list):
                    parsed_statement = statements[0]
                elif isinstance(statements, dict):
                    parsed_statement = statements
            except Exception as e:
                return jsonify({"status": "error", "message": f"JSON syntax error: {str(e)}"}), 400

        p_val = parsed_statement.get("Principal") if parsed_statement else principal
        a_val = parsed_statement.get("Action") if parsed_statement else actions
        r_val = parsed_statement.get("Resource") if parsed_statement else resource

        p_str = json.dumps(p_val) if isinstance(p_val, (dict, list)) else str(p_val)
        if not p_val or p_val == "*" or '"*"' in p_str:
            errors.append("Principal is set to wildcard '*' — exposes storage to the entire Internet.")
        elif "ForensicsOfficer" not in p_str:
            errors.append("Principal must assign access to the authorized 'ForensicsOfficer' role.")

        a_str = json.dumps(a_val) if isinstance(a_val, list) else str(a_val)
        if not a_val or a_val == "*" or '"*"' in a_str or "AdministratorAccess" in a_str:
            errors.append("Action contains unrestricted wildcard '*' or full AdministratorAccess.")
        elif not ("s3:GetObject" in a_str or "s3:List" in a_str):
            errors.append("Action must enforce least-privilege read-only S3 actions.")

        r_str = json.dumps(r_val) if isinstance(r_val, list) else str(r_val)
        if not r_val or r_val == "*" or ('"*"' in r_str and "case-files-archive" not in r_str):
            errors.append("Resource targets wildcard '*' across all buckets.")
        elif "case-files-archive" not in r_str:
            errors.append("Resource must be scoped to 'arn:aws:s3:::case-files-archive/*'.")

    # CASE 2: PHANTOM CIPHER (SCADA JWT Auth Policy)
    elif active_case == "phantom_cipher":
        if policy_raw:
            try:
                p_dict = json.loads(policy_raw)
            except Exception as e:
                return jsonify({"status": "error", "message": f"JSON syntax error: {str(e)}"}), 400
        else:
            p_dict = data

        algs = p_dict.get("AllowedAlgorithms", [])
        req_sig = p_dict.get("RequireSignature")
        aud = p_dict.get("Audience")

        if "none" in algs:
            errors.append("AllowedAlgorithms contains 'none' — critical vulnerability allowing forged signatures!")
        if "RS256" not in algs:
            errors.append("AllowedAlgorithms must enforce asymmetric cryptographic signature 'RS256'.")
        if req_sig is not True:
            errors.append("RequireSignature must be set to true.")
        if aud == "*" or not aud or "scada" not in str(aud):
            errors.append("Audience must be scoped to 'scada-telemetry-gateway'.")

    # CASE 3: BLACK ICE (PostgreSQL Role Policy)
    elif active_case == "black_ice":
        if policy_raw:
            try:
                p_dict = json.loads(policy_raw)
            except Exception as e:
                return jsonify({"status": "error", "message": f"JSON syntax error: {str(e)}"}), 400
        else:
            p_dict = data

        if p_dict.get("SuperUser") is True:
            errors.append("SuperUser privilege must be revoked (false).")
        if p_dict.get("CreateDB") is True:
            errors.append("CreateDB privilege must be revoked (false).")
        perms = str(p_dict.get("GrantedPermissions", []))
        if "ALL PRIVILEGES" in perms:
            errors.append("GrantedPermissions contains excessive 'ALL PRIVILEGES'. Restrict to ['SELECT', 'INSERT'].")
        tables = str(p_dict.get("TargetTables", []))
        if "*" in tables:
            errors.append("TargetTables targets wildcard '*'. Restrict to ['vault_transactions'].")

    if errors:
        session["penalty_seconds"] = session.get("penalty_seconds", 0) + 15
        session.modified = True
        return jsonify({
            "status": "incorrect",
            "message": "Policy Compliance Audit Failed:\n- " + "\n- ".join(errors),
            "penalty_applied": 15,
            "state": get_state_dict()
        }), 400

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    session["solved_rooms"]["evidence_02"] = now_str
    session["stamps"]["evidence_02"] = {
        "text": puzzle.get("stamp_text", "COMPLIANCE CERTIFIED"),
        "date": now_str
    }
    if "evidence_03" not in session["unlocked_rooms"]:
        session["unlocked_rooms"].append("evidence_03")
    session.modified = True

    return jsonify({
        "status": "success",
        "message": puzzle.get("success_message", "Policy hardened successfully!"),
        "stamp": session["stamps"]["evidence_02"],
        "next_room": "evidence_03",
        "state": get_state_dict()
    })

@app.route("/api/validate/evidence_03", methods=["POST"])
def validate_evidence_03():
    session["attempts"]["evidence_03"] = session["attempts"].get("evidence_03", 0) + 1
    session.modified = True

    data = request.get_json(silent=True) or {}
    protocol = data.get("protocol")
    key_exchange = data.get("key_exchange")
    cipher = data.get("cipher")
    mac = data.get("mac")

    puzzles = get_active_puzzle_data()
    puzzle = puzzles.get("evidence_03", {})
    params = puzzle.get("parameters", {})

    errors = []
    if protocol != params.get("protocol", {}).get("correct"):
        errors.append("Protocol is insecure or deprecated. Downgrade vulnerability detected.")
    if key_exchange != params.get("key_exchange", {}).get("correct"):
        errors.append("Key exchange lacks Perfect Forward Secrecy (PFS) or is unauthenticated.")
    if cipher != params.get("cipher", {}).get("correct"):
        errors.append("Cipher suite is vulnerable to padding oracle attacks or weak block ciphers.")
    if mac != params.get("mac", {}).get("correct"):
        errors.append("Integrity hash algorithm suffers from known cryptographic collision exploits.")

    if errors:
        session["penalty_seconds"] = session.get("penalty_seconds", 0) + 15
        session.modified = True
        return jsonify({
            "status": "incorrect",
            "message": "Cryptographic Handshake Failed:\n- " + "\n- ".join(errors),
            "penalty_applied": 15,
            "state": get_state_dict()
        }), 400

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    session["solved_rooms"]["evidence_03"] = now_str
    session["stamps"]["evidence_03"] = {
        "text": puzzle.get("stamp_text", "TUNNEL DECRYPTED"),
        "date": now_str
    }
    if "evidence_04" not in session["unlocked_rooms"]:
        session["unlocked_rooms"].append("evidence_04")
    session.modified = True

    return jsonify({
        "status": "success",
        "message": puzzle.get("success_message", "Decrypted C2 payload intercepted!"),
        "decrypted_payload": puzzle.get("decrypted_payload"),
        "stamp": session["stamps"]["evidence_03"],
        "next_room": "evidence_04",
        "state": get_state_dict()
    })

@app.route("/api/validate/evidence_04", methods=["POST"])
def validate_evidence_04():
    session["attempts"]["evidence_04"] = session["attempts"].get("evidence_04", 0) + 1
    session.modified = True

    data = request.get_json(silent=True) or {}
    patch_id = data.get("patch_id")
    code_text = data.get("code", "")

    puzzles = get_active_puzzle_data()
    puzzle = puzzles.get("evidence_04", {})

    is_secure = False
    flaw_reason = ""

    if patch_id:
        for opt in puzzle.get("patch_options", []):
            if opt["id"] == patch_id:
                if opt["secure"]:
                    is_secure = True
                else:
                    flaw_reason = opt["flaw"]
                break
    elif code_text:
        if "os.system" in code_text or "shell=True" in code_text or "pickle.loads" in code_text:
            flaw_reason = "Code retains insecure execution patterns."
        else:
            is_secure = True

    if not is_secure:
        session["penalty_seconds"] = session.get("penalty_seconds", 0) + 20
        session.modified = True
        return jsonify({
            "status": "incorrect",
            "message": f"Exploit Regression Test Failed! {flaw_reason}",
            "test_results": [
                {"payload": "Attacker Exploit Vector", "status": "EXPLOITED (Vulnerability Re-Triggered)"}
            ],
            "penalty_applied": 20,
            "state": get_state_dict()
        }), 400

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    session["solved_rooms"]["evidence_04"] = now_str
    session["stamps"]["evidence_04"] = {
        "text": puzzle.get("stamp_text", "CASE FILE RESOLVED"),
        "date": now_str
    }
    
    session["game_completed"] = True
    session["completion_time_seconds"] = int(time.time() - session.get("start_timestamp", time.time()))
    session["final_score"] = calculate_investigator_score()
    session.modified = True

    # Test suite responses
    test_results = [
        {"payload": p["input"], "status": "ALLOWED (Execution Validated)" if p["expected_allow"] else "BLOCKED (Exploit Defused)"}
        for p in puzzle.get("test_payloads", [])
    ]

    return jsonify({
        "status": "success",
        "message": puzzle.get("success_message", "Zero-day vulnerability patched! Attacker locked out."),
        "test_results": test_results,
        "stamp": session["stamps"]["evidence_04"],
        "game_completed": True,
        "score": session["final_score"],
        "state": get_state_dict()
    })

@app.route("/certificate")
def certificate():
    case_meta = get_active_case_data()
    return render_template(
        "certificate.html",
        case=case_meta,
        state=get_state_dict()
    )

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5555))
    print(f"Starting Vintage Escape Room on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=True)
