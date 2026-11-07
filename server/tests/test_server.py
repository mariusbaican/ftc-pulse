import pytest
from app import app
from services.analytics import compute_event_opr


@pytest.fixture
def client():
    """Flask test client fixture."""
    app.config["TESTING"] = True
    with app.test_client() as client:
        yield client


# =============================================================================
# 1. OPR Mathematical Accuracy Test (Known Synthetic 4-Team Matrix)
# =============================================================================

def test_opr_solver_mathematical_accuracy():
    """
    Verifies that the Ridge-regularized OLS OPR solver correctly recovers known
    individual team offensive contributions from alliance match scores.

    Synthetic Setup:
      Teams: 101, 102, 103, 104
      True OPR:
        Team 101: total=30, auto=10, teleop=15, endgame=5
        Team 102: total=50, auto=15, teleop=25, endgame=10
        Team 103: total=70, auto=20, teleop=35, endgame=15
        Team 104: total=90, auto=25, teleop=45, endgame=20

      Matches:
        Match 1: Red (101, 102) vs Blue (103, 104) -> Red total=80, Blue total=160
        Match 2: Red (101, 103) vs Blue (102, 104) -> Red total=100, Blue total=140
        Match 3: Red (101, 104) vs Blue (102, 103) -> Red total=120, Blue total=120
    """
    synthetic_matches = [
        {
            "matchNumber": 1,
            "tournamentLevel": "QUAL",
            "scoreRedFinal": 80,
            "scoreBlueFinal": 160,
            "scoreRedAuto": 25,
            "scoreBlueAuto": 45,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 101, "station": "Red1"},
                {"teamNumber": 102, "station": "Red2"},
                {"teamNumber": 103, "station": "Blue1"},
                {"teamNumber": 104, "station": "Blue2"},
            ],
        },
        {
            "matchNumber": 2,
            "tournamentLevel": "QUAL",
            "scoreRedFinal": 100,
            "scoreBlueFinal": 140,
            "scoreRedAuto": 30,
            "scoreBlueAuto": 40,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 101, "station": "Red1"},
                {"teamNumber": 103, "station": "Red2"},
                {"teamNumber": 102, "station": "Blue1"},
                {"teamNumber": 104, "station": "Blue2"},
            ],
        },
        {
            "matchNumber": 3,
            "tournamentLevel": "QUAL",
            "scoreRedFinal": 120,
            "scoreBlueFinal": 120,
            "scoreRedAuto": 35,
            "scoreBlueAuto": 35,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 101, "station": "Red1"},
                {"teamNumber": 104, "station": "Red2"},
                {"teamNumber": 102, "station": "Blue1"},
                {"teamNumber": 103, "station": "Blue2"},
            ],
        },
    ]

    synthetic_qual_scores = [
        {
            "matchNumber": 1,
            "alliances": [
                {
                    "alliance": "Red",
                    "autoPoints": 25,
                    "teleopPoints": 55,       # 40 driver + 15 base
                    "teleopBasePoints": 15,   # endgame
                },
                {
                    "alliance": "Blue",
                    "autoPoints": 45,
                    "teleopPoints": 115,      # 80 driver + 35 base
                    "teleopBasePoints": 35,   # endgame
                },
            ],
        },
        {
            "matchNumber": 2,
            "alliances": [
                {
                    "alliance": "Red",
                    "autoPoints": 30,
                    "teleopPoints": 70,       # 50 driver + 20 base
                    "teleopBasePoints": 20,
                },
                {
                    "alliance": "Blue",
                    "autoPoints": 40,
                    "teleopPoints": 100,      # 70 driver + 30 base
                    "teleopBasePoints": 30,
                },
            ],
        },
        {
            "matchNumber": 3,
            "alliances": [
                {
                    "alliance": "Red",
                    "autoPoints": 35,
                    "teleopPoints": 85,       # 60 driver + 25 base
                    "teleopBasePoints": 25,
                },
                {
                    "alliance": "Blue",
                    "autoPoints": 35,
                    "teleopPoints": 85,       # 60 driver + 25 base
                    "teleopBasePoints": 25,
                },
            ],
        },
    ]

    opr_results = compute_event_opr(synthetic_matches, synthetic_qual_scores)

    assert 101 in opr_results
    assert 102 in opr_results
    assert 103 in opr_results
    assert 104 in opr_results

    # With lambda = 1e-4, recovered values match true values within 0.05 tolerance
    assert abs(opr_results[101]["totalOpr"] - 30.0) < 0.05
    assert abs(opr_results[101]["autoOpr"] - 10.0) < 0.05
    assert abs(opr_results[101]["teleopOpr"] - 15.0) < 0.05
    assert abs(opr_results[101]["endgameOpr"] - 5.0) < 0.05

    assert abs(opr_results[102]["totalOpr"] - 50.0) < 0.05
    assert abs(opr_results[102]["autoOpr"] - 15.0) < 0.05
    assert abs(opr_results[102]["teleopOpr"] - 25.0) < 0.05
    assert abs(opr_results[102]["endgameOpr"] - 10.0) < 0.05

    assert abs(opr_results[103]["totalOpr"] - 70.0) < 0.05
    assert abs(opr_results[103]["autoOpr"] - 20.0) < 0.05
    assert abs(opr_results[103]["teleopOpr"] - 35.0) < 0.05
    assert abs(opr_results[103]["endgameOpr"] - 15.0) < 0.05

    assert abs(opr_results[104]["totalOpr"] - 90.0) < 0.05
    assert abs(opr_results[104]["autoOpr"] - 25.0) < 0.05
    assert abs(opr_results[104]["teleopOpr"] - 45.0) < 0.05
    assert abs(opr_results[104]["endgameOpr"] - 20.0) < 0.05


