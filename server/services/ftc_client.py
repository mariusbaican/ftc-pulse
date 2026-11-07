import os
import json
import logging
import base64
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

import sys
from pathlib import Path

# Ensure server root is in python path
SERVER_ROOT = Path(__file__).resolve().parent.parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from config import (
    FTC_EVENTS_API_USERNAME,
    FTC_EVENTS_API_KEY,
    FTC_API_BASE_URL,
    FTC_SEASON,
    TARGET_TEAM,
    FALLBACK_SNAPSHOT_PATH,
)

logger = logging.getLogger("ftc_client")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")


def get_authenticated_session() -> requests.Session:
    """Creates a requests.Session configured with HTTP Basic Auth for FIRST FTC API."""
    session = requests.Session()
    
    if FTC_EVENTS_API_USERNAME and FTC_EVENTS_API_KEY:
        token = base64.b64encode(f"{FTC_EVENTS_API_USERNAME}:{FTC_EVENTS_API_KEY}".encode()).decode("utf-8")
        session.headers.update({
            "Authorization": f"Basic {token}",
            "Accept": "application/json",
            "User-Agent": f"FTC-Pulse-BrickBot/{TARGET_TEAM}"
        })
    else:
        session.headers.update({
            "Accept": "application/json",
            "User-Agent": f"FTC-Pulse-BrickBot/{TARGET_TEAM}"
        })

    retry_strategy = Retry(
        total=3,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["GET"]
    )
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def get_empty_seed() -> Dict[str, Any]:
    """Returns a minimal valid seed structure when neither API nor snapshot is available."""
    return {
        "season": FTC_SEASON,
        "teamNumber": TARGET_TEAM,
        "source": "empty_seed",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "teamProfile": {
            "teamNumber": TARGET_TEAM,
            "displayTeamNumber": str(TARGET_TEAM),
            "nameFull": "Colegiul National Unirea",
            "nameShort": "BrickBot",
            "city": "Focsani",
            "stateProv": "VN",
            "country": "Romania"
        },
        "events": []
    }


