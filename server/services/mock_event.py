"""
FTC BrickBot #15996 Mock Championship Event & Queue Alert Manager.

Simulates an in-progress championship tournament ("2025_mock_championship")
featuring authentic 2025 DECODE match schedules, scores, period breakdowns,
and provides a thread-safe QueueAlertManager for live match queueing notifications.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

try:
    from server.services.analytics import compute_event_opr, _build_alliance_task_breakdown
except ImportError:
    try:
        from services.analytics import compute_event_opr, _build_alliance_task_breakdown
    except ImportError:
        from analytics import compute_event_opr, _build_alliance_task_breakdown


MOCK_TEAMS: Dict[int, str] = {
    15996: "BrickBot",
    19066: "AiCitizens",
    17871: "4D-Robotics",
    19139: "Ro2D2",
    12582: "Quantum Robotics",
    17713: "Cybersharks",
    14270: "Vectron",
    16031: "Peppers",
    19060: "WattsUp",
    18255: "Neurowired",
    18944: "Bionic Royals",
    15989: "Tech-X",
}


def build_mock_championship_event() -> Dict[str, Any]:
    """
    Builds the simulated active championship event ("2025_mock_championship").
    Computes real OPR for all participating teams using compute_event_opr.

    Returns:
        dict: {
            "eventDetail": { "event": ..., "stats": ..., "matches": ... },
            "eventSummary": { ... }
        }
    """
    event_code = "2025_mock_championship"
    event_name = "FTC Biobuzz Live Invitational"
    type_name = "Live Biobuzz Invitational"
    season = 2026
    season_name = "BIOBUZZ"
    city = "Bucharest"
    state_prov = "B"
    country = "Romania"
    venue = "Sala Polivalentă București"
    date_start = "2026-11-20T09:00:00"
    date_end = "2026-11-22T18:00:00"
    status = "IN_PROGRESS"
    live_stream_url = "https://www.youtube.com/watch?v=H920hSVJw7E"
    field_count = 2

    # Define 15 tournament qualification matches
    all_raw_matches = [
        # Match 1: Played
        {
            "matchNumber": 1,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 1",
            "scheduledTime": "10:00",
            "actualStartTime": "10:02",
            "scoreRedFinal": 210,
            "scoreBlueFinal": 185,
            "scoreRedAuto": 70,
            "scoreBlueAuto": 60,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 17871, "station": "Red1", "teamName": "4D-Robotics"},
                {"teamNumber": 19139, "station": "Red2", "teamName": "Ro2D2"},
                {"teamNumber": 16031, "station": "Blue1", "teamName": "Peppers"},
                {"teamNumber": 19060, "station": "Blue2", "teamName": "WattsUp"},
            ],
            "vodTimestampSeconds": 120,
        },
        # Match 2: BrickBot COMPLETED (Win)
        {
            "matchNumber": 2,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 2",
            "scheduledTime": "10:15",
            "actualStartTime": "10:18",
            "scoreRedFinal": 248,
            "scoreBlueFinal": 210,
            "scoreRedAuto": 82,
            "scoreBlueAuto": 70,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 15996, "station": "Red1", "teamName": "BrickBot"},
                {"teamNumber": 19066, "station": "Red2", "teamName": "AiCitizens"},
                {"teamNumber": 12582, "station": "Blue1", "teamName": "Quantum Robotics"},
                {"teamNumber": 17713, "station": "Blue2", "teamName": "Cybersharks"},
            ],
            "vodTimestampSeconds": 420,
        },
        # Match 3: Played
        {
            "matchNumber": 3,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 3",
            "scheduledTime": "10:30",
            "actualStartTime": "10:32",
            "scoreRedFinal": 165,
            "scoreBlueFinal": 190,
            "scoreRedAuto": 55,
            "scoreBlueAuto": 62,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 14270, "station": "Red1", "teamName": "Vectron"},
                {"teamNumber": 18255, "station": "Red2", "teamName": "Neurowired"},
                {"teamNumber": 18944, "station": "Blue1", "teamName": "Bionic Royals"},
                {"teamNumber": 15989, "station": "Blue2", "teamName": "Tech-X"},
            ],
            "vodTimestampSeconds": 700,
        },
        # Match 4: Played
        {
            "matchNumber": 4,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 4",
            "scheduledTime": "10:45",
            "actualStartTime": "10:47",
            "scoreRedFinal": 192,
            "scoreBlueFinal": 210,
            "scoreRedAuto": 68,
            "scoreBlueAuto": 72,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 17713, "station": "Red1", "teamName": "Cybersharks"},
                {"teamNumber": 16031, "station": "Red2", "teamName": "Peppers"},
                {"teamNumber": 17871, "station": "Blue1", "teamName": "4D-Robotics"},
                {"teamNumber": 12582, "station": "Blue2", "teamName": "Quantum Robotics"},
            ],
            "vodTimestampSeconds": 980,
        },
        # Match 5: BrickBot COMPLETED (Win, Blue alliance)
        {
            "matchNumber": 5,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 5",
            "scheduledTime": "11:00",
            "actualStartTime": "11:03",
            "scoreRedFinal": 210,
            "scoreBlueFinal": 264,
            "scoreRedAuto": 70,
            "scoreBlueAuto": 88,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 14270, "station": "Red1", "teamName": "Vectron"},
                {"teamNumber": 18944, "station": "Red2", "teamName": "Bionic Royals"},
                {"teamNumber": 15996, "station": "Blue1", "teamName": "BrickBot"},
                {"teamNumber": 18255, "station": "Blue2", "teamName": "Neurowired"},
            ],
            "vodTimestampSeconds": 1260,
        },
        # Match 6: Played
        {
            "matchNumber": 6,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 6",
            "scheduledTime": "11:15",
            "actualStartTime": "11:17",
            "scoreRedFinal": 225,
            "scoreBlueFinal": 205,
            "scoreRedAuto": 75,
            "scoreBlueAuto": 70,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 19066, "station": "Red1", "teamName": "AiCitizens"},
                {"teamNumber": 19060, "station": "Red2", "teamName": "WattsUp"},
                {"teamNumber": 18255, "station": "Blue1", "teamName": "Neurowired"},
                {"teamNumber": 17871, "station": "Blue2", "teamName": "4D-Robotics"},
            ],
            "vodTimestampSeconds": 1540,
        },
        # Match 7: BrickBot COMPLETED (Loss)
        {
            "matchNumber": 7,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 7",
            "scheduledTime": "11:45",
            "actualStartTime": "11:48",
            "scoreRedFinal": 219,
            "scoreBlueFinal": 250,
            "scoreRedAuto": 74,
            "scoreBlueAuto": 80,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 15996, "station": "Red1", "teamName": "BrickBot"},
                {"teamNumber": 18944, "station": "Red2", "teamName": "Bionic Royals"},
                {"teamNumber": 17871, "station": "Blue1", "teamName": "4D-Robotics"},
                {"teamNumber": 19139, "station": "Blue2", "teamName": "Ro2D2"},
            ],
            "vodTimestampSeconds": 2100,
        },
        # Match 8: Played
        {
            "matchNumber": 8,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 8",
            "scheduledTime": "12:00",
            "actualStartTime": "12:03",
            "scoreRedFinal": 200,
            "scoreBlueFinal": 185,
            "scoreRedAuto": 66,
            "scoreBlueAuto": 60,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 12582, "station": "Red1", "teamName": "Quantum Robotics"},
                {"teamNumber": 18944, "station": "Red2", "teamName": "Bionic Royals"},
                {"teamNumber": 16031, "station": "Blue1", "teamName": "Peppers"},
                {"teamNumber": 14270, "station": "Blue2", "teamName": "Vectron"},
            ],
            "vodTimestampSeconds": 2380,
        },
        # Match 9: Played
        {
            "matchNumber": 9,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 9",
            "scheduledTime": "13:15",
            "actualStartTime": "13:18",
            "scoreRedFinal": 198,
            "scoreBlueFinal": 230,
            "scoreRedAuto": 68,
            "scoreBlueAuto": 78,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 17713, "station": "Red1", "teamName": "Cybersharks"},
                {"teamNumber": 19060, "station": "Red2", "teamName": "WattsUp"},
                {"teamNumber": 19066, "station": "Blue1", "teamName": "AiCitizens"},
                {"teamNumber": 15989, "station": "Blue2", "teamName": "Tech-X"},
            ],
            "vodTimestampSeconds": 2800,
        },
        # Match 10: BrickBot COMPLETED (Win, Season/Event High Score 282)
        {
            "matchNumber": 10,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 10",
            "scheduledTime": "13:30",
            "actualStartTime": "13:33",
            "scoreRedFinal": 282,
            "scoreBlueFinal": 220,
            "scoreRedAuto": 96,
            "scoreBlueAuto": 72,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 15996, "station": "Red1", "teamName": "BrickBot"},
                {"teamNumber": 12582, "station": "Red2", "teamName": "Quantum Robotics"},
                {"teamNumber": 16031, "station": "Blue1", "teamName": "Peppers"},
                {"teamNumber": 18944, "station": "Blue2", "teamName": "Bionic Royals"},
            ],
            "vodTimestampSeconds": 3180,
        },
        # Match 11: Played
        {
            "matchNumber": 11,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 11",
            "scheduledTime": "13:45",
            "actualStartTime": "13:48",
            "scoreRedFinal": 240,
            "scoreBlueFinal": 228,
            "scoreRedAuto": 80,
            "scoreBlueAuto": 76,
            "scoreRedFoul": 0,
            "scoreBlueFoul": 0,
            "teams": [
                {"teamNumber": 19139, "station": "Red1", "teamName": "Ro2D2"},
                {"teamNumber": 14270, "station": "Red2", "teamName": "Vectron"},
                {"teamNumber": 19066, "station": "Blue1", "teamName": "AiCitizens"},
                {"teamNumber": 17713, "station": "Blue2", "teamName": "Cybersharks"},
            ],
            "vodTimestampSeconds": 3460,
        },
        # Match 12: BrickBot QUEUED
        {
            "matchNumber": 12,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 12",
            "status": "QUEUED",
            "field": "Field 1",
            "scheduledTime": "14:20",
            "actualStartTime": None,
            "scoreRedFinal": None,
            "scoreBlueFinal": None,
            "scoreRedAuto": None,
            "scoreBlueAuto": None,
            "teams": [
                {"teamNumber": 15996, "station": "Red1", "teamName": "BrickBot"},
                {"teamNumber": 19066, "station": "Red2", "teamName": "AiCitizens"},
                {"teamNumber": 17871, "station": "Blue1", "teamName": "4D-Robotics"},
                {"teamNumber": 19139, "station": "Blue2", "teamName": "Ro2D2"},
            ],
            "vodTimestampSeconds": 3900,
        },
        # Match 13: UPCOMING
        {
            "matchNumber": 13,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 13",
            "status": "UPCOMING",
            "field": "Field 2",
            "scheduledTime": "14:35",
            "actualStartTime": None,
            "scoreRedFinal": None,
            "scoreBlueFinal": None,
            "teams": [
                {"teamNumber": 18255, "station": "Red1", "teamName": "Neurowired"},
                {"teamNumber": 12582, "station": "Red2", "teamName": "Quantum Robotics"},
                {"teamNumber": 19060, "station": "Blue1", "teamName": "WattsUp"},
                {"teamNumber": 14270, "station": "Blue2", "teamName": "Vectron"},
            ],
            "vodTimestampSeconds": 4150,
        },
        # Match 14: UPCOMING
        {
            "matchNumber": 14,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 14",
            "status": "UPCOMING",
            "field": "Field 1",
            "scheduledTime": "14:50",
            "actualStartTime": None,
            "scoreRedFinal": None,
            "scoreBlueFinal": None,
            "teams": [
                {"teamNumber": 16031, "station": "Red1", "teamName": "Peppers"},
                {"teamNumber": 15989, "station": "Red2", "teamName": "Tech-X"},
                {"teamNumber": 18944, "station": "Blue1", "teamName": "Bionic Royals"},
                {"teamNumber": 19066, "station": "Blue2", "teamName": "AiCitizens"},
            ],
            "vodTimestampSeconds": 4400,
        },
        # Match 15: BrickBot UPCOMING
        {
            "matchNumber": 15,
            "tournamentLevel": "QUAL",
            "series": 1,
            "description": "Qualification 15",
            "status": "UPCOMING",
            "field": "Field 2",
            "scheduledTime": "15:05",
            "actualStartTime": None,
            "scoreRedFinal": None,
            "scoreBlueFinal": None,
            "scoreRedAuto": None,
            "scoreBlueAuto": None,
            "teams": [
                {"teamNumber": 17713, "station": "Red1", "teamName": "Cybersharks"},
                {"teamNumber": 18255, "station": "Red2", "teamName": "Neurowired"},
                {"teamNumber": 15996, "station": "Blue1", "teamName": "BrickBot"},
                {"teamNumber": 14270, "station": "Blue2", "teamName": "Vectron"},
            ],
            "vodTimestampSeconds": 4600,
        },
    ]

    # Qualification score breakdown schemas for completed matches (matches 1-11)
    all_qual_scores = [
        {
            "matchNumber": 1,
            "alliances": [
                {"alliance": "Red", "autoPoints": 70, "teleopPoints": 140, "teleopBasePoints": 35, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 60, "teleopPoints": 125, "teleopBasePoints": 30, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 2,
            "alliances": [
                {"alliance": "Red", "autoPoints": 82, "teleopPoints": 166, "teleopBasePoints": 35, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 70, "teleopPoints": 140, "teleopBasePoints": 35, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 3,
            "alliances": [
                {"alliance": "Red", "autoPoints": 55, "teleopPoints": 110, "teleopBasePoints": 25, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 62, "teleopPoints": 128, "teleopBasePoints": 30, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 4,
            "alliances": [
                {"alliance": "Red", "autoPoints": 68, "teleopPoints": 124, "teleopBasePoints": 30, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 72, "teleopPoints": 138, "teleopBasePoints": 30, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 5,
            "alliances": [
                {"alliance": "Red", "autoPoints": 70, "teleopPoints": 140, "teleopBasePoints": 30, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 88, "teleopPoints": 176, "teleopBasePoints": 40, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 6,
            "alliances": [
                {"alliance": "Red", "autoPoints": 75, "teleopPoints": 150, "teleopBasePoints": 35, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 70, "teleopPoints": 135, "teleopBasePoints": 35, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 7,
            "alliances": [
                {"alliance": "Red", "autoPoints": 74, "teleopPoints": 145, "teleopBasePoints": 25, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 80, "teleopPoints": 170, "teleopBasePoints": 35, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 8,
            "alliances": [
                {"alliance": "Red", "autoPoints": 66, "teleopPoints": 134, "teleopBasePoints": 30, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 60, "teleopPoints": 125, "teleopBasePoints": 30, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 9,
            "alliances": [
                {"alliance": "Red", "autoPoints": 68, "teleopPoints": 130, "teleopBasePoints": 30, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 78, "teleopPoints": 152, "teleopBasePoints": 35, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 10,
            "alliances": [
                {"alliance": "Red", "autoPoints": 96, "teleopPoints": 186, "teleopBasePoints": 40, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 72, "teleopPoints": 148, "teleopBasePoints": 30, "penaltyPointsCommitted": 0},
            ],
        },
        {
            "matchNumber": 11,
            "alliances": [
                {"alliance": "Red", "autoPoints": 80, "teleopPoints": 160, "teleopBasePoints": 35, "penaltyPointsCommitted": 0},
                {"alliance": "Blue", "autoPoints": 76, "teleopPoints": 152, "teleopBasePoints": 35, "penaltyPointsCommitted": 0},
            ],
        },
    ]

    # Filter out practice matches if any
    all_raw_matches = [
        m for m in all_raw_matches
        if "PRACTICE" not in str(m.get("tournamentLevel", "")).upper()
        and "PRACTICE" not in str(m.get("description", "")).upper()
    ]

    # Compute real OPR across the tournament
    event_oprs = compute_event_opr(all_raw_matches, all_qual_scores)
    brickbot_opr = event_oprs.get(
        15996,
        {"totalOpr": 129.5, "autoOpr": 43.0, "teleopOpr": 66.5, "endgameOpr": 20.0},
    )

    # Build BrickBot's 6 normalized matches
    brickbot_raw_matches = [
        all_raw_matches[1],   # QM 2 (COMPLETED)
        all_raw_matches[4],   # QM 5 (COMPLETED)
        all_raw_matches[6],   # QM 7 (COMPLETED)
        all_raw_matches[9],   # QM 10 (COMPLETED)
        all_raw_matches[11],  # QM 12 (QUEUED)
        all_raw_matches[14],  # QM 15 (UPCOMING)
    ]

    # Scores lookup for period breakdown
    scores_by_match: Dict[int, Dict[str, dict]] = {}
    for item in all_qual_scores:
        m_num = item["matchNumber"]
        scores_by_match[m_num] = {}
        for a in item.get("alliances", []):
            color = a.get("alliance", "").capitalize()
            scores_by_match[m_num][color] = a

    normalized_matches: List[Dict[str, Any]] = []
    for idx, m in enumerate(brickbot_raw_matches):
        match_num = int(m["matchNumber"])
        level = m.get("tournamentLevel", "QUAL")
        series = int(m.get("series", 1))

        # Separate red and blue alliances
        teams_in_m = m.get("teams", [])
        red_teams = [t for t in teams_in_m if "Red" in str(t.get("station", ""))]
        blue_teams = [t for t in teams_in_m if "Blue" in str(t.get("station", ""))]

        is_red = any(t["teamNumber"] == 15996 for t in red_teams)
        is_blue = any(t["teamNumber"] == 15996 for t in blue_teams)
        target_alliance = "Red" if is_red else ("Blue" if is_blue else None)

        score_red = m.get("scoreRedFinal")
        score_blue = m.get("scoreBlueFinal")

        status_val = m.get("status")
        if not status_val:
            status_val = "COMPLETED" if score_red is not None else "UPCOMING"

        if score_red is not None and score_blue is not None:
            if score_red == score_blue:
                res = "TIE"
            elif target_alliance == "Red":
                res = "WIN" if score_red > score_blue else "LOSS"
            elif target_alliance == "Blue":
                res = "WIN" if score_blue > score_red else "LOSS"
            else:
                res = "PENDING"
        else:
            res = "PENDING"

        field_name = m.get("field") or f"Field {(match_num % field_count) + 1}"
        scheduled_time = m.get("actualStartTime") or m.get("scheduledTime")
        vod_ts = int(m.get("vodTimestampSeconds", 300 + idx * 420)) if live_stream_url else None

        red_bd = scores_by_match.get(match_num, {}).get("Red")
        blue_bd = scores_by_match.get(match_num, {}).get("Blue")

        if red_bd and blue_bd:
            r_auto = int(red_bd["autoPoints"])
            r_end = int(red_bd["teleopBasePoints"])
            r_tele = int(red_bd["teleopPoints"]) - r_end
            r_foul = int(red_bd.get("penaltyPointsCommitted", 0))
            r_tot = int(score_red)

            b_auto = int(blue_bd["autoPoints"])
            b_end = int(blue_bd["teleopBasePoints"])
            b_tele = int(blue_bd["teleopPoints"]) - b_end
            b_foul = int(blue_bd.get("penaltyPointsCommitted", 0))
            b_tot = int(score_blue)

            period_breakdown = {
                "red": {"auto": r_auto, "teleop": r_tele, "endgame": r_end, "foulCommitted": r_foul, "total": r_tot},
                "blue": {"auto": b_auto, "teleop": b_tele, "endgame": b_end, "foulCommitted": b_foul, "total": b_tot},
            }
            red_tasks = _build_alliance_task_breakdown(red_bd, r_auto, r_tele, r_end, b_foul, r_foul, r_tot, opp_bd=blue_bd, alliance_teams=red_teams)
            blue_tasks = _build_alliance_task_breakdown(blue_bd, b_auto, b_tele, b_end, r_foul, b_foul, b_tot, opp_bd=red_bd, alliance_teams=blue_teams)
            task_breakdown = {"red": red_tasks, "blue": blue_tasks}
        elif score_red is not None and score_blue is not None:
            r_auto = int(m.get("scoreRedAuto", 0) or 0)
            r_foul = int(m.get("scoreRedFoul", 0) or 0)
            b_foul = int(m.get("scoreBlueFoul", 0) or 0)
            r_tot = int(score_red)
            r_non_foul = max(0, r_tot - b_foul)
            r_tele = max(0, r_non_foul - r_auto)
            r_end = 0

            b_auto = int(m.get("scoreBlueAuto", 0) or 0)
            b_tot = int(score_blue)
            b_non_foul = max(0, b_tot - r_foul)
            b_tele = max(0, b_non_foul - b_auto)
            b_end = 0

            period_breakdown = {
                "red": {"auto": r_auto, "teleop": r_tele, "endgame": 0, "foulCommitted": r_foul, "total": r_tot},
                "blue": {"auto": b_auto, "teleop": b_tele, "endgame": 0, "foulCommitted": b_foul, "total": b_tot},
            }
            red_tasks = _build_alliance_task_breakdown(None, r_auto, r_tele, r_end, b_foul, r_foul, r_tot, opp_bd=None, alliance_teams=red_teams)
            blue_tasks = _build_alliance_task_breakdown(None, b_auto, b_tele, b_end, r_foul, b_foul, b_tot, opp_bd=None, alliance_teams=blue_teams)
            task_breakdown = {"red": red_tasks, "blue": blue_tasks}
        else:
            period_breakdown = None
            task_breakdown = None

        red_alliance_teams = [
            {
                "teamNumber": t["teamNumber"],
                "teamName": MOCK_TEAMS.get(t["teamNumber"], f"Team {t['teamNumber']}"),
                "station": t.get("station", "Red"),
                "isTargetTeam": t["teamNumber"] == 15996,
                "onField": bool(t.get("onField", True)),
                "dq": bool(t.get("dq", False)),
                "noShow": bool(t.get("noShow", False)) or (t.get("onField") is False),
                "yellowCard": bool(t.get("yellowCard", False)),
                "redCard": bool(t.get("redCard", False)),
            }
            for t in red_teams
        ]
        blue_alliance_teams = [
            {
                "teamNumber": t["teamNumber"],
                "teamName": MOCK_TEAMS.get(t["teamNumber"], f"Team {t['teamNumber']}"),
                "station": t.get("station", "Blue"),
                "isTargetTeam": t["teamNumber"] == 15996,
                "onField": bool(t.get("onField", True)),
                "dq": bool(t.get("dq", False)),
                "noShow": bool(t.get("noShow", False)) or (t.get("onField") is False),
                "yellowCard": bool(t.get("yellowCard", False)),
                "redCard": bool(t.get("redCard", False)),
            }
            for t in blue_teams
        ]

        norm_m = {
            "matchId": f"{event_code}_{level}_{match_num}_{series}",
            "description": m.get("description", f"Match {match_num}"),
            "tournamentLevel": level,
            "matchNumber": match_num,
            "series": series,
            "status": status_val,
            "field": field_name,
            "scheduledTime": scheduled_time,
            "actualStartTime": m.get("actualStartTime"),
            "redAlliance": red_alliance_teams,
            "blueAlliance": blue_alliance_teams,
            "redTeams": red_alliance_teams,
            "blueTeams": blue_alliance_teams,
            "scoreRedFinal": score_red,
            "scoreBlueFinal": score_blue,
            "scoreRedAuto": m.get("scoreRedAuto"),
            "scoreBlueAuto": m.get("scoreBlueAuto"),
            "targetTeamAlliance": target_alliance,
            "result": res,
            "vodUrl": live_stream_url,
            "vodTimestampSeconds": vod_ts,
            "vodStartSeconds": vod_ts,
            "vodEndSeconds": (vod_ts + 165) if vod_ts is not None else None,
            "periodBreakdown": period_breakdown,
            "taskBreakdown": task_breakdown,
        }
        normalized_matches.append(norm_m)

    # Sort Playoffs Before Qualifications:
    playoff_matches = [
        m for m in normalized_matches
        if "QUAL" not in str(m.get("tournamentLevel", "")).upper()
    ]
    playoff_matches.sort(
        key=lambda m: (
            int(m.get("series") or 0),
            int(m.get("matchNumber") or 0),
            str(m.get("actualStartTime") or ""),
        )
    )

    qual_matches = [
        m for m in normalized_matches
        if "QUAL" in str(m.get("tournamentLevel", "")).upper()
    ]
    qual_matches.sort(
        key=lambda m: (
            int(m.get("matchNumber") or 0),
            int(m.get("series") or 0),
        )
    )

    normalized_matches = playoff_matches + qual_matches

    # BrickBot completed match stats (Matches 2, 5, 7, 10)
    # Match 2 (Red): 248 (auto 82, tele 131, end 35) -> Win
    # Match 5 (Blue): 264 (auto 88, tele 136, end 40) -> Win
    # Match 7 (Red): 219 (auto 74, tele 120, end 25) -> Loss
    # Match 10 (Red): 282 (auto 96, tele 146, end 40) -> Win
    wins = 3
    losses = 1
    ties = 0
    matches_played = 4
    win_rate = 75.0
    rank = 2
    total_teams = 12

    # Averages across completed matches
    auto_avg = round((82 + 88 + 74 + 96) / 4, 2)       # 85.0
    teleop_avg = round((131 + 136 + 120 + 146) / 4, 2) # 133.25
    endgame_avg = round((35 + 40 + 25 + 40) / 4, 2)    # 35.0
    total_avg = round((248 + 264 + 219 + 282) / 4, 2)  # 253.25
    high_score = 282
    high_score_match = "Qualification 10"

    score_margins = []
    for m in normalized_matches:
        if m.get("result") in ("WIN", "LOSS", "TIE"):
            s_red = float(m.get("scoreRedFinal") or 0)
            s_blue = float(m.get("scoreBlueFinal") or 0)
            al = str(m.get("targetTeamAlliance", "")).capitalize()
            if al == "Red":
                score_margins.append(s_red - s_blue)
            elif al == "Blue":
                score_margins.append(s_blue - s_red)
    avg_score_margin = round(sum(score_margins) / len(score_margins), 1) if score_margins else 0.0

    penalties_awarded = []
    penalties_conceded = []
    for m in normalized_matches:
        if m.get("result") in ("WIN", "LOSS", "TIE"):
            target_side = str(m.get("targetTeamAlliance", "red")).lower()
            tb = m.get("taskBreakdown") or {}
            target_tb = tb.get(target_side) or {}
            awarded = target_tb.get("foulPointsAwarded")
            conceded = target_tb.get("foulPointsCommitted")
            if awarded is None:
                opp_side = "blue" if target_side == "red" else "red"
                awarded = (m.get("periodBreakdown") or {}).get(opp_side, {}).get("foulCommitted", 0)
            if conceded is None:
                conceded = (m.get("periodBreakdown") or {}).get(target_side, {}).get("foulCommitted", 0)
            penalties_awarded.append(float(awarded or 0))
            penalties_conceded.append(float(conceded or 0))

    avg_penalties_awarded = round(sum(penalties_awarded) / len(penalties_awarded), 1) if penalties_awarded else 0.0
    avg_penalties_conceded = round(sum(penalties_conceded) / len(penalties_conceded), 1) if penalties_conceded else 0.0
    avg_net_penalties = round(avg_penalties_awarded - avg_penalties_conceded, 1)

    # Compute average qualification match scores across mock event
    mock_team_scores: Dict[int, List[float]] = {}
    for m in all_raw_matches:
        if m.get("scoreRedFinal") is not None and m.get("scoreBlueFinal") is not None:
            s_red = float(m["scoreRedFinal"])
            s_blue = float(m["scoreBlueFinal"])
            for t in m.get("teams", []):
                t_num = t["teamNumber"]
                if "Red" in str(t.get("station", "")):
                    mock_team_scores.setdefault(t_num, []).append(s_red)
                elif "Blue" in str(t.get("station", "")):
                    mock_team_scores.setdefault(t_num, []).append(s_blue)

    mock_team_avg_scores = {
        t_num: round(sum(scs) / len(scs), 1)
        for t_num, scs in mock_team_scores.items()
        if scs
    }

    # Build mock rankings table for all 12 teams
    mock_rankings = [
        {
            "rank": 2,
            "teamNumber": 15996,
            "teamName": "BrickBot",
            "wins": wins,
            "losses": losses,
            "ties": ties,
            "matchesPlayed": matches_played,
            "rp": round((wins * 2.0 + ties) / max(1, matches_played), 2),
            "tb1": round(brickbot_opr.get("autoOpr", 43.0) * 2.0, 1),
            "tb2": round(brickbot_opr.get("endgameOpr", 20.0) * 1.5, 1),
            "avgScore": mock_team_avg_scores.get(15996, total_avg),
            "totalOpr": brickbot_opr["totalOpr"],
            "isTargetTeam": True,
        }
    ]
    other_mock_teams = [t for t in MOCK_TEAMS.keys() if t != 15996]
    for i, t_num in enumerate(other_mock_teams):
        r_num = 1 if i == 0 else (i + 2)
        w = 4 if i == 0 else max(0, 4 - ((i + 1) // 3))
        l = max(0, 4 - w)
        t_mp = w + l
        t_opr_dict = event_oprs.get(t_num, {})
        t_total_opr = t_opr_dict.get("totalOpr", 80.0)
        t_auto_opr = t_opr_dict.get("autoOpr", 25.0)
        t_end_opr = t_opr_dict.get("endgameOpr", 15.0)
        t_avg_score = mock_team_avg_scores.get(t_num, round(t_total_opr * 1.85, 1))

        mock_rankings.append({
            "rank": r_num,
            "teamNumber": t_num,
            "teamName": MOCK_TEAMS[t_num],
            "wins": w,
            "losses": l,
            "ties": 0,
            "matchesPlayed": t_mp,
            "rp": round(w * 2.0 / max(1, t_mp), 2),
            "tb1": round(t_auto_opr * 2.0, 1),
            "tb2": round(t_end_opr * 1.5, 1),
            "avgScore": t_avg_score,
            "totalOpr": t_total_opr,
            "isTargetTeam": False,
        })
    mock_rankings.sort(key=lambda x: x["rank"])
    rank_by_team = {rk["teamNumber"]: rk for rk in mock_rankings}

    # Build teams table sorted ascending by teamNumber
    mock_teams = []
    for t_num in sorted(MOCK_TEAMS.keys()):
        rk = rank_by_team.get(t_num)
        if rk:
            mock_teams.append({
                "teamNumber": t_num,
                "teamName": MOCK_TEAMS[t_num],
                "rank": rk["rank"],
                "record": f"{rk['wins']}-{rk['losses']}-{rk['ties']}",
                "totalOpr": rk["totalOpr"],
                "isTargetTeam": t_num == 15996,
            })

    opr_ranks = {
        "total": 1 + sum(1 for t, o in event_oprs.items() if o.get("totalOpr", 0.0) > brickbot_opr.get("totalOpr", 0.0)),
        "auto": 1 + sum(1 for t, o in event_oprs.items() if o.get("autoOpr", 0.0) > brickbot_opr.get("autoOpr", 0.0)),
        "teleop": 1 + sum(1 for t, o in event_oprs.items() if o.get("teleopOpr", 0.0) > brickbot_opr.get("teleopOpr", 0.0)),
        "endgame": 1 + sum(1 for t, o in event_oprs.items() if o.get("endgameOpr", 0.0) > brickbot_opr.get("endgameOpr", 0.0)),
    }

    event_detail = {
        "event": {
            "code": event_code,
            "name": event_name,
            "typeName": type_name,
            "season": season,
            "seasonName": season_name,
            "city": city,
            "stateprov": state_prov,
            "country": country,
            "venue": venue,
            "dateStart": date_start,
            "dateEnd": date_end,
            "status": status,
            "liveStreamUrl": live_stream_url,
            "fieldCount": field_count,
            "hasQualMatches": True,
            "hasTeamMatches": True,
        },
        "stats": {
            "teamNumber": 15996,
            "rank": rank,
            "totalTeams": total_teams,
            "wins": wins,
            "losses": losses,
            "ties": ties,
            "winRate": win_rate,
            "matchesPlayed": matches_played,
            "opr": brickbot_opr,
            "oprRanks": opr_ranks,
            "averages": {
                "autoAvg": auto_avg,
                "teleopAvg": teleop_avg,
                "endgameAvg": endgame_avg,
                "totalAvg": total_avg,
                "avgScoreMargin": avg_score_margin,
                "avgWinningMargin": avg_score_margin,
                "avgPenaltiesAwarded": avg_penalties_awarded,
                "avgPenaltiesConceded": avg_penalties_conceded,
                "avgNetPenalties": avg_net_penalties,
            },
            "highScore": high_score,
            "highScoreMatch": high_score_match,
            "hasQualMatches": True,
            "hasTeamMatches": True,
        },
        "matches": normalized_matches,
        "rankings": mock_rankings,
        "teams": mock_teams,
    }

    event_summary = {
        "eventCode": event_code,
        "name": event_name,
        "typeName": type_name,
        "season": season,
        "seasonName": season_name,
        "city": city,
        "stateprov": state_prov,
        "country": country,
        "venue": venue,
        "dateStart": date_start,
        "dateEnd": date_end,
        "status": status,
        "liveStreamUrl": live_stream_url,
        "rank": rank,
        "totalTeams": total_teams,
        "record": f"{wins}-{losses}-{ties}",
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "winRate": win_rate,
        "totalOpr": brickbot_opr["totalOpr"],
        "autoOpr": brickbot_opr["autoOpr"],
        "teleopOpr": brickbot_opr["teleopOpr"],
        "endgameOpr": brickbot_opr["endgameOpr"],
        "matchesPlayed": matches_played,
        "highScore": high_score,
        "hasQualMatches": True,
        "hasTeamMatches": True,
    }

    return {
        "eventDetail": event_detail,
        "eventSummary": event_summary,
    }


class QueueAlertManager:
    """
    Thread-safe in-memory queue alert manager for FTC pulse notifications.
    Stores and broadcasts active queue status for BrickBot #15996.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._current_alert: Optional[Dict[str, Any]] = None
        self._alert_counter: int = 0

    def trigger_alert(self, payload: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Triggers an active match queue alert.

        Args:
            payload: optional dictionary with matchNumber, field, estimatedTime, alliance.

        Returns:
            dict: {"active": True, "alert": alert_dict}
        """
        payload = payload or {}
        match_number = str(payload.get("matchNumber") or "QM-12")
        field = str(payload.get("field") or "Field 1")
        estimated_time = str(payload.get("estimatedTime") or "14:20")
        alliance = str(payload.get("alliance") or "Red")

        with self._lock:
            self._alert_counter += 1
            self._current_alert = {
                "alertId": self._alert_counter,
                "teamNumber": 15996,
                "teamName": "BrickBot",
                "eventCode": "2025_mock_championship",
                "eventName": "FTC Biobuzz Live Invitational",
                "matchNumber": match_number,
                "field": field,
                "alliance": alliance,
                "estimatedTime": estimated_time,
                "title": f"QUEUE ALERT: BrickBot #15996 — {match_number}",
                "message": (
                    f"BrickBot #15996 is queued for {match_number} on {field} "
                    f"({alliance} Alliance • Est. {estimated_time})"
                ),
                "triggeredAt": datetime.now(timezone.utc).isoformat(),
            }
            return {"active": True, "alert": self._current_alert}

    def get_current_alert(self) -> Dict[str, Any]:
        """
        Returns the currently active queue alert, if any.

        Returns:
            dict: {"active": bool, "alert": alert_dict or None}
        """
        with self._lock:
            return {
                "active": self._current_alert is not None,
                "alert": self._current_alert,
            }

    def clear_alert(self) -> Dict[str, Any]:
        """
        Clears the active queue alert.

        Returns:
            dict: {"active": False, "alert": None}
        """
        with self._lock:
            self._current_alert = None
            return {"active": False, "alert": None}


# Singleton alert manager instance
alert_manager = QueueAlertManager()