# =============================================================================
# 2. Health Endpoint Test
# =============================================================================

def test_health_endpoint(client):
    """
    Verifies that GET /api/health returns HTTP 200 with required metadata fields:
    status, season, targetTeam, dataSource, fetchedAt, and eventsCount.
    """
    response = client.get("/api/health")
    assert response.status_code == 200

    data = response.get_json()
    assert data["status"] == "ok"
    assert data["season"] == 2025
    assert data["targetTeam"] == 15996
    assert data["dataSource"] in ("live_api", "fallback_snapshot", "empty_seed")
    assert "fetchedAt" in data
    assert isinstance(data["eventsCount"], int)
    assert data["eventsCount"] >= 14  # 13 official + 1 mock


# =============================================================================
# 3. Team Search Endpoint Tests
# =============================================================================

def test_team_search_matches(client):
    """
    Verifies that searches matching BrickBot #15996 (team number, name, empty query)
    return BrickBot #15996 with pocNotice = null.
    """
    queries = ["15996", "BrickBot", "", "brickbot", "#15996", "colegiul"]
    for q in queries:
        resp = client.get(f"/api/teams?query={q}")
        assert resp.status_code == 200, f"Failed for query '{q}'"
        data = resp.get_json()
        assert data["count"] == 1
        assert len(data["teams"]) == 1
        assert data["teams"][0]["teamNumber"] == 15996
        assert data["pocNotice"] is None


def test_team_search_non_matching(client):
    """
    Verifies that searches for any other team return count 0, empty teams array,
    and a clear PoC notice.
    """
    resp = client.get("/api/teams?query=99999")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["count"] == 0
    assert data["teams"] == []
    assert "In this proof of concept, only BrickBot #15996 data is hosted" in data["pocNotice"]


# =============================================================================
# 4. Season Summary Endpoint Tests
# =============================================================================

def test_season_summary_team_15996(client):
    """
    Verifies GET /api/teams/15996/season-summary returns 200 with computed
    W-L-T record, global OPR, period averages, best match, best event, and events list
    including 2025_mock_championship.
    """
    resp = client.get("/api/teams/15996/season-summary")
    assert resp.status_code == 200

    data = resp.get_json()
    assert data["teamNumber"] == 15996
    assert data["season"] == 2025

    # Check W-L-T record
    rec = data["record"]
    assert "wins" in rec and "losses" in rec and "ties" in rec
    assert "winRate" in rec and "matchesPlayed" in rec
    assert rec["wins"] + rec["losses"] + rec["ties"] == rec["matchesPlayed"]

    # Check global OPR
    opr = data["globalOpr"]
    assert "totalOpr" in opr and "autoOpr" in opr and "teleopOpr" in opr and "endgameOpr" in opr
    assert isinstance(opr["totalOpr"], (int, float))

    # Check best match
    assert data["bestMatch"] is not None
    assert "score" in data["bestMatch"]
    assert "eventName" in data["bestMatch"]

    # Check events list includes 2025_mock_championship
    event_codes = [ev["eventCode"] for ev in data["events"]]
    assert "2025_mock_championship" in event_codes


def test_season_summary_invalid_team(client):
    """
    Verifies GET /api/teams/<other>/season-summary returns 404 TEAM_NOT_FOUND.
    """
    resp = client.get("/api/teams/99999/season-summary")
    assert resp.status_code == 404
    data = resp.get_json()
    assert data["error"] == "TEAM_NOT_FOUND"


