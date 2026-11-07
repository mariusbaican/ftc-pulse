import os
import sys
from datetime import datetime, timezone
from typing import Any, Dict

# Ensure server root directory is at the beginning of the python import path
SERVER_DIR = os.path.dirname(os.path.abspath(__file__))
if SERVER_DIR not in sys.path:
    sys.path.insert(0, SERVER_DIR)

from flask import Flask, jsonify, request
from flask_cors import CORS

from config import FTC_SEASON, SERVER_PORT, TARGET_TEAM
from services.analytics import compute_event_opr, process_all_season_data
from services.ftc_client import fetch_or_load_season_raw_data
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
    Fetches raw season data (live API or fallback snapshot), generates the
    mock championship event, and runs full analytical aggregation.
    """
    global DATA_STORE, DATA_SOURCE_META

    raw_data = fetch_or_load_season_raw_data(force_refresh=force_refresh)
    mock_bundle = build_mock_championship_event()
    DATA_STORE = process_all_season_data(raw_data, mock_bundle)

    DATA_SOURCE_META["dataSource"] = raw_data.get("source", "fallback_snapshot")
    DATA_SOURCE_META["fetchedAt"] = raw_data.get(
        "fetchedAt", datetime.now(timezone.utc).isoformat()
    )
    return DATA_STORE


# Hydrate DATA_STORE on module import
init_data_store(force_refresh=False)


# -----------------------------------------------------------------------------
# REST API Endpoints
# -----------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health_check():
    """
    Returns server health, season info, target team, data source, and event count.
    """
    events_count = len(DATA_STORE.get("eventsByCode", {}))
    return jsonify({
        "status": "ok",
        "season": FTC_SEASON,
        "targetTeam": TARGET_TEAM,
        "dataSource": DATA_SOURCE_META.get("dataSource", "fallback_snapshot"),
        "fetchedAt": DATA_SOURCE_META.get("fetchedAt", ""),
        "eventsCount": events_count,
    }), 200


@app.route("/api/teams", methods=["GET"])
def search_teams():
    """
    Team search endpoint (PoC).
    Resolves searches matching BrickBot #15996. Non-matching queries return an empty
    list along with a notice explaining the PoC scope.
    """
    raw_query = request.args.get("query", "")
    cleaned = raw_query.strip().lower()

    valid_targets = [
        "15996",
        "brickbot",
        "colegiul national unirea",
        "focsani",
        "#15996",
    ]

    matches = (
        cleaned == ""
        or any(cleaned in t for t in valid_targets)
        or any(t in cleaned for t in valid_targets)
    )

    if matches:
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
            "pocNotice": (
                "Team not found. In this proof of concept, only BrickBot #15996 data is hosted. "
                "Multi-team lookup will be available in future releases."
            ),
        }), 200


@app.route("/api/teams/<int:team_number>/season-summary", methods=["GET"])
def get_season_summary(team_number: int):
    """
    Returns the aggregated season summary, global OPR, period averages, W-L-T record,
    best match, best event, and event list for the specified team.
    """
    if team_number != TARGET_TEAM:
        return jsonify({
            "error": "TEAM_NOT_FOUND",
            "message": f"Only team {TARGET_TEAM} (BrickBot) is supported in this PoC.",
        }), 404

    return jsonify(DATA_STORE.get("seasonSummary", {})), 200


@app.route("/api/events/<string:event_code>/details", methods=["GET"])
def get_event_details(event_code: str):
    """
    Returns full details for an event: metadata, computed stats (OPR, period averages),
    and match schedule. Case-insensitive lookup against DATA_STORE['eventsByCode'].
    For the mock championship, attaches any currently active queue alert.
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
            "message": f"Event '{event_code}' not found for team {TARGET_TEAM} in {FTC_SEASON} season.",
        }), 404

    event_payload = dict(events_by_code[matched_key])
    if matched_key.lower() == "2025_mock_championship":
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
