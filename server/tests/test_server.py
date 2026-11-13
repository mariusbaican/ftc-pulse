import os
import json
from datetime import datetime, timezone, timedelta
import pytest

from app import app
from config import TEAM_DATA_STORE_PATH, CACHE_TTL_SECONDS
from services.analytics import compute_event_opr
from services.ftc_client import is_store_fresh


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
    status, season, targetTeam, dataSource, fetchedAt, eventsCount >= 14,
    lastUpdated timestamp, cacheTtlSeconds, and availableSeasons list.
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
    assert data["eventsCount"] >= 14
    assert "lastUpdated" in data
    assert data["cacheTtlSeconds"] == 86400
    assert "availableSeasons" in data
    assert len(data["availableSeasons"]) == 7

    # Verify Biobuzz is the first available season and marked isLive
    first_season = data["availableSeasons"][0]
    assert first_season["season"] == 2026
    assert first_season["isLive"] is True
    assert "Biobuzz" in first_season["shortName"]


# =============================================================================
# 3. Team Search Endpoint Tests
# =============================================================================

def test_team_search_matches(client):
    """
    Verifies that searches matching BrickBot #15996 (team number, name, #15996)
    return BrickBot #15996 with pocNotice = null.
    """
    import urllib.parse
    queries = ["15996", "BrickBot", "brickbot", "#15996"]
    for q in queries:
        encoded = urllib.parse.quote(q)
        resp = client.get(f"/api/teams?query={encoded}")
        assert resp.status_code == 200, f"Failed for query '{q}'"
        data = resp.get_json()
        assert data["count"] == 1
        assert len(data["teams"]) == 1
        assert data["teams"][0]["teamNumber"] == 15996
        assert data["pocNotice"] is None


def test_team_search_non_matching(client):
    """
    Verifies that non-matching or empty queries return count 0, empty teams array,
    and pocNotice = null.
    """
    queries = ["", "99999", "colegiul", "random_team"]
    for q in queries:
        resp = client.get(f"/api/teams?query={q}")
        assert resp.status_code == 200, f"Failed for query '{q}'"
        data = resp.get_json()
        assert data["count"] == 0
        assert data["teams"] == []
        assert data["pocNotice"] is None


# =============================================================================
# 4. Season Summary Endpoint Tests
# =============================================================================

def test_season_summary_team_15996(client):
    """
    Verifies GET /api/teams/15996/season-summary defaults to 2026 Biobuzz season
    with computed W-L-T record (3-1-0), best match (282 pts in QM 10),
    mock event (2025_mock_championship), availableSeasons, and seasonsByYear.
    """
    resp = client.get("/api/teams/15996/season-summary")
    assert resp.status_code == 200

    data = resp.get_json()
    assert data["teamNumber"] == 15996
    assert data["season"] == 2026
    assert data["seasonName"] == "BIOBUZZ"
    assert data["worldRanks"] == {"total": 1, "auto": 1, "teleop": 1, "endgame": 1}

    # Check W-L-T record (3W - 1L - 0T)
    rec = data["record"]
    assert rec["wins"] == 3
    assert rec["losses"] == 1
    assert rec["ties"] == 0
    assert rec["matchesPlayed"] == 4
    assert rec["winRate"] == 75.0

    # Check global OPR
    opr = data["globalOpr"]
    assert "totalOpr" in opr and "autoOpr" in opr and "teleopOpr" in opr and "endgameOpr" in opr
    assert isinstance(opr["totalOpr"], (int, float))

    # Check period averages
    assert "periodAverages" in data
    assert "avgWinningMargin" in data["periodAverages"]
    assert "avgScoreMargin" in data["periodAverages"]
    assert data["periodAverages"]["avgScoreMargin"] == data["periodAverages"]["avgWinningMargin"]
    assert data["periodAverages"]["avgScoreMargin"] > 0
    assert "avgPenaltiesAwarded" in data["periodAverages"]
    assert "avgPenaltiesConceded" in data["periodAverages"]
    assert "avgNetPenalties" in data["periodAverages"]

    # Check best match (282 in Qualification 10)
    assert data["bestMatch"] is not None
    assert data["bestMatch"]["score"] == 282
    assert "Qualification 10" in data["bestMatch"]["matchDescription"]
    assert data["bestMatch"]["eventCode"] == "2025_mock_championship"

    # Check events list includes 2025_mock_championship
    event_codes = [ev["eventCode"] for ev in data["events"]]
    assert "2025_mock_championship" in event_codes

    # Check availableSeasons and seasonsByYear
    assert "availableSeasons" in data
    assert len(data["availableSeasons"]) == 7
    assert "seasonsByYear" in data
    assert "2026" in data["seasonsByYear"]
    assert "2025" in data["seasonsByYear"]
    assert "2024" in data["seasonsByYear"]
    assert "2020" in data["seasonsByYear"]
    assert "2018" not in data["seasonsByYear"]
    assert "2019" not in data["seasonsByYear"]
    assert "lastUpdated" in data