# =============================================================================
# 5. Event Details Endpoint Tests
# =============================================================================

def test_event_details_roelt(client):
    """
    Verifies GET /api/events/ROELT/details returns 200 with event metadata,
    stats (OPR, period averages), and match schedule.
    """
    resp = client.get("/api/events/ROELT/details")
    assert resp.status_code == 200
    data = resp.get_json()
    assert "event" in data
    assert "stats" in data
    assert "matches" in data
    assert "opr" in data["stats"]
    assert "averages" in data["stats"]


def test_event_details_case_insensitivity(client):
    """
    Verifies that event code lookup is case-insensitive (roelt vs ROELT).
    """
    resp = client.get("/api/events/roelt/details")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["event"]["code"] == "ROELT"


def test_event_details_mock_championship(client):
    """
    Verifies GET /api/events/2025_mock_championship/details returns 200
    with activeAlert field present.
    """
    resp = client.get("/api/events/2025_mock_championship/details")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["event"]["code"] == "2025_mock_championship"
    assert data["event"]["status"] == "IN_PROGRESS"
    assert "activeAlert" in data
    assert len(data["matches"]) > 0


def test_event_details_not_found(client):
    """
    Verifies GET /api/events/NON_EXISTENT_XYZ/details returns 404 EVENT_NOT_FOUND.
    """
    resp = client.get("/api/events/NON_EXISTENT_XYZ/details")
    assert resp.status_code == 404
    data = resp.get_json()
    assert data["error"] == "EVENT_NOT_FOUND"


# =============================================================================
# 6. Mock Queue Alert Lifecycle & Monotonic Counter Test
# =============================================================================

def test_mock_queue_alert_lifecycle(client):
    """
    Verifies POST /api/mock/trigger-queue-alert followed by GET /api/mock/current-alert
    and POST /api/mock/clear-alert:
    - Triggering an alert creates active alert state and returns HTTP 201.
    - Subsequent alert triggers increment alertId monotonically.
    - Clearing the alert sets active=False and clears the payload.
    """
    # 1. Clear any preexisting alert
    clear_resp = client.post("/api/mock/clear-alert")
    assert clear_resp.status_code == 200
    assert clear_resp.get_json()["active"] is False

    # Check alert is cleared
    curr_resp = client.get("/api/mock/current-alert")
    assert curr_resp.status_code == 200
    curr_data = curr_resp.get_json()
    assert curr_data["active"] is False
    assert curr_data["alert"] is None

    # 2. Trigger first alert
    trigger_payload_1 = {
        "matchNumber": "QM-12",
        "field": "Field 1",
        "alliance": "Red",
        "estimatedTime": "14:15",
    }
    t1_resp = client.post("/api/mock/trigger-queue-alert", json=trigger_payload_1)
    assert t1_resp.status_code == 201
    t1_data = t1_resp.get_json()
    assert t1_data["active"] is True
    alert_1 = t1_data["alert"]
    id_1 = alert_1["alertId"]
    assert alert_1["matchNumber"] == "QM-12"
    assert alert_1["field"] == "Field 1"
    assert alert_1["alliance"] == "Red"
    assert alert_1["teamNumber"] == 15996

    # Verify GET returns the active alert
    curr2_resp = client.get("/api/mock/current-alert")
    assert curr2_resp.status_code == 200
    curr2_data = curr2_resp.get_json()
    assert curr2_data["active"] is True
    assert curr2_data["alert"]["alertId"] == id_1

    # 3. Trigger second alert and verify monotonic alertId increment
    trigger_payload_2 = {
        "matchNumber": "QM-18",
        "field": "Field 2",
        "alliance": "Blue",
        "estimatedTime": "15:40",
    }
    t2_resp = client.post("/api/mock/trigger-queue-alert", json=trigger_payload_2)
    assert t2_resp.status_code == 201
    t2_data = t2_resp.get_json()
    id_2 = t2_data["alert"]["alertId"]
    assert id_2 > id_1  # Monotonically increasing

    # 4. Clear alert
    clear2_resp = client.post("/api/mock/clear-alert")
    assert clear2_resp.status_code == 200
    assert clear2_resp.get_json()["active"] is False

    curr3_resp = client.get("/api/mock/current-alert")
    assert curr3_resp.status_code == 200
    assert curr3_resp.get_json()["active"] is False
    assert curr3_resp.get_json()["alert"] is None
