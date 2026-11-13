"""
Historical Data Ingestion Script for Team #15996 BrickBot.
Fetches raw seasons data (events, rankings, matches, scores, teams) from FIRST FTC Events API
and saves to server/data/brickbot_15996_historical_raw.json.
"""

import os
import sys
import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

SERVER_ROOT = Path(__file__).resolve().parent.parent
if str(SERVER_ROOT) not in sys.path:
    sys.path.insert(0, str(SERVER_ROOT))

from config import (
    FTC_API_BASE_URL,
    TARGET_TEAM,
    FTC_EVENTS_API_USERNAME,
    FTC_EVENTS_API_KEY,
)
from services.ftc_client import get_authenticated_session

logger = logging.getLogger("fetch_historical")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")

OUTPUT_PATH = SERVER_ROOT / "data" / "brickbot_15996_historical_raw.json"

SEASON_NAMES = {
    2026: "BIOBUZZ",
    2025: "DECODE",
    2024: "INTO THE DEEP",
    2023: "CENTERSTAGE",
    2022: "POWER PLAY",
    2021: "FREIGHT FRENZY",
    2020: "ULTIMATE GOAL",
    2019: "SKYSTONE",
    2018: "ROVER RUCKUS",
}


def fetch_event_data(session, season: int, event_meta: dict) -> dict:
    code = event_meta.get("code")
    base = f"{FTC_API_BASE_URL}/{season}"
    logger.info(f"[{season}] Fetching details for event {code} ({event_meta.get('name')})...")

    def get_json(url):
        try:
            r = session.get(url, timeout=10.0)
            if r.status_code == 200:
                return r.json()
        except Exception as e:
            logger.warning(f"Error fetching {url}: {e}")
        return {}

    # Rankings
    r_data = get_json(f"{base}/rankings/{code}")
    rankings = r_data.get("rankings") or r_data.get("Rankings") or []

    # Matches
    m_data = get_json(f"{base}/matches/{code}")
    matches = m_data.get("matches") or m_data.get("Matches") or []

    # Qual Scores
    qs_data = get_json(f"{base}/scores/{code}/qual")
    qual_scores = qs_data.get("matchScores") or qs_data.get("scores") or []

    # Playoff Scores
    ps_data = get_json(f"{base}/scores/{code}/playoff")
    playoff_scores = ps_data.get("matchScores") or ps_data.get("scores") or []

    # Teams list at event
    t_data = get_json(f"{base}/teams?eventCode={code}")
    event_teams = t_data.get("teams") or []

    return {
        "eventMeta": event_meta,
        "rankings": rankings,
        "matches": matches,
        "qualScores": qual_scores,
        "playoffScores": playoff_scores,
        "teams": event_teams,
    }


def fetch_season(session, season: int) -> dict | None:
    base = f"{FTC_API_BASE_URL}/{season}"
    logger.info(f"=== Checking season {season} for team {TARGET_TEAM} ===")

    # Team profile
    try:
        t_resp = session.get(f"{base}/teams?teamNumber={TARGET_TEAM}", timeout=10.0)
        if t_resp.status_code != 200:
            logger.info(f"Season {season}: /teams returned status {t_resp.status_code}. No data for team {TARGET_TEAM}.")
            return None
        t_json = t_resp.json()
        teams = t_json.get("teams", [])
        team_profile = teams[0] if teams else {
            "teamNumber": TARGET_TEAM,
            "displayTeamNumber": str(TARGET_TEAM),
            "nameShort": "BrickBot",
            "nameFull": "Colegiul National Unirea",
        }
    except Exception as e:
        logger.warning(f"Season {season}: failed to fetch team profile: {e}")
        return None

    # Events list
    try:
        e_resp = session.get(f"{base}/events?teamNumber={TARGET_TEAM}", timeout=10.0)
        if e_resp.status_code != 200:
            logger.info(f"Season {season}: /events returned status {e_resp.status_code}.")
            return None
        events_list = e_resp.json().get("events", [])
        if not events_list:
            logger.info(f"Season {season}: 0 events found for team {TARGET_TEAM}.")
            return None
    except Exception as e:
        logger.warning(f"Season {season}: failed to fetch events: {e}")
        return None

    logger.info(f"Season {season}: found {len(events_list)} events. Fetching event components...")
    events_payload = []
    # Fetch event details using worker pool
    with ThreadPoolExecutor(max_workers=5) as executor:
        futures = {executor.submit(fetch_event_data, session, season, ev): ev for ev in events_list}
        for fut in as_completed(futures):
            try:
                ev_data = fut.result()
                events_payload.append(ev_data)
            except Exception as e:
                logger.error(f"Error fetching event: {e}")

    # Maintain original event ordering
    code_order = {ev.get("code"): i for i, ev in enumerate(events_list)}
    events_payload.sort(key=lambda x: code_order.get(x["eventMeta"].get("code"), 999))

    return {
        "season": season,
        "seasonName": SEASON_NAMES.get(season, str(season)),
        "teamNumber": TARGET_TEAM,
        "source": "live_api",
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "teamProfile": team_profile,
        "events": events_payload,
    }


def main():
    session = get_authenticated_session()
    all_seasons_data = {}

    candidate_seasons = [2024, 2023, 2022, 2021, 2020, 2019, 2018]
    for season in candidate_seasons:
        season_res = fetch_season(session, season)
        if season_res and season_res.get("events"):
            all_seasons_data[str(season)] = season_res
            logger.info(f"Successfully processed Season {season}: {len(season_res['events'])} events.")
        else:
            logger.info(f"Skipping Season {season} (no valid events data).")

    logger.info(f"Writing all historical data ({len(all_seasons_data)} seasons) to {OUTPUT_PATH}...")
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        json.dump(all_seasons_data, f, indent=2, ensure_ascii=False)

    size_mb = OUTPUT_PATH.stat().st_size / (1024 * 1024)
    logger.info(f"Saved {OUTPUT_PATH} ({size_mb:.2f} MB). Included seasons: {list(all_seasons_data.keys())}")


if __name__ == "__main__":
    main()