def test_season_summary_param_2025(client):
    """
    Verifies GET /api/teams/15996/season-summary?season=2025 returns 2025 DECODE season
    with all 13 snapshot events, peak season OPR from Bucharest Twin Cup, and world ranks.
    """
    resp = client.get("/api/teams/15996/season-summary?season=2025")
    assert resp.status_code == 200

    data = resp.get_json()
    assert data["teamNumber"] == 15996
    assert data["season"] == 2025
    assert data["seasonName"] == "DECODE"
    assert data["worldRanks"] == {"total": 1, "auto": 1, "teleop": 1, "endgame": 1}

    # Verify peak season OPR equals the highest totalOpr event (ROBUOS1: 240.34)
    assert data["globalOpr"]["totalOpr"] == 240.34
    assert data["bestEvent"]["eventCode"] == "ROBUOS1"

    # Check that mock event is NOT present in 2025 events list
    event_codes = [ev["eventCode"] for ev in data["events"]]
    assert "2025_mock_championship" not in event_codes
    assert len(data["events"]) == 13

    # Check events without qual matches
    non_qual_codes = {ev["eventCode"] for ev in data["events"] if not ev["hasQualMatches"]}
    assert non_qual_codes == {"FTCCMP1", "ROCMP", "ROTIOS1"}

    # Check that official events (e.g., ROELT or ROCMPCND) are present
    assert any("ROELT" in code or "ROCMP" in code for code in event_codes)

    # Check metadata fields
    assert "availableSeasons" in data
    assert "seasonsByYear" in data
    assert "lastUpdated" in data
    assert "periodAverages" in data
    assert "avgWinningMargin" in data["periodAverages"]
    assert "avgScoreMargin" in data["periodAverages"]
    assert data["periodAverages"]["avgScoreMargin"] == data["periodAverages"]["avgWinningMargin"]
    assert data["periodAverages"]["avgScoreMargin"] > 0