def load_from_snapshot() -> Optional[Dict[str, Any]]:
    """Loads fallback snapshot file if present and valid."""
    if not os.path.exists(FALLBACK_SNAPSHOT_PATH):
        return None
    try:
        with open(FALLBACK_SNAPSHOT_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            data["source"] = "fallback_snapshot"
            return data
    except Exception as e:
        logger.error(f"Failed to read fallback snapshot from {FALLBACK_SNAPSHOT_PATH}: {e}")
        return None


def save_to_snapshot(payload: Dict[str, Any]) -> None:
    """Saves payload to FALLBACK_SNAPSHOT_PATH, creating parent directories if needed."""
    try:
        os.makedirs(os.path.dirname(FALLBACK_SNAPSHOT_PATH), exist_ok=True)
        with open(FALLBACK_SNAPSHOT_PATH, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
        logger.info(f"Successfully saved snapshot to {FALLBACK_SNAPSHOT_PATH}")
    except Exception as e:
        logger.error(f"Failed to write snapshot to {FALLBACK_SNAPSHOT_PATH}: {e}")


def fetch_or_load_season_raw_data(force_refresh: bool = False) -> Dict[str, Any]:
    """
    Fetches raw season data from FTC Events API or loads from offline snapshot.
    
    1. If not force_refresh and FTC_USE_CACHED_SNAPSHOT == "1" and snapshot exists -> load snapshot.
    2. Otherwise queries live API for:
       - Team profile (/teams?teamNumber=...)
       - Events (/events?teamNumber=...)
       - For each event: rankings, matches, qualScores, playoffScores
       - Writes to FALLBACK_SNAPSHOT_PATH
    3. On failure -> falls back to snapshot. If snapshot missing -> returns empty seed.
    """
    use_cached_flag = os.getenv("FTC_USE_CACHED_SNAPSHOT", "0") == "1"
    if not force_refresh and use_cached_flag and os.path.exists(FALLBACK_SNAPSHOT_PATH):
        logger.info("FTC_USE_CACHED_SNAPSHOT is set and snapshot exists; loading snapshot directly.")
        snapshot_data = load_from_snapshot()
        if snapshot_data:
            return snapshot_data

    # Verify credentials before attempting live API
    if not FTC_EVENTS_API_USERNAME or not FTC_EVENTS_API_KEY:
        logger.warning("FTC_EVENTS_API_USERNAME or FTC_EVENTS_API_KEY is missing. Falling back to snapshot.")
        snapshot_data = load_from_snapshot()
        return snapshot_data if snapshot_data else get_empty_seed()

    session = get_authenticated_session()
    base_season_url = f"{FTC_API_BASE_URL}/{FTC_SEASON}"
    
    try:
        logger.info(f"Querying live FTC Events API v2.0 for season {FTC_SEASON}, team {TARGET_TEAM}...")
        
        # 1. Team profile
        teams_url = f"{base_season_url}/teams?teamNumber={TARGET_TEAM}"
        teams_resp = session.get(teams_url, timeout=15)
        teams_resp.raise_for_status()
        teams_json = teams_resp.json()
        teams_list = teams_json.get("teams", [])
        team_profile = teams_list[0] if teams_list else {
            "teamNumber": TARGET_TEAM,
            "displayTeamNumber": str(TARGET_TEAM),
            "nameShort": "BrickBot",
            "nameFull": "Colegiul National Unirea"
        }

        # 2. Events list
        events_url = f"{base_season_url}/events?teamNumber={TARGET_TEAM}"
        events_resp = session.get(events_url, timeout=15)
        events_resp.raise_for_status()
        events_json = events_resp.json()
        raw_events = events_json.get("events", [])
        logger.info(f"Discovered {len(raw_events)} events for team {TARGET_TEAM}.")

        events_payload: List[Dict[str, Any]] = []

        # 3. For each event, query rankings, matches, qual scores, playoff scores
        for ev in raw_events:
            code = ev.get("code")
            if not code:
                continue

            logger.info(f"Fetching event data for [{code}] {ev.get('name', '')}...")

            # Rankings
            rankings_list: List[Dict[str, Any]] = []
            try:
                r_resp = session.get(f"{base_season_url}/rankings/{code}", timeout=15)
                if r_resp.status_code == 200:
                    r_data = r_resp.json()
                    rankings_list = r_data.get("rankings") or r_data.get("Rankings") or []
            except Exception as e:
                logger.warning(f"Could not fetch rankings for event {code}: {e}")

            # Matches
            matches_list: List[Dict[str, Any]] = []
            try:
                m_resp = session.get(f"{base_season_url}/matches/{code}", timeout=15)
                if m_resp.status_code == 200:
                    m_data = m_resp.json()
                    matches_list = m_data.get("matches") or m_data.get("Matches") or []
            except Exception as e:
                logger.warning(f"Could not fetch matches for event {code}: {e}")

            # Qual scores
            qual_scores_list: List[Dict[str, Any]] = []
            try:
                qs_resp = session.get(f"{base_season_url}/scores/{code}/qual", timeout=15)
                if qs_resp.status_code == 200:
                    qs_data = qs_resp.json()
                    qual_scores_list = qs_data.get("matchScores") or qs_data.get("scores") or []
            except Exception as e:
                logger.warning(f"Could not fetch qual scores for event {code}: {e}")

            # Playoff scores (gracefully handle 404/empty)
            playoff_scores_list: List[Dict[str, Any]] = []
            try:
                ps_resp = session.get(f"{base_season_url}/scores/{code}/playoff", timeout=15)
                if ps_resp.status_code == 200:
                    ps_data = ps_resp.json()
                    playoff_scores_list = ps_data.get("matchScores") or ps_data.get("scores") or []
            except Exception as e:
                logger.warning(f"Could not fetch playoff scores for event {code}: {e}")

            events_payload.append({
                "eventMeta": ev,
                "rankings": rankings_list,
                "matches": matches_list,
                "qualScores": qual_scores_list,
                "playoffScores": playoff_scores_list
            })

        normalized_payload = {
            "season": FTC_SEASON,
            "teamNumber": TARGET_TEAM,
            "source": "live_api",
            "fetchedAt": datetime.now(timezone.utc).isoformat(),
            "teamProfile": team_profile,
            "events": events_payload
        }

        # Save to snapshot
        save_to_snapshot(normalized_payload)
        return normalized_payload

    except Exception as e:
        logger.error(f"Live API ingestion failed: {e}. Attempting fallback to snapshot.", exc_info=True)
        snapshot_data = load_from_snapshot()
        if snapshot_data:
            return snapshot_data
        logger.warning("No snapshot available. Returning empty seed structure.")
        return get_empty_seed()


if __name__ == "__main__":
    logger.info("Executing FTC client ingestion in force_refresh mode...")
    data = fetch_or_load_season_raw_data(force_refresh=True)
    events = data.get("events", [])
    total_matches = sum(len(e.get("matches", [])) for e in events)
    total_qual_scores = sum(len(e.get("qualScores", [])) for e in events)
    total_playoff_scores = sum(len(e.get("playoffScores", [])) for e in events)
    
    print("\n--- FTC Ingestion Summary ---")
    print(f"Season: {data.get('season')}")
    print(f"Team: {data.get('teamNumber')} - {data.get('teamProfile', {}).get('nameShort')}")
    print(f"Data Source: {data.get('source')}")
    print(f"Fetched At: {data.get('fetchedAt')}")
    print(f"Events Ingested: {len(events)}")
    print(f"Total Matches Across Events: {total_matches}")
    print(f"Total Qual Score Breakdowns: {total_qual_scores}")
    print(f"Total Playoff Score Breakdowns: {total_playoff_scores}")
    print(f"Snapshot File: {FALLBACK_SNAPSHOT_PATH}")
    print("-----------------------------\n")
