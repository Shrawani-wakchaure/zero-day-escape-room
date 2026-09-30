import pytest
import json
from app import app

@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as client:
        with client.session_transaction() as sess:
            sess["game_started"] = True
        yield client

def test_initial_state(client):
    res = client.get("/api/state")
    assert res.status_code == 200
    data = res.get_json()
    assert "available_cases" in data
    assert len(data["available_cases"]) >= 3
    assert data["current_room"] == "evidence_01"

def test_operation_cold_breach_solve(client):
    # Select Case 1
    client.post("/api/select_case", json={"case_id": "operation_cold_breach", "start_game": True})

    # Evidence 01: Anomalous IP 192.0.2.45
    res1 = client.post("/api/validate/evidence_01", json={"ip": "192.0.2.45"})
    assert res1.status_code == 200

    # Evidence 02: IAM Policy
    res2 = client.post("/api/validate/evidence_02", json={
        "principal": "arn:aws:iam::123456789012:role/ForensicsOfficer",
        "actions": ["s3:GetObject", "s3:ListBucket"],
        "resource": "arn:aws:s3:::case-files-archive/*"
    })
    assert res2.status_code == 200

    # Evidence 03: Crypto Handshake (Notice: non-last selections!)
    res3 = client.post("/api/validate/evidence_03", json={
        "protocol": "TLSv1.3",
        "key_exchange": "ECDHE",
        "cipher": "AES-256-GCM",
        "mac": "SHA-384"
    })
    assert res3.status_code == 200

    # Evidence 04: Zero-day patch - Notice: patch_a is the FIRST option!
    res4 = client.post("/api/validate/evidence_04", json={"patch_id": "patch_a"})
    assert res4.status_code == 200
    data4 = res4.get_json()
    assert data4["game_completed"] is True
    assert data4["score"] > 0

def test_phantom_cipher_solve(client):
    # Select Case 2
    client.post("/api/select_case", json={"case_id": "phantom_cipher", "start_game": True})

    # Evidence 01: Modbus rogue IP
    res1 = client.post("/api/validate/evidence_01", json={"ip": "198.51.100.77"})
    assert res1.status_code == 200

    # Evidence 02: JWT Auth Policy
    res2 = client.post("/api/validate/evidence_02", json={
        "AllowedAlgorithms": ["RS256"],
        "RequireSignature": True,
        "VerifyIssuer": True,
        "Audience": "scada-telemetry-gateway"
    })
    assert res2.status_code == 200

    # Evidence 03: Industrial Crypto
    res3 = client.post("/api/validate/evidence_03", json={
        "protocol": "TLSv1.3",
        "key_exchange": "ECDHE",
        "cipher": "CHACHA20-POLY1305",
        "mac": "HMAC-SHA256"
    })
    assert res3.status_code == 200

    # Evidence 04: SQLi Parameterized Query - Notice: patch_b is the MIDDLE option!
    res4 = client.post("/api/validate/evidence_04", json={"patch_id": "patch_b"})
    assert res4.status_code == 200
    assert res4.get_json()["game_completed"] is True

def test_detective_cat_hints(client):
    # Verify Detective Cat asset is served
    cat_res = client.get("/static/img/detective_cat.png")
    assert cat_res.status_code == 200
    assert cat_res.content_type.startswith("image/")

    # Initial GET for hints returns 0 revealed
    get_res = client.get("/api/hint/evidence_01")
    assert get_res.status_code == 200
    get_data = get_res.get_json()
    assert get_data["status"] == "success"
    assert get_data["total_revealed"] == 0

    # Unseal first hint via Detective Cat POST
    post_res = client.post("/api/hint/evidence_01")
    assert post_res.status_code == 200
    post_data = post_res.get_json()
    assert post_data["status"] == "success"
    assert post_data["total_revealed"] == 1
    assert "hint" in post_data
    assert post_data["penalty_applied"] == 30

    # Subsequent GET returns the revealed hint without deducting further penalty
    get_res2 = client.get("/api/hint/evidence_01")
    assert get_res2.status_code == 200
    get_data2 = get_res2.get_json()
    assert get_data2["total_revealed"] == 1
    assert len(get_data2["hints_revealed"]) == 1