def test_season_summary_historical_seasons(client):
    """
    Verifies multi-season lookup via ?season= param for historical years and string aliases:
    - ?season=2024 (INTO THE DEEP)
    - ?season=biobuzz (alias -> 2026)
    - ?season=decode (alias -> 2025)
    - ?season=2023 (CENTERSTAGE)
    - ?season=2022 (POWERPLAY)
    - ?season=2021 (FREIGHT FRENZY)
    - ?season=2020 (ULTIMATE GOAL)
    """
    # 2024 Into The Deep
    resp_24 = client.get("/api/teams/15996/season-summary?season=2024")
    assert resp_24.status_code == 200
    d24 = resp_24.get_json()
    assert d24["season"] == 2024
    assert "INTO THE DEEP" in d24["seasonName"]
    assert len(d24["events"]) == 5
    assert d24["bestMatch"]["score"] >= 100

    # ?season=biobuzz alias
    resp_bio = client.get("/api/teams/15996/season-summary?season=biobuzz")
    assert resp_bio.status_code == 200
    assert resp_bio.get_json()["season"] == 2026

    # ?season=decode alias
    resp_dec = client.get("/api/teams/15996/season-summary?season=decode")
    assert resp_dec.status_code == 200
    assert resp_dec.get_json()["season"] == 2025

    # 2023 CenterStage
    resp_23 = client.get("/api/teams/15996/season-summary?season=2023")
    assert resp_23.status_code == 200
    d23 = resp_23.get_json()
    assert d23["season"] == 2023
    assert "CENTERSTAGE" in d23["seasonName"]
    assert len(d23["events"]) == 5

    # 2022 PowerPlay
    resp_22 = client.get("/api/teams/15996/season-summary?season=2022")
    assert resp_22.status_code == 200
    d22 = resp_22.get_json()
    assert d22["season"] == 2022
    assert "POWER PLAY" in d22["seasonName"]
    assert len(d22["events"]) == 2

    # 2021 Freight Frenzy
    resp_21 = client.get("/api/teams/15996/season-summary?season=2021")
    assert resp_21.status_code == 200
    d21 = resp_21.get_json()
    assert d21["season"] == 2021
    assert "FREIGHT FRENZY" in d21["seasonName"]
    assert len(d21["events"]) == 11

    # 2020 Ultimate Goal
    resp_20 = client.get("/api/teams/15996/season-summary?season=2020")
    assert resp_20.status_code == 200
    d20 = resp_20.get_json()
    assert d20["season"] == 2020
    assert "ULTIMATE GOAL" in d20["seasonName"]
    assert len(d20["events"]) == 12


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
    assert "avgWinningMargin" in data["stats"]["averages"]
    assert "avgScoreMargin" in data["stats"]["averages"]
    assert data["stats"]["averages"]["avgScoreMargin"] == data["stats"]["averages"]["avgWinningMargin"]
    # Due to signed score margin calculation, ROELT has a negative margin (-6.9)
    assert data["stats"]["averages"]["avgScoreMargin"] < 0


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
    with season 2026 (Biobuzz), status IN_PROGRESS, activeAlert field,
    and that the alias 2026_biobuzz_mock_championship also resolves.
    """
    # 1. Primary code (2025_mock_championship)
    resp = client.get("/api/events/2025_mock_championship/details")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["event"]["code"] == "2025_mock_championship"
    assert data["event"]["season"] == 2026
    assert data["event"]["name"] == "FTC Biobuzz Live Invitational"
    assert data["event"]["status"] == "IN_PROGRESS"
    assert "activeAlert" in data
    assert len(data["matches"]) > 0
    assert "stats" in data
    assert "averages" in data["stats"]
    assert "avgWinningMargin" in data["stats"]["averages"]
    assert "avgScoreMargin" in data["stats"]["averages"]
    assert data["stats"]["averages"]["avgScoreMargin"] == data["stats"]["averages"]["avgWinningMargin"]
    assert data["stats"]["averages"]["avgScoreMargin"] > 0
    assert data["stats"]["averages"]["avgScoreMargin"] == 30.8

    # 2. Alias code (2026_biobuzz_mock_championship)
    resp_alias = client.get("/api/events/2026_biobuzz_mock_championship/details")
    assert resp_alias.status_code == 200
    data_alias = resp_alias.get_json()
    assert data_alias["event"]["season"] == 2026
    assert data_alias["event"]["status"] == "IN_PROGRESS"


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


# =============================================================================
# 7. Persistent 24-Hour TTL Store Tests
# =============================================================================

def test_is_store_fresh_ttl_logic(tmp_path):
    """
    Verifies that is_store_fresh:
    - Returns False for non-existent file
    - Returns True for a store updated 1 hour ago (< 24h)
    - Returns False for a store updated 25 hours ago (> 24h)
    """
    # Non-existent file
    missing_file = str(tmp_path / "missing.json")
    assert is_store_fresh(missing_file, CACHE_TTL_SECONDS) is False

    # Fresh store (1 hour old)
    fresh_file = str(tmp_path / "fresh.json")
    fresh_time = (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()
    with open(fresh_file, "w") as f:
        json.dump({"lastUpdated": fresh_time}, f)
    assert is_store_fresh(fresh_file, CACHE_TTL_SECONDS) is True

    # Expired store (25 hours old)
    expired_file = str(tmp_path / "expired.json")
    expired_time = (datetime.now(timezone.utc) - timedelta(hours=25)).isoformat()
    with open(expired_file, "w") as f:
        json.dump({"lastUpdated": expired_time}, f)
    assert is_store_fresh(expired_file, CACHE_TTL_SECONDS) is False


def test_persistent_store_file_integrity():
    """
    Verifies that the persistent JSON store file (server/data/brickbot_15996_store.json)
    exists on disk and contains all required multi-season keys and structures.
    """
    assert os.path.exists(TEAM_DATA_STORE_PATH)

    with open(TEAM_DATA_STORE_PATH, "r", encoding="utf-8") as f:
        store = json.load(f)

    assert "lastUpdated" in store
    assert "cacheTtlSeconds" in store
    assert store["cacheTtlSeconds"] == 86400
    assert "availableSeasons" in store
    assert len(store["availableSeasons"]) == 7
    assert "seasonsByYear" in store
    assert len(store["seasonsByYear"]) == 7
    assert "eventsByCode" in store
    assert len(store["eventsByCode"]) >= 14


# =============================================================================
# 8. Functional Tests for New Requirements (Task Separation, Rankings, Teams, VODs)
# =============================================================================

def test_task_separated_opr_calculation():
    """
    Verifies that compute_event_opr correctly separates individual robot tasks
    (robot1Auto / robot2Auto leave points = 3.0, and robot1Teleop / robot2Teleop endgame = 10.0 / 5.0)
    from shared alliance points, computes shared OPR via Ridge regression, and attributes
    individual task averages back to each team.
    """
    matches = [
        {
            "matchNumber": 1,
            "tournamentLevel": "QUAL",
            "scoreRedFinal": 80,
            "scoreBlueFinal": 40,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 201, "station": "Red1"},
                {"teamNumber": 202, "station": "Red2"},
                {"teamNumber": 203, "station": "Blue1"},
                {"teamNumber": 204, "station": "Blue2"},
            ],
        },
        {
            "matchNumber": 2,
            "tournamentLevel": "QUAL",
            "scoreRedFinal": 90,
            "scoreBlueFinal": 50,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 201, "station": "Red1"},
                {"teamNumber": 203, "station": "Red2"},
                {"teamNumber": 202, "station": "Blue1"},
                {"teamNumber": 204, "station": "Blue2"},
            ],
        },
    ]

    qual_scores = [
        {
            "matchNumber": 1,
            "alliances": [
                {
                    "alliance": "Red",
                    "autoPoints": 36,        # Shared 30 + 3 (r1) + 3 (r2)
                    "teleopPoints": 44,      # Driver 34 + 10 (r1) + 0 (r2)
                    "teleopBasePoints": 10,  # Endgame base 10
                    "robot1Auto": True,      # 3.0 pts for 201
                    "robot2Auto": True,      # 3.0 pts for 202
                    "robot1Teleop": "FULL",  # 10.0 pts for 201
                    "robot2Teleop": "NONE",  # 0.0 pts for 202
                },
                {
                    "alliance": "Blue",
                    "autoPoints": 10,
                    "teleopPoints": 30,
                    "teleopBasePoints": 5,
                    "robot1Auto": False,
                    "robot2Auto": True,      # 3.0 pts for 204
                    "robot1Teleop": "PARTIAL", # 5.0 pts for 203
                    "robot2Teleop": "NONE",
                },
            ],
        },
        {
            "matchNumber": 2,
            "alliances": [
                {
                    "alliance": "Red",
                    "autoPoints": 33,        # Shared + individual
                    "teleopPoints": 57,
                    "teleopBasePoints": 15,
                    "robot1Auto": True,      # 3.0 pts for 201
                    "robot2Auto": False,
                    "robot1Teleop": "FULL",  # 10.0 pts for 201
                    "robot2Teleop": "PARTIAL", # 5.0 pts for 203
                },
                {
                    "alliance": "Blue",
                    "autoPoints": 15,
                    "teleopPoints": 35,
                    "teleopBasePoints": 10,
                    "robot1Auto": True,      # 3.0 pts for 202
                    "robot2Auto": False,
                    "robot1Teleop": "FULL",  # 10.0 pts for 202
                    "robot2Teleop": "NONE",
                },
            ],
        },
    ]

    oprs = compute_event_opr(matches, qual_scores)
    assert 201 in oprs
    assert 202 in oprs
    assert 203 in oprs
    assert 204 in oprs

    # Team 201 had robot1Auto=True in both matches -> avg 3.0 auto spec pts
    # and robot1Teleop="FULL" (10.0) in both matches -> avg 10.0 endgame spec pts
    assert oprs[201]["autoOpr"] > 3.0
    assert oprs[201]["endgameOpr"] >= 10.0


def test_event_rankings_and_teams_structure(client):
    """
    Verifies that event details contain:
    - 'rankings': sorted ascending by rank, with keys rank, teamNumber, teamName,
                  wins, losses, ties, matchesPlayed, rp, tb1, totalOpr, isTargetTeam.
    - 'teams': sorted ascending by teamNumber, with keys teamNumber, teamName,
               rank, record, totalOpr, isTargetTeam.
    """
    # 1. Mock Championship Event
    resp_mock = client.get("/api/events/2025_mock_championship/details")
    assert resp_mock.status_code == 200
    d_mock = resp_mock.get_json()

    assert "rankings" in d_mock
    assert "teams" in d_mock
    assert len(d_mock["rankings"]) == 12
    assert len(d_mock["teams"]) == 12

    # Check rankings sorting and fields
    mock_ranks = [r["rank"] for r in d_mock["rankings"]]
    assert mock_ranks == sorted(mock_ranks)
    for r in d_mock["rankings"]:
        for field in ("rank", "teamNumber", "teamName", "wins", "losses", "ties", "matchesPlayed", "rp", "tb1", "tb2", "avgScore", "totalOpr", "isTargetTeam"):
            assert field in r

    # Check teams sorting and fields
    mock_team_nums = [t["teamNumber"] for t in d_mock["teams"]]
    assert mock_team_nums == sorted(mock_team_nums)
    for t in d_mock["teams"]:
        for field in ("teamNumber", "teamName", "rank", "record", "totalOpr", "isTargetTeam"):
            assert field in t

    # 2. Official Snapshot Event (ROFOS)
    resp_official = client.get("/api/events/ROFOS/details")
    assert resp_official.status_code == 200
    d_off = resp_official.get_json()

    assert "rankings" in d_off
    assert "teams" in d_off
    assert len(d_off["rankings"]) > 0
    assert len(d_off["teams"]) > 0

    off_ranks = [r["rank"] for r in d_off["rankings"]]
    assert off_ranks == sorted(off_ranks)
    for r in d_off["rankings"]:
        for field in ("rank", "teamNumber", "teamName", "wins", "losses", "ties", "matchesPlayed", "rp", "tb1", "tb2", "avgScore", "totalOpr", "isTargetTeam"):
            assert field in r

    off_team_nums = [t["teamNumber"] for t in d_off["teams"]]
    assert off_team_nums == sorted(off_team_nums)


def test_match_vod_timestamps(client):
    """
    Verifies that matches with a stream/VOD URL have:
    - vodTimestampSeconds: int
    - vodStartSeconds: int
    - vodEndSeconds: vodStartSeconds + 165
    And matches without VOD URL have null for all three.
    """
    # Mock event has stream url
    resp_mock = client.get("/api/events/2025_mock_championship/details")
    assert resp_mock.status_code == 200
    matches_mock = resp_mock.get_json()["matches"]

    for m in matches_mock:
        if m.get("vodUrl"):
            assert m["vodStartSeconds"] is not None
            assert m["vodEndSeconds"] == m["vodStartSeconds"] + 165
            assert m["vodTimestampSeconds"] == m["vodStartSeconds"]

    # Historical event ROELT has no stream url
    resp_hist = client.get("/api/events/ROELT/details")
    assert resp_hist.status_code == 200
    matches_hist = resp_hist.get_json()["matches"]

    for m in matches_hist:
        assert m.get("vodUrl") is None
        assert m.get("vodStartSeconds") is None
        assert m.get("vodEndSeconds") is None
        assert m.get("vodTimestampSeconds") is None


# =============================================================================
# 8. Practice Matches Filter & Playoff Ordering Tests
# =============================================================================

def test_practice_matches_ignored(client):
    """
    Verifies that practice matches (which exist in raw data for FTCCMP1GOOD and ROTIS2)
    are strictly excluded from event match schedules and analytics.
    """
    for event_code in ("FTCCMP1GOOD", "ROTIS2"):
        resp = client.get(f"/api/events/{event_code}/details")
        assert resp.status_code == 200
        matches = resp.get_json()["matches"]
        assert len(matches) > 0

        for m in matches:
            level = str(m.get("tournamentLevel", "")).upper()
            desc = str(m.get("description", "")).upper()
            assert "PRACTICE" not in level, f"Practice match found in {event_code}: {m}"
            assert "PRACTICE" not in desc, f"Practice match found in {event_code}: {m}"


def test_playoffs_sorted_before_qualifications(client):
    """
    Verifies that in multi-phase tournaments (e.g. FTCCMP1GOOD, ROCMPCND, ROELT):
    - All playoff matches appear completely before qualification matches.
    - Playoff matches are sorted chronologically by (series, matchNumber, actualStartTime).
    - Qualification matches are sorted chronologically by (matchNumber, series).
    """
    for event_code in ("FTCCMP1GOOD", "ROCMPCND", "ROELT"):
        resp = client.get(f"/api/events/{event_code}/details")
        assert resp.status_code == 200
        matches = resp.get_json()["matches"]

        playoff_matches = [m for m in matches if "QUAL" not in str(m.get("tournamentLevel", "")).upper()]
        qual_matches = [m for m in matches if "QUAL" in str(m.get("tournamentLevel", "")).upper()]

        assert len(playoff_matches) > 0, f"Expected playoffs in {event_code}"
        assert len(qual_matches) > 0, f"Expected qualifications in {event_code}"

        # Verify playoffs come completely before qualification matches
        expected_matches = playoff_matches + qual_matches
        actual_ids = [m["matchId"] for m in matches]
        expected_ids = [m["matchId"] for m in expected_matches]
        assert actual_ids == expected_ids

        # Verify playoff chronological ordering: series ascending
        playoff_keys = [(int(m.get("series") or 0), int(m.get("matchNumber") or 0)) for m in playoff_matches]
        assert playoff_keys == sorted(playoff_keys)

        # Verify qual chronological ordering: matchNumber ascending
        qual_keys = [(int(m.get("matchNumber") or 0), int(m.get("series") or 0)) for m in qual_matches]
        assert qual_keys == sorted(qual_keys)


# =============================================================================
# 9. Match Team Field Flags (onField, dq, noShow) & 3-Team Alliances
# =============================================================================

def test_match_teams_field_presence_and_3team_alliances(client):
    """
    Verifies that:
    - Every team dict in redAlliance and blueAlliance contains onField, dq, and noShow booleans.
    - 3-team playoff alliances (e.g. FTCCMP1GOOD) preserve all 3 teams per alliance with the
      3rd backup team correctly marked onField=False and noShow=True.
    """
    resp = client.get("/api/events/FTCCMP1GOOD/details")
    assert resp.status_code == 200
    matches = resp.get_json()["matches"]

    found_3_team_alliance = False
    found_off_field_team = False

    for m in matches:
        for alliance_color in ("redAlliance", "blueAlliance"):
            alliance = m[alliance_color]
            assert len(alliance) in (2, 3), f"Unexpected alliance size {len(alliance)} in {m['matchId']}"
            if len(alliance) == 3:
                found_3_team_alliance = True

            for t in alliance:
                assert "onField" in t
                assert "dq" in t
                assert "noShow" in t
                assert "yellowCard" in t
                assert "redCard" in t
                assert isinstance(t["onField"], bool)
                assert isinstance(t["dq"], bool)
                assert isinstance(t["noShow"], bool)
                assert isinstance(t["yellowCard"], bool)
                assert isinstance(t["redCard"], bool)

                if t["onField"] is False:
                    found_off_field_team = True
                    assert t["noShow"] is True, "off-field team must have noShow=True"

        # Verify redTeams and blueTeams aliases exist
        assert "redTeams" in m
        assert "blueTeams" in m
        assert m["redTeams"] == m["redAlliance"]
        assert m["blueTeams"] == m["blueAlliance"]

    assert found_3_team_alliance, "Expected 3-team alliances in FTCCMP1GOOD playoffs"
    assert found_off_field_team, "Expected at least one backup team with onField=False"


# =============================================================================
# 10. Detailed Game-Task Breakdown (taskBreakdown) Tests
# =============================================================================

def test_detailed_game_task_breakdown(client):
    """
    Verifies that every completed match includes a comprehensive 'taskBreakdown':
    - Contains both 'red' and 'blue' alliance task dictionaries.
    - All 24 scoring fields exist with correct types and mathematical integrity.
    - In playoff matches (where FIRST API does not provide qual breakdown), scores_by_match
      does not leak qualification match scores into playoff match 1.
    """
    # 1. Test Mock Championship event
    resp_mock = client.get("/api/events/2025_mock_championship/details")
    assert resp_mock.status_code == 200
    matches_mock = resp_mock.get_json()["matches"]

    for m in matches_mock:
        if m.get("status") == "COMPLETED":
            tb = m.get("taskBreakdown")
            assert tb is not None, f"Missing taskBreakdown in {m['matchId']}"
            for color in ("red", "blue"):
                assert color in tb
                b = tb[color]
                # Check required fields
                assert isinstance(b["robot1Auto"], bool)
                assert isinstance(b["robot2Auto"], bool)
                assert isinstance(b["autoTotal"], int)
                assert isinstance(b["teleopTotal"], int)
                assert isinstance(b["endgameBasePoints"], int)
                assert isinstance(b["majorFouls"], int)
                assert isinstance(b["minorFouls"], int)
                assert isinstance(b["opponentMajorFouls"], int)
                assert isinstance(b["opponentMinorFouls"], int)
                assert isinstance(b["yellowCards"], int)
                assert isinstance(b["redCards"], int)
                assert isinstance(b["cardedTeams"], list)
                assert isinstance(b["nonPenaltyTotal"], int)
                assert isinstance(b["totalScore"], int)
                assert b["nonPenaltyTotal"] == b["autoTotal"] + b["teleopTotal"] + b["endgameBasePoints"]
        else:
            assert m.get("taskBreakdown") is None

    # 2. Test FTCCMP1GOOD (with playoffs and qualifications)
    resp_ftc = client.get("/api/events/FTCCMP1GOOD/details")
    assert resp_ftc.status_code == 200
    matches_ftc = resp_ftc.get_json()["matches"]

    playoff_1 = next(m for m in matches_ftc if m.get("series") == 3 and m.get("matchNumber") == 1)
    tb_playoff = playoff_1.get("taskBreakdown")
    assert tb_playoff is not None
    # Verify playoff match 1 red total matches scoreRedFinal exactly
    assert tb_playoff["red"]["totalScore"] == playoff_1["scoreRedFinal"]

    # Verify playoff match 1 does NOT have qualification match 1's breakdown
    qual_resp = client.get("/api/events/FTCCMP1GOOD/details")
    qual_14 = next(m for m in matches_ftc if "QUAL" in str(m.get("tournamentLevel", "")).upper())
    assert tb_playoff["red"]["totalScore"] != qual_14["scoreRedFinal"]


# =============================================================================
# 11. Event OPR Ranks (oprRanks) Tests
# =============================================================================

def test_opr_ranks_in_event_stats(client):
    """
    Verifies that eventDetail stats contains 'oprRanks' with total, auto, teleop, endgame ranks.
    """
    for code in ("2025_mock_championship", "ROFOS", "FTCCMP1GOOD"):
        resp = client.get(f"/api/events/{code}/details")
        assert resp.status_code == 200
        stats = resp.get_json()["stats"]
        assert "oprRanks" in stats, f"Missing oprRanks in stats for {code}"
        opr_ranks = stats["oprRanks"]
        for phase in ("total", "auto", "teleop", "endgame"):
            assert phase in opr_ranks, f"Missing {phase} in oprRanks for {code}"
            assert isinstance(opr_ranks[phase], int)
            assert opr_ranks[phase] >= 1


# =============================================================================
# 12. Signed Average Score Margin & Penalty Decomposition Tests
# =============================================================================

def test_signed_average_score_margin(client):
    """
    Verifies that avgScoreMargin in stats["averages"] correctly computes the signed
    score margin across all completed matches played by the team:
    - Events where team had overall negative margin (e.g. ROELT, ROTIS2, RCMP) have avgScoreMargin < 0.
    - Events where team had overall positive margin (e.g. FTCCMP1GOOD, ROFOS, 2025_mock_championship) have avgScoreMargin > 0.
    - Both avgScoreMargin and avgWinningMargin exist and match.
    """
    # 1. Negative margin events (played qualification matches with net negative score margin)
    for code in ("ROELT", "ROTIS2"):
        resp = client.get(f"/api/events/{code}/details")
        assert resp.status_code == 200
        stats = resp.get_json()["stats"]
        avg = stats["averages"]
        assert "avgScoreMargin" in avg
        assert "avgWinningMargin" in avg
        assert avg["avgScoreMargin"] == avg["avgWinningMargin"]
        assert avg["avgScoreMargin"] < 0, f"Expected negative margin for {code}, got {avg['avgScoreMargin']}"

    # Non-qual event has 0.0
    resp_rcmp = client.get("/api/events/ROCMP/details")
    assert resp_rcmp.status_code == 200
    assert resp_rcmp.get_json()["stats"]["averages"]["avgScoreMargin"] == 0.0

    # 2. Positive margin events
    for code in ("FTCCMP1GOOD", "ROFOS", "2025_mock_championship"):
        resp = client.get(f"/api/events/{code}/details")
        assert resp.status_code == 200
        stats = resp.get_json()["stats"]
        avg = stats["averages"]
        assert "avgScoreMargin" in avg
        assert "avgWinningMargin" in avg
        assert avg["avgScoreMargin"] == avg["avgWinningMargin"]
        assert avg["avgScoreMargin"] > 0, f"Expected positive margin for {code}, got {avg['avgScoreMargin']}"

    # 3. Specific expected values
    resp_mock = client.get("/api/events/2025_mock_championship/details")
    assert resp_mock.get_json()["stats"]["averages"]["avgScoreMargin"] == 30.8

    resp_ftc = client.get("/api/events/FTCCMP1GOOD/details")
    assert resp_ftc.get_json()["stats"]["averages"]["avgScoreMargin"] == 83.7


def test_penalty_foul_decomposition_fields(client):
    """
    Verifies that taskBreakdown contains majorFouls, minorFouls, opponentMajorFouls,
    and opponentMinorFouls with proper integer values and foul point consistency.
    """
    resp = client.get("/api/events/FTCCMP1GOOD/details")
    assert resp.status_code == 200
    matches = resp.get_json()["matches"]

    checked_match_count = 0
    for m in matches:
        tb = m.get("taskBreakdown")
        if not tb:
            continue
        for side in ("red", "blue"):
            side_tasks = tb[side]
            assert "majorFouls" in side_tasks
            assert "minorFouls" in side_tasks
            assert "opponentMajorFouls" in side_tasks
            assert "opponentMinorFouls" in side_tasks
            assert isinstance(side_tasks["majorFouls"], int)
            assert isinstance(side_tasks["minorFouls"], int)
            assert isinstance(side_tasks["opponentMajorFouls"], int)
            assert isinstance(side_tasks["opponentMinorFouls"], int)
            assert side_tasks["majorFouls"] >= 0
            assert side_tasks["minorFouls"] >= 0
            assert side_tasks["opponentMajorFouls"] >= 0
            assert side_tasks["opponentMinorFouls"] >= 0

        # Opponent fouls committed by blue should match opponent fouls awarded to red
        assert tb["red"]["opponentMajorFouls"] == tb["blue"]["majorFouls"]
        assert tb["red"]["opponentMinorFouls"] == tb["blue"]["minorFouls"]
        assert tb["blue"]["opponentMajorFouls"] == tb["red"]["majorFouls"]
        assert tb["blue"]["opponentMinorFouls"] == tb["red"]["minorFouls"]
        checked_match_count += 1

    assert checked_match_count > 0


def test_penalty_averages_in_event_stats(client):
    """
    Verifies Item 12:
    - avgPenaltiesAwarded, avgPenaltiesConceded, and avgNetPenalties exist in stats["averages"]
      for every event.
    - Mathematical relation avgNetPenalties == round(avgPenaltiesAwarded - avgPenaltiesConceded, 1) holds.
    - Team season summary periodAverages also contains penalty averages.
    """
    for code in ("2025_mock_championship", "FTCCMP1GOOD", "ROFOS", "ROELT"):
        resp = client.get(f"/api/events/{code}/details")
        assert resp.status_code == 200
        stats = resp.get_json()["stats"]
        averages = stats.get("averages", {})
        assert "avgPenaltiesAwarded" in averages
        assert "avgPenaltiesConceded" in averages
        assert "avgNetPenalties" in averages
        assert isinstance(averages["avgPenaltiesAwarded"], (int, float))
        assert isinstance(averages["avgPenaltiesConceded"], (int, float))
        assert isinstance(averages["avgNetPenalties"], (int, float))
        expected_net = round(averages["avgPenaltiesAwarded"] - averages["avgPenaltiesConceded"], 1)
        assert abs(averages["avgNetPenalties"] - expected_net) < 1e-4

    # Season summary check
    resp_sum = client.get("/api/teams/15996/season-summary?season=2025")
    assert resp_sum.status_code == 200
    p_avg = resp_sum.get_json()["periodAverages"]
    assert "avgPenaltiesAwarded" in p_avg
    assert "avgPenaltiesConceded" in p_avg
    assert "avgNetPenalties" in p_avg
    assert isinstance(p_avg["avgPenaltiesAwarded"], (int, float))
    assert isinstance(p_avg["avgPenaltiesConceded"], (int, float))
    assert isinstance(p_avg["avgNetPenalties"], (int, float))



