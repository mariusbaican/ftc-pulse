import os
import sys
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional

# Ensure server root directory is at the beginning of the python import path
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from flask import Flask, jsonify, request
from flask_cors import CORS

from config import (
    FTC_SEASON,
    SERVER_PORT,
    TARGET_TEAM,
    TEAM_DATA_STORE_PATH,
    CACHE_TTL_SECONDS,
    SUPPORTED_SEASONS,
)
from services.analytics import (
    compute_event_opr,
    process_all_season_data,
    build_complete_multi_season_store,
    AVAILABLE_SEASONS,
)
from services.ftc_client import fetch_or_load_season_raw_data, is_store_fresh
from services.mock_event import alert_manager, build_mock_championship_event

# Initialize Flask application
app = Flask(__name__)
# Enable CORS for all /api/* routes
CORS(app, resources={r"/api/*": {"origins": "*"}})

# Global in-memory data store and metadata
DATA_STORE: Dict[str, Any] = {}
DATA_SOURCE_META: Dict[str, Any] = {
    "dataSource": "fallback_snapshot",
    "fetchedAt": datetime.now(timezone.utc).isoformat(),
}


def init_data_store(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Initializes or refreshes the in-memory data store.
    Checks if server/data/brickbot_15996_store.json exists and is fresh (< 24h).
    If fresh and not force_refresh, loads directly from file without external requests.
    Otherwise queries raw season data (falling back to snapshot if offline),
    builds all seasons, attaches Biobuzz mock event, writes to persistent store, and serves it.
    """
    global DATA_STORE, DATA_SOURCE_META

    if not force_refresh and is_store_fresh(TEAM_DATA_STORE_PATH, CACHE_TTL_SECONDS):
        try:
            with open(TEAM_DATA_STORE_PATH, "r", encoding="utf-8") as f:
                DATA_STORE = json.load(f)
            DATA_SOURCE_META["dataSource"] = DATA_STORE.get("dataSource", "fallback_snapshot")
            DATA_SOURCE_META["fetchedAt"] = DATA_STORE.get(
                "fetchedAt", DATA_STORE.get("lastUpdated", datetime.now(timezone.utc).isoformat())
            )
            return DATA_STORE
        except Exception:
            pass

    raw_data = fetch_or_load_season_raw_data(force_refresh=force_refresh)
    mock_bundle = build_mock_championship_event()
    DATA_STORE = build_complete_multi_season_store(raw_data, mock_bundle)

    # Persist store to disk
    try:
        os.makedirs(os.path.dirname(TEAM_DATA_STORE_PATH), exist_ok=True)
        with open(TEAM_DATA_STORE_PATH, "w", encoding="utf-8") as f:
            json.dump(DATA_STORE, f, indent=2, ensure_ascii=False)
    except Exception:
        pass

    DATA_SOURCE_META["dataSource"] = DATA_STORE.get("dataSource", "fallback_snapshot")
    DATA_SOURCE_META["fetchedAt"] = DATA_STORE.get(
        "fetchedAt", datetime.now(timezone.utc).isoformat()
    )
    return DATA_STORE


# Hydrate DATA_STORE on module import
init_data_store(force_refresh=False)


def resolve_season_key(raw_season: Optional[str]) -> str:
    """
    Maps user-supplied season parameter to a standard year string ("2026", "2025", etc.).
    """
    if not raw_season:
        return "2026"
    cleaned = str(raw_season).strip().lower()
    alias_map = {
        "2026": "2026",
        "biobuzz": "2026",
        "2025": "2025",
        "decode": "2025",
        "2024": "2024",
        "into the deep": "2024",
        "intothedeep": "2024",
        "2023": "2023",
        "centerstage": "2023",
        "2022": "2022",
        "power play": "2022",
        "powerplay": "2022",
        "2021": "2021",
        "freight frenzy": "2021",
        "freightfrenzy": "2021",
        "2020": "2020",
        "ultimate goal": "2020",
        "ultimategoal": "2020",
        "2019": "2019",
        "skystone": "2019",
        "2018": "2018",
        "rover ruckus": "2018",
        "roverruckus": "2018",
    }
    return alias_map.get(cleaned, cleaned)


# -----------------------------------------------------------------------------
# REST API Endpoints
# -----------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Returns server health, season info, target team, data source, event count,
    lastUpdated timestamp, cache TTL in seconds, and available seasons list.
    """
    events_count = len(DATA_STORE.get("eventsByCode", {}))
    return jsonify({
        "status": "ok",
        "season": FTC_SEASON,
        "targetTeam": TARGET_TEAM,
        "dataSource": DATA_SOURCE_META.get("dataSource", "fallback_snapshot"),
        "fetchedAt": DATA_SOURCE_META.get("fetchedAt", ""),
        "eventsCount": events_count,
        "lastUpdated": DATA_STORE.get("lastUpdated", DATA_SOURCE_META.get("fetchedAt", "")),
        "cacheTtlSeconds": CACHE_TTL_SECONDS,
        "availableSeasons": DATA_STORE.get("availableSeasons", []),
    }), 200


@app.route("/api/teams", methods=["GET"])
def search_teams():
    """
    Team search endpoint (PoC).
    Resolves searches matching BrickBot #15996. Non-matching or empty queries return an empty
    list (count: 0, teams: [], pocNotice: None).
    """
    raw_query = request.args.get("query", "")
    cleaned = raw_query.strip().lower()
    q_norm = cleaned.replace("#", "").strip()

    is_match = bool(
        q_norm != ""
        and (
            q_norm in "15996"
            or "15996" in q_norm
            or q_norm in "brickbot"
            or "brickbot" in q_norm
        )
    )

    if is_match:
        team_profile = DATA_STORE.get("team", {})
        return jsonify({
            "query": raw_query,
            "count": 1,
            "teams": [team_profile],
            "pocNotice": None,
        }), 200
    else:
        return jsonify({
            "query": raw_query,
            "count": 0,
            "teams": [],
            "pocNotice": None,
        }), 200


@app.route("/api/teams/<int:team_number>/season-summary", methods=["GET"])
def get_season_summary(team_number: int):
    """
    Returns the aggregated season summary, global OPR, period averages, W-L-T record,
    best match, best event, event list, available seasons, and full seasonsByYear map.
    Supports optional ?season=<int|string> query parameter (defaults to 2026 Biobuzz).
    """
    if team_number != TARGET_TEAM:
        return jsonify({
            "error": "TEAM_NOT_FOUND",
            "message": f"Only team {TARGET_TEAM} (BrickBot) is supported in this PoC.",
        }), 404

    raw_season = request.args.get("season")
    season_key = resolve_season_key(raw_season)

    seasons_by_year = DATA_STORE.get("seasonsByYear", {})
    available_seasons = DATA_STORE.get("availableSeasons", [])
    last_updated = DATA_STORE.get("lastUpdated", DATA_SOURCE_META.get("fetchedAt", ""))

    if season_key not in seasons_by_year:
        season_key = "2026" if "2026" in seasons_by_year else "2025"

    summary_data = dict(seasons_by_year.get(season_key, {}))
    # Ensure availableSeasons, seasonsByYear, and lastUpdated are attached to every response
    summary_data["availableSeasons"] = available_seasons
    summary_data["seasonsByYear"] = seasons_by_year
    summary_data["lastUpdated"] = last_updated

    return jsonify(summary_data), 200


@app.route("/api/events/<string:event_code>/details", methods=["GET"])
def get_event_details(event_code: str):
    """
    Returns full details for an event: metadata, computed stats (OPR, period averages),
    and match schedule. Case-insensitive lookup against DATA_STORE['eventsByCode'].
    For mock championship events, attaches any currently active queue alert.
    """
    events_by_code = DATA_STORE.get("eventsByCode", {})
    matched_key = None

    cleaned_code = event_code.strip().lower()
    for code in events_by_code:
        if code.lower() == cleaned_code:
            matched_key = code
            break

    if not matched_key:
        return jsonify({
            "error": "EVENT_NOT_FOUND",
            "message": f"Event '{event_code}' not found for team {TARGET_TEAM}.",
        }), 404

    event_payload = dict(events_by_code[matched_key])
    if matched_key.lower() in ("2025_mock_championship", "2026_biobuzz_mock_championship"):
        event_payload["activeAlert"] = alert_manager.get_current_alert().get("alert")
    else:
        event_payload["activeAlert"] = None

    return jsonify(event_payload), 200


@app.route("/api/mock/trigger-queue-alert", methods=["POST"])
def trigger_mock_queue_alert():
    """
    Triggers an in-memory live match queue alert for BrickBot #15996.
    """
    body = request.get_json(silent=True) or {}
    alert_result = alert_manager.trigger_alert(body)
    return jsonify(alert_result), 201


@app.route("/api/mock/current-alert", methods=["GET"])
def get_mock_current_alert():
    """
    Retrieves the currently active queue alert status.
    """
    return jsonify(alert_manager.get_current_alert()), 200


@app.route("/api/mock/clear-alert", methods=["POST"])
def clear_mock_alert():
    """
    Clears any active queue alert.
    """
    return jsonify(alert_manager.clear_alert()), 200


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=SERVER_PORT, debug=False)
