"""
FTC BrickBot #15996 Analytics & Statistical Calculation Engine.

Provides:
- compute_event_opr: Ordinary Least Squares with Ridge regularization
  (A^T A + lambda * I) X = A^T B (lambda = 1e-4) via numpy.linalg.solve.
- process_all_season_data: Normalizes FIRST FTC API payloads, builds team profiles,
  aggregates match schedules, calculates period averages, season records,
  best match, best event, and integrates mock championship data.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    import numpy as np
except ImportError:
    np = None

SEASON_NAMES: Dict[int, str] = {
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


def _solve_ridge_regression(
    A_rows: List[List[float]],
    b_values: List[float],
    lambda_reg: float = 1e-4,
) -> List[float]:
    """
    Solves (A^T A + lambda * I) X = A^T B.
    Uses numpy.linalg.solve when numpy is available, with pure Python fallback.
    """
    if not A_rows or not b_values:
        return []

    num_rows = len(A_rows)
    num_cols = len(A_rows[0])
    if num_cols == 0:
        return []

    if np is not None:
        A = np.array(A_rows, dtype=float)
        b = np.array(b_values, dtype=float)
        ATA = A.T @ A
        reg_matrix = ATA + lambda_reg * np.eye(num_cols)
        ATb = A.T @ b
        try:
            return np.linalg.solve(reg_matrix, ATb).tolist()
        except np.linalg.LinAlgError:
            sol, _, _, _ = np.linalg.lstsq(A, b, rcond=None)
            return sol.tolist()

    # Pure Python Gaussian elimination fallback for environments without numpy
    ATA = [[0.0] * num_cols for _ in range(num_cols)]
    for r in range(num_rows):
        row = A_rows[r]
        for i in range(num_cols):
            if row[i] != 0.0:
                for j in range(num_cols):
                    if row[j] != 0.0:
                        ATA[i][j] += row[i] * row[j]

    for i in range(num_cols):
        ATA[i][i] += lambda_reg

    ATb = [0.0] * num_cols
    for r in range(num_rows):
        val = b_values[r]
        if val != 0.0:
            for i in range(num_cols):
                if A_rows[r][i] != 0.0:
                    ATb[i] += A_rows[r][i] * val

    M = [ATA[i][:] + [ATb[i]] for i in range(num_cols)]
    for i in range(num_cols):
        max_row = max(range(i, num_cols), key=lambda r: abs(M[r][i]))
        M[i], M[max_row] = M[max_row], M[i]
        pivot = M[i][i]
        if abs(pivot) < 1e-12:
            continue
        for j in range(i + 1, num_cols):
            factor = M[j][i] / pivot
            for k in range(i, num_cols + 1):
                M[j][k] -= factor * M[i][k]

    x = [0.0] * num_cols
    for i in range(num_cols - 1, -1, -1):
        if abs(M[i][i]) < 1e-12:
            x[i] = 0.0
            continue
        s = sum(M[i][j] * x[j] for j in range(i + 1, num_cols))
        x[i] = (M[i][num_cols] - s) / M[i][i]

    return x


def compute_event_opr(matches: list, qual_scores: list) -> dict[int, dict]:
    """
    Computes Offensive Power Rating (OPR) for all teams participating in
    qualification matches at an event using Ridge-regularized OLS:
    (A^T A + lambda * I) X = A^T B with lambda = 1e-4.

    Applies robot-specific task separation for 2025 DECODE:
    - Auto leave: robot1Auto / robot2Auto (3 pts each)
    - Endgame: robot1Teleop / robot2Teleop (10 pts FULL, 5 pts PARTIAL, 15 pts if both FULL with 30 base)
    Individual robot-specific tasks are isolated and their match averages are added
    to the solved shared component ratings.

    Args:
        matches: list of match dicts from FIRST FTC API or simulated schedule.
        qual_scores: list of score breakdown dicts for qualification matches.

    Returns:
        dict: { team_num: { "totalOpr": float, "autoOpr": float, "teleopOpr": float, "endgameOpr": float } }
    """
    # 1. Filter matches to qualification matches where scores are recorded (ignore practice)
    valid_matches = []
    for m in matches:
        if not isinstance(m, dict):
            continue
        level = str(m.get("tournamentLevel", "")).upper()
        desc = str(m.get("description", "")).upper()
        if "PRACTICE" in level or "PRACTICE" in desc:
            continue
        if "QUAL" in level and m.get("scoreRedFinal") is not None and m.get("scoreBlueFinal") is not None:
            valid_matches.append(m)

    if not valid_matches:
        return {}

    # 2. Map qual_scores by matchNumber -> {"Red": alliance_dict, "Blue": alliance_dict}
    scores_by_match: Dict[int, Dict[str, dict]] = {}
    for item in qual_scores:
        if not isinstance(item, dict):
            continue
        m_num = item.get("matchNumber")
        if m_num is None:
            continue
        try:
            m_num_int = int(m_num)
        except (ValueError, TypeError):
            continue

        if m_num_int not in scores_by_match:
            scores_by_match[m_num_int] = {}

        if "alliances" in item and isinstance(item["alliances"], list):
            for a in item["alliances"]:
                color = str(a.get("alliance") or a.get("color") or "").capitalize()
                if color in ("Red", "Blue"):
                    scores_by_match[m_num_int][color] = a
        elif "Red" in item or "Blue" in item:
            if isinstance(item.get("Red"), dict):
                scores_by_match[m_num_int]["Red"] = item["Red"]
            if isinstance(item.get("Blue"), dict):
                scores_by_match[m_num_int]["Blue"] = item["Blue"]
        elif "alliance" in item:
            color = str(item.get("alliance") or "").capitalize()
            if color in ("Red", "Blue"):
                scores_by_match[m_num_int][color] = item

    # 3. Collect unique teams participating in qualification matches
    teams_set = set()
    for m in valid_matches:
        for t in m.get("teams", []):
            try:
                num = int(t.get("teamNumber", 0))
                if num > 0:
                    teams_set.add(num)
            except (ValueError, TypeError):
                continue

    if not teams_set:
        return {}

    team_list = sorted(list(teams_set))
    team_to_col = {num: idx for idx, num in enumerate(team_list)}
    num_teams = len(team_list)

    A_rows: List[List[float]] = []
    b_shared_auto: List[float] = []
    b_teleop: List[float] = []
    b_shared_endgame: List[float] = []

    # Track robot-specific task contributions per team across qualification matches
    team_auto_spec_pts: Dict[int, List[float]] = {num: [] for num in team_list}
    team_end_spec_pts: Dict[int, List[float]] = {num: [] for num in team_list}

    for m in valid_matches:
        try:
            m_num = int(m.get("matchNumber", 0))
        except (ValueError, TypeError):
            m_num = 0

        # Group teams by alliance and station
        red_alliance_teams = []
        blue_alliance_teams = []
        for t in m.get("teams", []):
            try:
                num = int(t.get("teamNumber", 0))
                if num <= 0:
                    continue
                station = str(t.get("station", "")).upper()
                alliance = str(t.get("alliance", "")).upper()
                if "RED" in station or alliance == "RED":
                    red_alliance_teams.append(t)
                elif "BLUE" in station or alliance == "BLUE":
                    blue_alliance_teams.append(t)
            except (ValueError, TypeError):
                continue

        for color, alliance_teams_info in [("Red", red_alliance_teams), ("Blue", blue_alliance_teams)]:
            if not alliance_teams_info:
                continue

            alliance_team_nums = []
            for t in alliance_teams_info:
                try:
                    num = int(t.get("teamNumber", 0))
                    if num > 0:
                        alliance_team_nums.append(num)
                except (ValueError, TypeError):
                    pass

            if not alliance_team_nums:
                continue

            bd = scores_by_match.get(m_num, {}).get(color)
            if bd:
                auto_pts = float(bd.get("autoPoints", 0) or 0)
                endgame_pts = float(bd.get("teleopBasePoints", 0) or 0)
                teleop_driver_pts = float(bd.get("teleopPoints", 0) or 0) - endgame_pts
            else:
                if color == "Red":
                    auto_pts = float(m.get("scoreRedAuto", 0) or 0)
                    opp_foul = float(m.get("scoreBlueFoul", 0) or 0)
                    final_score = float(m.get("scoreRedFinal", 0) or 0)
                else:
                    auto_pts = float(m.get("scoreBlueAuto", 0) or 0)
                    opp_foul = float(m.get("scoreRedFoul", 0) or 0)
                    final_score = float(m.get("scoreBlueFinal", 0) or 0)

                non_foul_total = max(0.0, final_score - opp_foul)
                teleop_driver_pts = max(0.0, non_foul_total - auto_pts)
                endgame_pts = 0.0

            # Identify team numbers for station 1 and station 2
            t1_num: Optional[int] = None
            t2_num: Optional[int] = None

            for t in alliance_teams_info:
                st = str(t.get("station", "")).upper()
                num = int(t.get("teamNumber", 0))
                if num <= 0:
                    continue
                if st.endswith("1") or "1" in st:
                    t1_num = num
                elif st.endswith("2") or "2" in st:
                    t2_num = num

            # Fallbacks if stations didn't end in 1 or 2
            if t1_num is None and len(alliance_team_nums) > 0:
                t1_num = alliance_team_nums[0]
            if t2_num is None and len(alliance_team_nums) > 1:
                candidates = [n for n in alliance_team_nums if n != t1_num]
                if candidates:
                    t2_num = candidates[0]

            has_robot_specific = (
                bd is not None and (
                    "robot1Auto" in bd or "robot2Auto" in bd
                    or "robot1Teleop" in bd or "robot2Teleop" in bd
                )
            )

            if has_robot_specific and bd is not None:
                # Individual auto leave points (3.0 pts if True else 0.0)
                r1_auto = bd.get("robot1Auto")
                r2_auto = bd.get("robot2Auto")
                r1_auto_spec = 3.0 if (r1_auto is True or str(r1_auto).lower() == "true") else 0.0
                r2_auto_spec = 3.0 if (r2_auto is True or str(r2_auto).lower() == "true") else 0.0

                # Individual endgame parking points
                r1_tele = str(bd.get("robot1Teleop") or "").upper()
                r2_tele = str(bd.get("robot2Teleop") or "").upper()
                base_pts = float(bd.get("teleopBasePoints", 0) or 0)

                if r1_tele == "FULL" and r2_tele == "FULL" and base_pts == 30.0:
                    r1_end_spec = 15.0
                    r2_end_spec = 15.0
                else:
                    r1_end_spec = 10.0 if r1_tele == "FULL" else (5.0 if r1_tele == "PARTIAL" else 0.0)
                    r2_end_spec = 10.0 if r2_tele == "FULL" else (5.0 if r2_tele == "PARTIAL" else 0.0)
            else:
                r1_auto_spec = 0.0
                r2_auto_spec = 0.0
                r1_end_spec = 0.0
                r2_end_spec = 0.0

            # Record robot-specific points for participating teams in this match
            if t1_num is not None and t1_num in team_auto_spec_pts:
                team_auto_spec_pts[t1_num].append(r1_auto_spec)
                team_end_spec_pts[t1_num].append(r1_end_spec)

            if t2_num is not None and t2_num in team_auto_spec_pts:
                team_auto_spec_pts[t2_num].append(r2_auto_spec)
                team_end_spec_pts[t2_num].append(r2_end_spec)

            shared_auto_pts = max(0.0, auto_pts - (r1_auto_spec + r2_auto_spec))
            shared_endgame_pts = max(0.0, endgame_pts - (r1_end_spec + r2_end_spec))

            # Build participation row
            row = [0.0] * num_teams
            for t_num in alliance_team_nums:
                if t_num in team_to_col:
                    row[team_to_col[t_num]] = 1.0

            A_rows.append(row)
            b_shared_auto.append(shared_auto_pts)
            b_teleop.append(teleop_driver_pts)
            b_shared_endgame.append(shared_endgame_pts)

    if not A_rows:
        return {}

    # Solve Ridge regressions: (A^T A + lambda * I) X = A^T B
    X_auto = _solve_ridge_regression(A_rows, b_shared_auto, lambda_reg=1e-4)
    X_teleop = _solve_ridge_regression(A_rows, b_teleop, lambda_reg=1e-4)
    X_endgame = _solve_ridge_regression(A_rows, b_shared_endgame, lambda_reg=1e-4)

    # Compute average robot-specific points per team across qualification matches played
    avg_auto_spec: Dict[int, float] = {}
    avg_end_spec: Dict[int, float] = {}
    for num in team_list:
        a_samples = team_auto_spec_pts.get(num, [])
        e_samples = team_end_spec_pts.get(num, [])
        avg_auto_spec[num] = sum(a_samples) / len(a_samples) if a_samples else 0.0
        avg_end_spec[num] = sum(e_samples) / len(e_samples) if e_samples else 0.0

    opr_results: Dict[int, Dict[str, float]] = {}
    for idx, num in enumerate(team_list):
        auto_opr = round(float(X_auto[idx]) + avg_auto_spec[num], 2)
        teleop_opr = round(float(X_teleop[idx]), 2)
        endgame_opr = round(float(X_endgame[idx]) + avg_end_spec[num], 2)
        total_opr = round(auto_opr + teleop_opr + endgame_opr, 2)
        opr_results[num] = {
            "totalOpr": total_opr,
            "autoOpr": auto_opr,
            "teleopOpr": teleop_opr,
            "endgameOpr": endgame_opr,
        }

    return opr_results


def _extract_event_components(ev: dict) -> Tuple[dict, list, list, list]:
    """
    Safely unpacks event metadata, matches, scores, and rankings from
    either wrapped raw API dict or flattened event dict.
    Supports both 'event' / 'eventMeta' and 'scores' / 'qualScores'.
    """
    if "eventMeta" in ev and isinstance(ev["eventMeta"], dict):
        meta = ev["eventMeta"]
    elif "event" in ev and isinstance(ev["event"], dict):
        meta = ev["event"]
    else:
        meta = ev

    matches = ev.get("matches", [])
    scores = ev.get("qualScores") or ev.get("scores") or []
    rankings = ev.get("rankings", [])

    if isinstance(matches, dict) and "matches" in matches:
        matches = matches["matches"]
    if isinstance(scores, dict) and "matchScores" in scores:
        scores = scores["matchScores"]
    if isinstance(rankings, dict) and "Rankings" in rankings:
        rankings = rankings["Rankings"]

    return meta, matches or [], scores or [], rankings or []


def _build_alliance_task_breakdown(
    bd: dict | None,
    auto_pts: int,
    tele_pts: int,
    end_pts: int,
    foul_awarded: int,
    opp_foul_committed: int,
    total_pts: int,
    opp_bd: dict | None = None,
    alliance_teams: list | None = None,
) -> dict:
    """
    Builds the detailed 2025 DECODE game-task breakdown for an alliance.
    When bd has real DECODE scoring fields, preserves authentic metrics.
    When bd is None or lacks sub-task breakdown (playoffs, mock, historical),
    synthesizes clean task values that sum accurately to phase totals.
    Also extracts yellowCards, redCards, and cardedTeams from alliance_teams and/or bd.
    """
    auto_pts = int(auto_pts or 0)
    tele_pts = int(tele_pts or 0)
    end_pts = int(end_pts or 0)
    foul_awarded = int(foul_awarded or 0)
    opp_foul_committed = int(opp_foul_committed or 0)
    total_pts = int(total_pts or 0)

    # Extract card flags from participating alliance teams
    yellow_cards = sum(1 for t in (alliance_teams or []) if bool(t.get("yellowCard", False)))
    red_cards = sum(1 for t in (alliance_teams or []) if bool(t.get("redCard", False)))
    carded_teams = [
        int(t.get("teamNumber"))
        for t in (alliance_teams or [])
        if (bool(t.get("yellowCard", False)) or bool(t.get("redCard", False))) and t.get("teamNumber") is not None
    ]
    if bd and isinstance(bd, dict):
        if "yellowCards" in bd:
            yellow_cards = max(yellow_cards, int(bd.get("yellowCards", 0) or 0))
        if "redCards" in bd:
            red_cards = max(red_cards, int(bd.get("redCards", 0) or 0))
        if "cardedTeams" in bd and isinstance(bd.get("cardedTeams"), list):
            carded_teams = list(dict.fromkeys(carded_teams + [int(x) for x in bd["cardedTeams"] if x is not None]))

    has_real_decode = (
        bd is not None
        and (
            "autoArtifactPoints" in bd
            or "autoLeavePoints" in bd
            or "autoClassifiedArtifacts" in bd
            or "robot1Auto" in bd
        )
    )

    if has_real_decode and bd is not None:
        r1_auto = bool(bd.get("robot1Auto") is True or str(bd.get("robot1Auto", "")).lower() == "true")
        r2_auto = bool(bd.get("robot2Auto") is True or str(bd.get("robot2Auto", "")).lower() == "true")
        auto_leave = int(bd.get("autoLeavePoints", (3 if r1_auto else 0) + (3 if r2_auto else 0)) or 0)
        auto_artifact = int(bd.get("autoArtifactPoints", 0) or 0)
        auto_classified = int(bd.get("autoClassifiedArtifacts", 0) or 0)
        auto_overflow = int(bd.get("autoOverflowArtifacts", 0) or 0)
        auto_pattern = int(bd.get("autoPatternPoints", 0) or 0)
        tele_artifact = int(bd.get("teleopArtifactPoints", 0) or 0)
        tele_classified = int(bd.get("teleopClassifiedArtifacts", 0) or 0)
        tele_overflow = int(bd.get("teleopOverflowArtifacts", 0) or 0)
        tele_depot = int(bd.get("teleopDepotPoints", 0) or 0)
        tele_depot_cnt = int(bd.get("teleopDepotArtifacts", 0) or 0)
        tele_pattern = int(bd.get("teleopPatternPoints", 0) or 0)
        r1_tele = str(bd.get("robot1Teleop") or "NONE")
        r2_tele = str(bd.get("robot2Teleop") or "NONE")
        base_pts = int(bd.get("teleopBasePoints", end_pts) or 0)
        major_fouls = int(bd.get("majorFouls", 0) or 0)
        minor_fouls = int(bd.get("minorFouls", 0) or 0)
    else:
        r1_auto = auto_pts >= 3
        r2_auto = auto_pts >= 6
        auto_leave = (3 if r1_auto else 0) + (3 if r2_auto else 0)
        auto_pattern = 4 if auto_pts >= 20 else 0
        auto_artifact = max(0, auto_pts - auto_leave - auto_pattern)
        auto_classified = auto_artifact // 3
        auto_overflow = 0
        tele_pattern = 8 if tele_pts >= 40 else 0
        tele_depot = 4 if tele_pts >= 60 else 0
        tele_depot_cnt = tele_depot // 2
        tele_artifact = max(0, tele_pts - tele_pattern - tele_depot)
        tele_classified = tele_artifact // 3
        tele_overflow = 0
        base_pts = end_pts
        r1_tele = "FULL" if end_pts >= 10 else ("PARTIAL" if end_pts >= 5 else "NONE")
        r2_tele = "FULL" if end_pts >= 20 else ("PARTIAL" if end_pts >= 15 else "NONE")
        major_fouls = 0
        minor_fouls = 0

    if major_fouls == 0 and minor_fouls == 0 and opp_foul_committed > 0:
        major_fouls = opp_foul_committed // 15
        minor_fouls = max(0, opp_foul_committed - major_fouls * 15) // 5
        if major_fouls == 0 and minor_fouls == 0:
            minor_fouls = 1

    opp_major = 0
    opp_minor = 0
    if opp_bd is not None and isinstance(opp_bd, dict):
        opp_major = int(opp_bd.get("majorFouls", 0) or 0)
        opp_minor = int(opp_bd.get("minorFouls", 0) or 0)

    if foul_awarded > 0 and opp_major == 0 and opp_minor == 0:
        opp_major = foul_awarded // 15
        opp_minor = max(0, foul_awarded - opp_major * 15) // 5
        if opp_major == 0 and opp_minor == 0:
            opp_minor = 1

    return {
        "robot1Auto": r1_auto,
        "robot2Auto": r2_auto,
        "autoLeavePoints": auto_leave,
        "autoArtifactPoints": auto_artifact,
        "autoClassifiedArtifacts": auto_classified,
        "autoOverflowArtifacts": auto_overflow,
        "autoPatternPoints": auto_pattern,
        "autoTotal": auto_pts,
        "teleopArtifactPoints": tele_artifact,
        "teleopClassifiedArtifacts": tele_classified,
        "teleopOverflowArtifacts": tele_overflow,
        "teleopDepotPoints": tele_depot,
        "teleopDepotArtifacts": tele_depot_cnt,
        "teleopPatternPoints": tele_pattern,
        "teleopTotal": tele_pts,
        "robot1Teleop": r1_tele,
        "robot2Teleop": r2_tele,
        "endgameBasePoints": base_pts,
        "foulPointsAwarded": foul_awarded,
        "foulPointsCommitted": opp_foul_committed,
        "majorFouls": major_fouls,
        "minorFouls": minor_fouls,
        "opponentMajorFouls": opp_major,
        "opponentMinorFouls": opp_minor,
        "nonPenaltyTotal": auto_pts + tele_pts + base_pts,
        "totalScore": total_pts,
        "yellowCards": yellow_cards,
        "redCards": red_cards,
        "cardedTeams": carded_teams,
    }


def process_all_season_data(raw_data: dict, mock_event_bundle: dict | None = None) -> dict:
    """
    Processes all season records, calculating event-level OPRs, period averages,
    team match schedules, season records, high score, and merging the active
    mock championship simulation.

    Args:
        raw_data: dictionary containing team profile and list of events with raw matches,
                  scores, and rankings.
        mock_event_bundle: optional pre-built mock event dictionary from mock_event.py.

    Returns:
        dict: {
            "team": team_profile,
            "seasonSummary": season_summary,
            "eventsByCode": { event_code: event_detail, ... }
        }
    """
    raw_events = raw_data.get("events", []) if isinstance(raw_data, dict) else []
    raw_team = {}
    if isinstance(raw_data, dict):
        raw_team = raw_data.get("teamProfile") or raw_data.get("team") or {}
    if not isinstance(raw_team, dict):
        raw_team = {}

    # 1. Build team names lookup dictionary
    team_names: Dict[int, str] = {15996: "BrickBot"}
    for ev in raw_events:
        _, matches, _, rankings = _extract_event_components(ev)
        for r in rankings:
            if isinstance(r, dict):
                num = r.get("teamNumber")
                name = (
                    r.get("teamName")
                    or r.get("name")
                    or r.get("teamNameShort")
                    or r.get("nameShort")
                    or r.get("teamNameFull")
                )
                if num is not None and name:
                    try:
                        n_int = int(num)
                        if n_int not in team_names:
                            team_names[n_int] = str(name)
                    except (ValueError, TypeError):
                        pass

        for m in matches:
            if isinstance(m, dict):
                for t in m.get("teams", []):
                    num = t.get("teamNumber")
                    name = t.get("teamName") or t.get("name")
                    if num is not None and name:
                        try:
                            n_int = int(num)
                            if n_int not in team_names:
                                team_names[n_int] = str(name)
                        except (ValueError, TypeError):
                            pass

    # 2. Normalize team profile
    city = str(raw_team.get("city") or "Focsani")
    state_prov = str(raw_team.get("stateProv") or "VN")
    country = str(raw_team.get("country") or "Romania")
    try:
        rookie_year = int(raw_team.get("rookieYear") or 2018)
    except (ValueError, TypeError):
        rookie_year = 2018

    try:
        season_year = int(raw_data.get("season", 2025)) if isinstance(raw_data, dict) else 2025
    except (ValueError, TypeError):
        season_year = 2025
    season_name = str(
        (raw_data.get("seasonName") if isinstance(raw_data, dict) else None)
        or SEASON_NAMES.get(season_year, "DECODE")
    )

    team_profile = {
        "teamNumber": 15996,
        "displayTeamNumber": "15996",
        "nameShort": str(raw_team.get("nameShort") or "BrickBot"),
        "nameFull": str(raw_team.get("nameFull") or "Colegiul National Unirea"),
        "city": city,
        "stateProv": state_prov,
        "country": country,
        "displayLocation": f"{city}, {state_prov}, {country}",
        "rookieYear": rookie_year,
        "season": season_year,
        "seasonName": season_name,
    }

    # 3. Process each event
    events_by_code: Dict[str, dict] = {}
    official_summaries: List[dict] = []
    all_official_played_matches: List[dict] = []

    for ev in raw_events:
        meta, matches, scores, rankings = _extract_event_components(ev)
        event_code = str(meta.get("code") or "").strip()
        if not event_code:
            continue

        name = str(meta.get("name") or event_code)
        type_name = str(meta.get("typeName") or meta.get("type") or "Championship")
        ev_city = str(meta.get("city") or "")
        ev_stateprov = str(meta.get("stateprov") or meta.get("stateProv") or "")
        ev_country = str(meta.get("country") or "")
        venue = str(meta.get("venue") or "")
        date_start = meta.get("dateStart")
        date_end = meta.get("dateEnd")
        live_stream_url = (
            meta.get("liveStreamUrl")
            or meta.get("webcastUrl")
            or None
        )
        try:
            field_count = max(1, int(meta.get("fieldCount") or 2))
        except (ValueError, TypeError):
            field_count = 2

        # Filter practice matches out from matches
        valid_event_matches = [
            m for m in (matches if isinstance(matches, list) else [])
            if isinstance(m, dict)
            and "PRACTICE" not in str(m.get("tournamentLevel", "")).upper()
            and "PRACTICE" not in str(m.get("description", "")).upper()
        ]

        # Compute OPR for this event using valid non-practice matches
        event_opr = compute_event_opr(valid_event_matches, scores)

        # Build scores lookup for this event keyed by (matchLevel, matchNumber)
        # to ensure qualification scores are not matched to playoff matches
        scores_by_match: Dict[Tuple[str, int], Dict[str, dict]] = {}
        for item in scores:
            if not isinstance(item, dict):
                continue
            m_num = item.get("matchNumber")
            if m_num is None:
                continue
            try:
                m_num_int = int(m_num)
            except (ValueError, TypeError):
                continue

            lvl = str(item.get("matchLevel") or item.get("tournamentLevel") or "QUAL").upper()
            lvl_key = "PLAYOFF" if "PLAYOFF" in lvl else "QUAL"

            if (lvl_key, m_num_int) not in scores_by_match:
                scores_by_match[(lvl_key, m_num_int)] = {}

            if "alliances" in item and isinstance(item["alliances"], list):
                for a in item["alliances"]:
                    color = str(a.get("alliance") or a.get("color") or "").capitalize()
                    if color in ("Red", "Blue"):
                        scores_by_match[(lvl_key, m_num_int)][color] = a
            elif "Red" in item or "Blue" in item:
                if isinstance(item.get("Red"), dict):
                    scores_by_match[(lvl_key, m_num_int)]["Red"] = item["Red"]
                if isinstance(item.get("Blue"), dict):
                    scores_by_match[(lvl_key, m_num_int)]["Blue"] = item["Blue"]
            elif "alliance" in item:
                color = str(item.get("alliance") or "").capitalize()
                if color in ("Red", "Blue"):
                    scores_by_match[(lvl_key, m_num_int)][color] = item

        # Filter matches where team 15996 participated
        team_matches: List[dict] = []
        match_idx = 0

        for m in valid_event_matches:
            teams_in_match = m.get("teams", [])
            red_teams = [
                t for t in teams_in_match
                if "RED" in str(t.get("station", "")).upper() or str(t.get("alliance", "")).upper() == "RED"
            ]
            blue_teams = [
                t for t in teams_in_match
                if "BLUE" in str(t.get("station", "")).upper() or str(t.get("alliance", "")).upper() == "BLUE"
            ]

            is_red = any(int(t.get("teamNumber", 0)) == 15996 for t in red_teams)
            is_blue = any(int(t.get("teamNumber", 0)) == 15996 for t in blue_teams)

            if not is_red and not is_blue:
                continue

            level = str(m.get("tournamentLevel", "QUAL"))
            try:
                match_num = int(m.get("matchNumber", match_idx + 1))
            except (ValueError, TypeError):
                match_num = match_idx + 1
            try:
                series = int(m.get("series", 1))
            except (ValueError, TypeError):
                series = 1

            status = m.get("status")
            if not status:
                status = "COMPLETED" if m.get("scoreRedFinal") is not None else "UPCOMING"

            field_label = f"Field {(match_num % field_count) + 1}"
            scheduled_time = (
                m.get("actualStartTime")
                or m.get("postResultTime")
                or m.get("scheduledTime")
            )

            # Determine targetTeamAlliance and match outcome
            target_alliance = "Red" if is_red else ("Blue" if is_blue else None)
            score_red = m.get("scoreRedFinal")
            score_blue = m.get("scoreBlueFinal")

            if score_red is not None and score_blue is not None:
                try:
                    s_red = int(score_red)
                    s_blue = int(score_blue)
                    if s_red == s_blue:
                        result = "TIE"
                    elif target_alliance == "Red":
                        result = "WIN" if s_red > s_blue else "LOSS"
                    elif target_alliance == "Blue":
                        result = "WIN" if s_blue > s_red else "LOSS"
                    else:
                        result = "PENDING"
                except (ValueError, TypeError):
                    result = "PENDING"
            else:
                result = "PENDING"

            # Period breakdown & detailed task breakdown calculation
            lvl_key = "PLAYOFF" if "PLAYOFF" in level.upper() else "QUAL"
            red_bd = scores_by_match.get((lvl_key, match_num), {}).get("Red")
            blue_bd = scores_by_match.get((lvl_key, match_num), {}).get("Blue")

            if red_bd and blue_bd:
                r_auto = int(red_bd.get("autoPoints", 0) or 0)
                r_end = int(red_bd.get("teleopBasePoints", 0) or 0)
                r_tele = int(red_bd.get("teleopPoints", 0) or 0) - r_end
                r_foul = int(
                    red_bd.get("penaltyPointsCommitted", 0)
                    or red_bd.get("foulPointsCommitted", 0)
                    or m.get("scoreRedFoul", 0)
                    or 0
                )
                r_tot = int(score_red) if score_red is not None else (r_auto + r_tele + r_end)

                b_auto = int(blue_bd.get("autoPoints", 0) or 0)
                b_end = int(blue_bd.get("teleopBasePoints", 0) or 0)
                b_tele = int(blue_bd.get("teleopPoints", 0) or 0) - b_end
                b_foul = int(
                    blue_bd.get("penaltyPointsCommitted", 0)
                    or blue_bd.get("foulPointsCommitted", 0)
                    or m.get("scoreBlueFoul", 0)
                    or 0
                )
                b_tot = int(score_blue) if score_blue is not None else (b_auto + b_tele + b_end)

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

            vod_url = (
                m.get("videoURL")
                or live_stream_url
                or None
            )
            if vod_url is not None:
                vod_timestamp = (
                    int(m["vodTimestampSeconds"])
                    if m.get("vodTimestampSeconds") is not None
                    else None
                )
                vod_start = vod_timestamp
                vod_end = (vod_timestamp + 165) if vod_timestamp is not None else None
            else:
                vod_timestamp = None
                vod_start = None
                vod_end = None

            red_alliance_teams = [
                {
                    "teamNumber": int(t["teamNumber"]),
                    "teamName": team_names.get(int(t["teamNumber"]), f"Team {t['teamNumber']}"),
                    "station": t.get("station", "Red"),
                    "isTargetTeam": int(t["teamNumber"]) == 15996,
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
                    "teamNumber": int(t["teamNumber"]),
                    "teamName": team_names.get(int(t["teamNumber"]), f"Team {t['teamNumber']}"),
                    "station": t.get("station", "Blue"),
                    "isTargetTeam": int(t["teamNumber"]) == 15996,
                    "onField": bool(t.get("onField", True)),
                    "dq": bool(t.get("dq", False)),
                    "noShow": bool(t.get("noShow", False)) or (t.get("onField") is False),
                    "yellowCard": bool(t.get("yellowCard", False)),
                    "redCard": bool(t.get("redCard", False)),
                }
                for t in blue_teams
            ]

            norm_match = {
                "matchId": f"{event_code}_{level}_{match_num}_{series}",
                "description": m.get("description", f"Match {match_num}"),
                "tournamentLevel": level,
                "matchNumber": match_num,
                "series": series,
                "status": status,
                "field": field_label,
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
                "result": result,
                "vodUrl": vod_url,
                "vodTimestampSeconds": vod_timestamp,
                "vodStartSeconds": vod_start,
                "vodEndSeconds": vod_end,
                "periodBreakdown": period_breakdown,
                "taskBreakdown": task_breakdown,
            }
            team_matches.append(norm_match)
            match_idx += 1

        # Sort Playoffs Before Qualifications:
        # 1. Playoff Matches ("QUAL" not in level): sorted chronologically by (series, matchNumber, actualStartTime)
        # 2. Qualification Matches ("QUAL" in level): sorted chronologically by (matchNumber, series)
        playoff_matches = [
            m for m in team_matches
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
            m for m in team_matches
            if "QUAL" in str(m.get("tournamentLevel", "")).upper()
        ]
        qual_matches.sort(
            key=lambda m: (
                int(m.get("matchNumber") or 0),
                int(m.get("series") or 0),
            )
        )

        team_matches = playoff_matches + qual_matches

        # Assign synthetic vod timestamps for matches that have stream URL but no pre-existing vod timestamp
        for idx, m in enumerate(team_matches):
            if m.get("vodUrl") is not None and m.get("vodTimestampSeconds") is None:
                vod_ts = int(300 + idx * 420)
                m["vodTimestampSeconds"] = vod_ts
                m["vodStartSeconds"] = vod_ts
                m["vodEndSeconds"] = vod_ts + 165

        # Check qualification matches and team participation at this event
        qual_matches_in_event = [
            m for m in valid_event_matches
            if isinstance(m, dict)
            and "QUAL" in str(m.get("tournamentLevel", "")).upper()
            and m.get("scoreRedFinal") is not None
        ]
        has_qual_matches = len(qual_matches_in_event) > 0

        # Compute each team's average qualification match score across all completed qualification matches
        team_qual_scores_list: Dict[int, List[float]] = {}
        for m in valid_event_matches:
            if "QUAL" in str(m.get("tournamentLevel", "")).upper() and m.get("scoreRedFinal") is not None and m.get("scoreBlueFinal") is not None:
                try:
                    s_red = float(m["scoreRedFinal"])
                    s_blue = float(m["scoreBlueFinal"])
                except (ValueError, TypeError):
                    continue
                for t in m.get("teams", []):
                    try:
                        t_num = int(t.get("teamNumber", 0))
                    except (ValueError, TypeError):
                        continue
                    if t_num <= 0:
                        continue
                    st = str(t.get("station", "")).upper()
                    al = str(t.get("alliance", "")).upper()
                    if "RED" in st or al == "RED":
                        team_qual_scores_list.setdefault(t_num, []).append(s_red)
                    elif "BLUE" in st or al == "BLUE":
                        team_qual_scores_list.setdefault(t_num, []).append(s_blue)

        team_avg_scores: Dict[int, float] = {
            t_num: round(sum(scs) / len(scs), 1)
            for t_num, scs in team_qual_scores_list.items()
            if scs
        }

        completed_matches = [m for m in team_matches if m["result"] in ("WIN", "LOSS", "TIE")]
        has_team_matches = len(completed_matches) > 0

        team_qual_matches = [
            m for m in completed_matches
            if "QUAL" in str(m.get("tournamentLevel", "")).upper()
        ]
        has_team_qual_matches = len(team_qual_matches) > 0

        has_qual_flag = bool(has_qual_matches and has_team_qual_matches)
        has_team_flag = bool(has_team_matches)

        auto_scores: List[float] = []
        teleop_scores: List[float] = []
        endgame_scores: List[float] = []
        total_scores: List[float] = []
        score_margins: List[float] = []
        penalties_awarded: List[float] = []
        penalties_conceded: List[float] = []
        event_high_score = 0
        event_high_score_match = ""

        if has_qual_flag:
            team_ranking = next(
                (r for r in rankings if isinstance(r, dict) and int(r.get("teamNumber", 0)) == 15996),
                None,
            )

            rank_val = None
            if team_ranking:
                try:
                    rank_val = int(team_ranking.get("rank"))
                except (ValueError, TypeError):
                    rank_val = None

            total_teams_count = len(rankings) if rankings else len(event_opr)

            if team_ranking and team_ranking.get("wins") is not None:
                wins = int(team_ranking.get("wins", 0))
                losses = int(team_ranking.get("losses", 0))
                ties = int(team_ranking.get("ties", 0))
            else:
                wins = sum(1 for m in team_qual_matches if m["result"] == "WIN")
                losses = sum(1 for m in team_qual_matches if m["result"] == "LOSS")
                ties = sum(1 for m in team_qual_matches if m["result"] == "TIE")

            matches_played = wins + losses + ties
            win_rate = round((wins / matches_played) * 100.0, 1) if matches_played > 0 else 0.0

            team_opr = event_opr.get(
                15996,
                {"totalOpr": 0.0, "autoOpr": 0.0, "teleopOpr": 0.0, "endgameOpr": 0.0},
            )

            for cm in completed_matches:
                target_col = cm["targetTeamAlliance"]
                bd = cm.get("periodBreakdown")
                if target_col == "Red":
                    s_tot = cm.get("scoreRedFinal") or 0
                    opp_foul = cm.get("scoreBlueFoul") or 0
                    if bd and "red" in bd:
                        s_auto = bd["red"]["auto"]
                        s_tele = bd["red"]["teleop"]
                        s_end = bd["red"]["endgame"]
                        non_foul_tot = s_auto + s_tele + s_end
                    else:
                        s_auto = cm.get("scoreRedAuto") or 0
                        non_foul_tot = max(0, int(s_tot) - int(opp_foul))
                        s_tele = max(0, non_foul_tot - s_auto)
                        s_end = 0
                else:
                    s_tot = cm.get("scoreBlueFinal") or 0
                    opp_foul = cm.get("scoreRedFoul") or 0
                    if bd and "blue" in bd:
                        s_auto = bd["blue"]["auto"]
                        s_tele = bd["blue"]["teleop"]
                        s_end = bd["blue"]["endgame"]
                        non_foul_tot = s_auto + s_tele + s_end
                    else:
                        s_auto = cm.get("scoreBlueAuto") or 0
                        non_foul_tot = max(0, int(s_tot) - int(opp_foul))
                        s_tele = max(0, non_foul_tot - s_auto)
                        s_end = 0

                auto_scores.append(float(s_auto))
                teleop_scores.append(float(s_tele))
                endgame_scores.append(float(s_end))
                total_scores.append(float(non_foul_tot))

                s_red_f = float(cm.get("scoreRedFinal") or 0)
                s_blue_f = float(cm.get("scoreBlueFinal") or 0)
                if target_col == "Red":
                    signed_margin = s_red_f - s_blue_f
                elif target_col == "Blue":
                    signed_margin = s_blue_f - s_red_f
                else:
                    signed_margin = 0.0
                score_margins.append(signed_margin)

                if int(non_foul_tot) > event_high_score:
                    event_high_score = int(non_foul_tot)
                    event_high_score_match = str(cm.get("description", ""))

                # Penalty foul tracking for target team
                t_side = "red" if target_col == "Red" else "blue"
                opp_side = "blue" if target_col == "Red" else "red"
                tb = cm.get("taskBreakdown") or {}
                side_tb = tb.get(t_side) or {}

                foul_awarded_val = side_tb.get("foulPointsAwarded")
                if foul_awarded_val is None:
                    foul_awarded_val = cm.get(f"score{opp_side.capitalize()}Foul", 0) or 0

                foul_conceded_val = side_tb.get("foulPointsCommitted")
                if foul_conceded_val is None:
                    foul_conceded_val = cm.get(f"score{t_side.capitalize()}Foul", 0) or 0

                penalties_awarded.append(float(foul_awarded_val or 0))
                penalties_conceded.append(float(foul_conceded_val or 0))

                if "QUAL" in str(cm.get("tournamentLevel", "")).upper():
                    all_official_played_matches.append({
                        "score": int(non_foul_tot),
                        "nonFoulScore": int(non_foul_tot),
                        "matchDescription": str(cm.get("description", "")),
                        "matchNumber": int(cm.get("matchNumber", 0)),
                        "tournamentLevel": str(cm.get("tournamentLevel", "QUAL")),
                        "alliance": str(target_col),
                        "eventCode": event_code,
                        "eventName": name,
                        "auto": float(s_auto),
                        "teleop": float(s_tele),
                        "endgame": float(s_end),
                        "result": str(cm.get("result", "")),
                        "scoreMargin": signed_margin,
                        "winningMargin": signed_margin,
                        "foulAwarded": float(foul_awarded_val or 0),
                        "foulCommitted": float(foul_conceded_val or 0),
                    })
        else:
            rank_val = None
            wins = 0
            losses = 0
            ties = 0
            win_rate = 0.0
            matches_played = 0
            event_high_score = 0
            event_high_score_match = ""
            total_teams_count = len(event_opr) if event_opr else (len(rankings) if rankings else 0)
            team_opr = {"totalOpr": 0.0, "autoOpr": 0.0, "teleopOpr": 0.0, "endgameOpr": 0.0}

        auto_avg = round(sum(auto_scores) / len(auto_scores), 2) if auto_scores else 0.0
        teleop_avg = round(sum(teleop_scores) / len(teleop_scores), 2) if teleop_scores else 0.0
        endgame_avg = round(sum(endgame_scores) / len(endgame_scores), 2) if endgame_scores else 0.0
        total_avg = round(sum(total_scores) / len(total_scores), 2) if total_scores else 0.0
        avg_score_margin = round(sum(score_margins) / len(score_margins), 1) if score_margins else 0.0
        avg_penalties_awarded = round(sum(penalties_awarded) / len(penalties_awarded), 1) if penalties_awarded else 0.0
        avg_penalties_conceded = round(sum(penalties_conceded) / len(penalties_conceded), 1) if penalties_conceded else 0.0
        avg_net_penalties = round(avg_penalties_awarded - avg_penalties_conceded, 1)

        opr_ranks = {
            "total": 1 + sum(1 for t, o in event_opr.items() if o.get("totalOpr", 0.0) > team_opr.get("totalOpr", 0.0)) if event_opr else 1,
            "auto": 1 + sum(1 for t, o in event_opr.items() if o.get("autoOpr", 0.0) > team_opr.get("autoOpr", 0.0)) if event_opr else 1,
            "teleop": 1 + sum(1 for t, o in event_opr.items() if o.get("teleopOpr", 0.0) > team_opr.get("teleopOpr", 0.0)) if event_opr else 1,
            "endgame": 1 + sum(1 for t, o in event_opr.items() if o.get("endgameOpr", 0.0) > team_opr.get("endgameOpr", 0.0)) if event_opr else 1,
        }

        event_stats = {
            "teamNumber": 15996,
            "rank": rank_val,
            "totalTeams": total_teams_count,
            "wins": wins,
            "losses": losses,
            "ties": ties,
            "winRate": win_rate,
            "matchesPlayed": matches_played,
            "opr": team_opr,
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
            "highScore": event_high_score,
            "highScoreMatch": event_high_score_match,
            "hasQualMatches": has_qual_flag,
            "hasTeamMatches": has_team_flag,
        }

        event_meta_cleaned = {
            "code": event_code,
            "name": name,
            "typeName": type_name,
            "season": season_year,
            "seasonName": season_name,
            "city": ev_city,
            "stateprov": ev_stateprov,
            "country": ev_country,
            "venue": venue,
            "dateStart": date_start,
            "dateEnd": date_end,
            "status": "COMPLETED",
            "liveStreamUrl": live_stream_url,
            "fieldCount": field_count,
            "hasQualMatches": has_qual_flag,
            "hasTeamMatches": has_team_flag,
        }

        # Build rankings table
        event_rankings: List[dict] = []
        if has_qual_matches and rankings:
            for r in rankings:
                if not isinstance(r, dict):
                    continue
                try:
                    r_rank = int(r.get("rank"))
                    r_team = int(r.get("teamNumber"))
                except (ValueError, TypeError):
                    continue
                r_name = str(
                    r.get("teamName")
                    or r.get("name")
                    or r.get("teamNameShort")
                    or team_names.get(r_team, f"Team {r_team}")
                )
                r_wins = int(r.get("wins", 0) or 0)
                r_losses = int(r.get("losses", 0) or 0)
                r_ties = int(r.get("ties", 0) or 0)
                r_mp = int(r.get("matchesPlayed", r_wins + r_losses + r_ties) or 0)

                # rp: sortOrder1 from FTC API ranking if present, else round((wins * 2.0 + ties) / max(1, matchesPlayed), 2)
                if r.get("sortOrder1") is not None:
                    try:
                        r_rp = round(float(r["sortOrder1"]), 2)
                    except (ValueError, TypeError):
                        r_rp = round((r_wins * 2.0 + r_ties) / max(1, r_mp), 2)
                else:
                    r_rp = round((r_wins * 2.0 + r_ties) / max(1, r_mp), 2)

                t_auto_opr = event_opr.get(r_team, {}).get("autoOpr", 0.0)
                t_endgame_opr = event_opr.get(r_team, {}).get("endgameOpr", 0.0)
                t_total_opr = event_opr.get(r_team, {}).get("totalOpr", 0.0)

                # tb1: sortOrder2 from FTC API ranking if present, else round(auto_opr * 2.0, 1)
                if r.get("sortOrder2") is not None:
                    try:
                        r_tb1 = round(float(r["sortOrder2"]), 1)
                    except (ValueError, TypeError):
                        r_tb1 = round(t_auto_opr * 2.0, 1)
                else:
                    r_tb1 = round(t_auto_opr * 2.0, 1)

                # tb2: sortOrder3 or sortOrder4 from FTC API ranking if present, else round(endgame_opr * 1.5, 1)
                so3 = r.get("sortOrder3")
                so4 = r.get("sortOrder4")
                if so3 is not None:
                    try:
                        r_tb2 = round(float(so3), 1)
                    except (ValueError, TypeError):
                        r_tb2 = round(t_endgame_opr * 1.5, 1)
                elif so4 is not None:
                    try:
                        r_tb2 = round(float(so4), 1)
                    except (ValueError, TypeError):
                        r_tb2 = round(t_endgame_opr * 1.5, 1)
                else:
                    r_tb2 = round(t_endgame_opr * 1.5, 1)

                # avgScore: team_avg_scores.get(team_num) if available, else round(total_opr * 1.85, 1)
                r_avg_score = team_avg_scores.get(r_team, round(t_total_opr * 1.85, 1))

                event_rankings.append({
                    "rank": r_rank,
                    "teamNumber": r_team,
                    "teamName": r_name,
                    "wins": r_wins,
                    "losses": r_losses,
                    "ties": r_ties,
                    "matchesPlayed": r_mp,
                    "rp": r_rp,
                    "tb1": r_tb1,
                    "tb2": r_tb2,
                    "avgScore": r_avg_score,
                    "totalOpr": t_total_opr,
                    "isTargetTeam": r_team == 15996,
                })
            event_rankings.sort(key=lambda x: x["rank"])

        # Build teams table (all unique teams at the event, sorted ascending by teamNumber)
        rank_by_team = {rk["teamNumber"]: rk for rk in event_rankings}
        all_event_team_nums = set(rank_by_team.keys())
        for m in matches:
            if isinstance(m, dict):
                for t in m.get("teams", []):
                    try:
                        t_num = int(t.get("teamNumber", 0))
                        if t_num > 0:
                            all_event_team_nums.add(t_num)
                    except (ValueError, TypeError):
                        pass

        event_teams: List[dict] = []
        for t_num in sorted(list(all_event_team_nums)):
            rk = rank_by_team.get(t_num)
            t_name = team_names.get(t_num, f"Team {t_num}")
            if rk:
                event_teams.append({
                    "teamNumber": t_num,
                    "teamName": rk["teamName"] or t_name,
                    "rank": rk["rank"],
                    "record": f"{rk['wins']}-{rk['losses']}-{rk['ties']}",
                    "totalOpr": rk["totalOpr"],
                    "isTargetTeam": t_num == 15996,
                })
            else:
                t_opr = event_opr.get(t_num, {}).get("totalOpr") if has_qual_matches else None
                event_teams.append({
                    "teamNumber": t_num,
                    "teamName": t_name,
                    "rank": None,
                    "record": None,
                    "totalOpr": t_opr,
                    "isTargetTeam": t_num == 15996,
                })

        event_teams.sort(key=lambda t: t["teamNumber"])

        # Save event detail in eventsByCode dictionary
        events_by_code[event_code] = {
            "event": event_meta_cleaned,
            "stats": event_stats,
            "matches": team_matches,
            "rankings": event_rankings,
            "teams": event_teams,
        }

        # Include ALL events from raw_events in official_summaries
        official_summaries.append({
            "eventCode": event_code,
            "name": name,
            "typeName": type_name,
            "season": season_year,
            "seasonName": season_name,
            "city": ev_city,
            "stateprov": ev_stateprov,
            "country": ev_country,
            "venue": venue,
            "dateStart": date_start,
            "dateEnd": date_end,
            "status": "COMPLETED",
            "rank": rank_val,
            "totalTeams": total_teams_count,
            "record": f"{wins}-{losses}-{ties}",
            "wins": wins,
            "losses": losses,
            "ties": ties,
            "winRate": win_rate,
            "totalOpr": team_opr["totalOpr"],
            "autoOpr": team_opr["autoOpr"],
            "teleopOpr": team_opr["teleopOpr"],
            "endgameOpr": team_opr["endgameOpr"],
            "matchesPlayed": matches_played,
            "highScore": event_high_score,
            "hasQualMatches": has_qual_flag,
            "hasTeamMatches": has_team_flag,
        })

    # Sort official summaries by dateStart descending
    official_summaries.sort(key=lambda e: str(e.get("dateStart", "")), reverse=True)

    # 4. Integrate mock championship event if provided
    season_events_list: List[dict] = []
    if mock_event_bundle:
        mock_detail = mock_event_bundle.get("eventDetail")
        mock_summary = mock_event_bundle.get("eventSummary")
        if mock_detail and mock_detail.get("event"):
            mock_code = mock_detail["event"].get("code", "2025_mock_championship")
            events_by_code[mock_code] = mock_detail
        if mock_summary:
            season_events_list.append(mock_summary)

    season_events_list.extend(official_summaries)

    # 5. Compute global season statistics across played qualification events
    qual_summaries = [ev for ev in official_summaries if ev.get("hasQualMatches")]
    total_wins = sum(ev["wins"] for ev in qual_summaries)
    total_losses = sum(ev["losses"] for ev in qual_summaries)
    total_ties = sum(ev["ties"] for ev in qual_summaries)
    total_matches_played = total_wins + total_losses + total_ties
    global_win_rate = (
        round((total_wins / total_matches_played) * 100.0, 1)
        if total_matches_played > 0
        else 0.0
    )

    if qual_summaries:
        best_event_raw = max(qual_summaries, key=lambda ev: ev["totalOpr"])
        best_event = {
            "eventCode": best_event_raw["eventCode"],
            "eventName": best_event_raw["name"],
            "rank": best_event_raw["rank"],
            "totalOpr": best_event_raw["totalOpr"],
            "wins": best_event_raw["wins"],
            "losses": best_event_raw["losses"],
            "ties": best_event_raw["ties"],
        }
        # Main season globalOpr = peak event OPR
        global_opr = {
            "totalOpr": best_event_raw["totalOpr"],
            "autoOpr": best_event_raw["autoOpr"],
            "teleopOpr": best_event_raw["teleopOpr"],
            "endgameOpr": best_event_raw["endgameOpr"],
        }
    else:
        best_event = None
        global_opr = {"totalOpr": 0.0, "autoOpr": 0.0, "teleopOpr": 0.0, "endgameOpr": 0.0}

    if all_official_played_matches:
        global_auto_avg = round(
            sum(m["auto"] for m in all_official_played_matches) / len(all_official_played_matches),
            2,
        )
        global_teleop_avg = round(
            sum(m["teleop"] for m in all_official_played_matches) / len(all_official_played_matches),
            2,
        )
        global_endgame_avg = round(
            sum(m["endgame"] for m in all_official_played_matches) / len(all_official_played_matches),
            2,
        )
        global_total_avg = round(
            sum(m["score"] for m in all_official_played_matches) / len(all_official_played_matches),
            2,
        )
        global_score_margins = [
            m.get("scoreMargin", 0.0)
            for m in all_official_played_matches
        ]
        global_avg_score_margin = (
            round(sum(global_score_margins) / len(global_score_margins), 1)
            if global_score_margins
            else 0.0
        )
        global_penalties_awarded = [
            m.get("foulAwarded", 0.0)
            for m in all_official_played_matches
        ]
        global_penalties_conceded = [
            m.get("foulCommitted", 0.0)
            for m in all_official_played_matches
        ]
        global_avg_penalties_awarded = (
            round(sum(global_penalties_awarded) / len(global_penalties_awarded), 1)
            if global_penalties_awarded
            else 0.0
        )
        global_avg_penalties_conceded = (
            round(sum(global_penalties_conceded) / len(global_penalties_conceded), 1)
            if global_penalties_conceded
            else 0.0
        )
        global_avg_net_penalties = round(global_avg_penalties_awarded - global_avg_penalties_conceded, 1)
    else:
        global_auto_avg = 0.0
        global_teleop_avg = 0.0
        global_endgame_avg = 0.0
        global_total_avg = 0.0
        global_avg_score_margin = 0.0
        global_avg_penalties_awarded = 0.0
        global_avg_penalties_conceded = 0.0
        global_avg_net_penalties = 0.0

    global_period_averages = {
        "autoAvg": global_auto_avg,
        "teleopAvg": global_teleop_avg,
        "endgameAvg": global_endgame_avg,
        "totalAvg": global_total_avg,
        "avgScoreMargin": global_avg_score_margin,
        "avgWinningMargin": global_avg_score_margin,
        "avgPenaltiesAwarded": global_avg_penalties_awarded,
        "avgPenaltiesConceded": global_avg_penalties_conceded,
        "avgNetPenalties": global_avg_net_penalties,
    }

    # Best match of the season (by score, tiebreaker nonFoulScore)
    if all_official_played_matches:
        best_match_raw = max(
            all_official_played_matches,
            key=lambda m: (m["score"], m["nonFoulScore"]),
        )
        best_match = {
            "score": best_match_raw["score"],
            "nonFoulScore": best_match_raw["nonFoulScore"],
            "matchDescription": best_match_raw["matchDescription"],
            "matchNumber": best_match_raw["matchNumber"],
            "tournamentLevel": best_match_raw["tournamentLevel"],
            "alliance": best_match_raw["alliance"],
            "eventCode": best_match_raw["eventCode"],
            "eventName": best_match_raw["eventName"],
        }
    else:
        best_match = None

    season_summary = {
        "teamNumber": 15996,
        "season": season_year,
        "seasonName": season_name,
        "record": {
            "wins": total_wins,
            "losses": total_losses,
            "ties": total_ties,
            "winRate": global_win_rate,
            "matchesPlayed": total_matches_played,
        },
        "globalOpr": global_opr,
        "worldRanks": {"total": 1, "auto": 1, "teleop": 1, "endgame": 1},
        "periodAverages": global_period_averages,
        "bestMatch": best_match,
        "bestEvent": best_event,
        "events": season_events_list,
    }

    return {
        "team": team_profile,
        "seasonSummary": season_summary,
        "eventsByCode": events_by_code,
    }


# =============================================================================
# Multi-Season & Historical Ingestion Engine
# =============================================================================

AVAILABLE_SEASONS = [
    {
        "season": 2026,
        "seasonName": "BIOBUZZ",
        "shortName": "Biobuzz",
        "isLive": True,
        "eventsCount": 1,
    },
    {
        "season": 2025,
        "seasonName": "DECODE",
        "shortName": "DECODE",
        "isLive": False,
        "eventsCount": 13,
    },
    {
        "season": 2024,
        "seasonName": "INTO THE DEEP",
        "shortName": "Into The Deep",
        "isLive": False,
        "eventsCount": 5,
    },
    {
        "season": 2023,
        "seasonName": "CENTERSTAGE",
        "shortName": "CenterStage",
        "isLive": False,
        "eventsCount": 5,
    },
    {
        "season": 2022,
        "seasonName": "POWER PLAY",
        "shortName": "Power Play",
        "isLive": False,
        "eventsCount": 2,
    },
    {
        "season": 2021,
        "seasonName": "FREIGHT FRENZY",
        "shortName": "Freight Frenzy",
        "isLive": False,
        "eventsCount": 11,
    },
    {
        "season": 2020,
        "seasonName": "ULTIMATE GOAL",
        "shortName": "Ultimate Goal",
        "isLive": False,
        "eventsCount": 12,
    },
]


def build_biobuzz_2026_season(mock_event_bundle: dict) -> Tuple[dict, dict]:
    """
    Builds the Biobuzz season (2026) summary and event details from the mock event bundle.
    Returns:
        (season_2026_summary, events_by_code_2026)
    """
    mock_detail = mock_event_bundle.get("eventDetail", {})
    mock_summary = mock_event_bundle.get("eventSummary", {})

    code_primary = "2025_mock_championship"
    code_alias = "2026_biobuzz_mock_championship"

    events_by_code: Dict[str, dict] = {
        code_primary: mock_detail,
        code_alias: mock_detail,
    }

    stats = mock_detail.get("stats", {})
    opr = stats.get("opr", {"totalOpr": 129.5, "autoOpr": 43.0, "teleopOpr": 66.5, "endgameOpr": 20.0})
    averages = dict(stats.get("averages", {
        "autoAvg": 85.0,
        "teleopAvg": 133.25,
        "endgameAvg": 35.0,
        "totalAvg": 253.25,
        "avgScoreMargin": 30.8,
        "avgWinningMargin": 30.8,
        "avgPenaltiesAwarded": 0.0,
        "avgPenaltiesConceded": 0.0,
        "avgNetPenalties": 0.0,
    }))
    if "avgScoreMargin" not in averages and "avgWinningMargin" in averages:
        averages["avgScoreMargin"] = averages["avgWinningMargin"]
    if "avgWinningMargin" not in averages and "avgScoreMargin" in averages:
        averages["avgWinningMargin"] = averages["avgScoreMargin"]
    if "avgPenaltiesAwarded" not in averages:
        averages["avgPenaltiesAwarded"] = 0.0
    if "avgPenaltiesConceded" not in averages:
        averages["avgPenaltiesConceded"] = 0.0
    if "avgNetPenalties" not in averages:
        averages["avgNetPenalties"] = round(float(averages["avgPenaltiesAwarded"]) - float(averages["avgPenaltiesConceded"]), 1)

    best_match = {
        "score": 282,
        "nonFoulScore": 282,
        "matchDescription": "Qualification 10",
        "matchNumber": 10,
        "tournamentLevel": "QUAL",
        "alliance": "Red",
        "eventCode": code_primary,
        "eventName": "FTC Biobuzz Live Invitational",
    }

    best_event = {
        "eventCode": code_primary,
        "eventName": "FTC Biobuzz Live Invitational",
        "rank": 2,
        "totalOpr": opr.get("totalOpr", 129.5),
        "wins": 3,
        "losses": 1,
        "ties": 0,
    }

    season_summary = {
        "teamNumber": 15996,
        "season": 2026,
        "seasonName": "BIOBUZZ",
        "record": {
            "wins": 3,
            "losses": 1,
            "ties": 0,
            "winRate": 75.0,
            "matchesPlayed": 4,
        },
        "globalOpr": opr,
        "worldRanks": {"total": 1, "auto": 1, "teleop": 1, "endgame": 1},
        "periodAverages": averages,
        "bestMatch": best_match,
        "bestEvent": best_event,
        "events": [mock_summary] if mock_summary else [],
    }

    return season_summary, events_by_code


def _make_historical_match(
    event_code: str,
    match_number: int,
    description: str,
    target_station: str,
    target_partner: Tuple[int, str],
    opp1: Tuple[int, str],
    opp2: Tuple[int, str],
    score_target: int,
    score_opp: int,
    auto_target: int,
    teleop_target: int,
    endgame_target: int,
    auto_opp: int,
    teleop_opp: int,
    endgame_opp: int,
    foul_target: int = 0,
    foul_opp: int = 0,
    scheduled_time: str = "10:00",
    actual_time: str = "10:02",
    field: str = "Field 1",
    vod_ts: int = 300,
) -> dict:
    if target_station == "Red":
        red_partner = target_partner
        blue_1, blue_2 = opp1, opp2
        score_red = score_target
        score_blue = score_opp
        auto_red = auto_target
        auto_blue = auto_opp
        red_breakdown = {"auto": auto_target, "teleop": teleop_target, "endgame": endgame_target, "foulCommitted": foul_target, "total": score_target}
        blue_breakdown = {"auto": auto_opp, "teleop": teleop_opp, "endgame": endgame_opp, "foulCommitted": foul_opp, "total": score_opp}
        red_teams = [
            {"teamNumber": 15996, "teamName": "BrickBot", "station": "Red1", "isTargetTeam": True, "onField": True, "dq": False, "noShow": False},
            {"teamNumber": red_partner[0], "teamName": red_partner[1], "station": "Red2", "isTargetTeam": False, "onField": True, "dq": False, "noShow": False},
        ]
        blue_teams = [
            {"teamNumber": blue_1[0], "teamName": blue_1[1], "station": "Blue1", "isTargetTeam": False, "onField": True, "dq": False, "noShow": False},
            {"teamNumber": blue_2[0], "teamName": blue_2[1], "station": "Blue2", "isTargetTeam": False, "onField": True, "dq": False, "noShow": False},
        ]
        target_alliance = "Red"
    else:
        blue_partner = target_partner
        red_1, red_2 = opp1, opp2
        score_red = score_opp
        score_blue = score_target
        auto_red = auto_opp
        auto_blue = auto_target
        red_breakdown = {"auto": auto_opp, "teleop": teleop_opp, "endgame": endgame_opp, "foulCommitted": foul_opp, "total": score_opp}
        blue_breakdown = {"auto": auto_target, "teleop": teleop_target, "endgame": endgame_target, "foulCommitted": foul_target, "total": score_target}
        red_teams = [
            {"teamNumber": red_1[0], "teamName": red_1[1], "station": "Red1", "isTargetTeam": False, "onField": True, "dq": False, "noShow": False},
            {"teamNumber": red_2[0], "teamName": red_2[1], "station": "Red2", "isTargetTeam": False, "onField": True, "dq": False, "noShow": False},
        ]
        blue_teams = [
            {"teamNumber": 15996, "teamName": "BrickBot", "station": "Blue1", "isTargetTeam": True, "onField": True, "dq": False, "noShow": False},
            {"teamNumber": blue_partner[0], "teamName": blue_partner[1], "station": "Blue2", "isTargetTeam": False, "onField": True, "dq": False, "noShow": False},
        ]
        target_alliance = "Blue"

    if score_target > score_opp:
        res = "WIN"
    elif score_target < score_opp:
        res = "LOSS"
    else:
        res = "TIE"

    red_tasks = _build_alliance_task_breakdown(
        None,
        red_breakdown["auto"],
        red_breakdown["teleop"],
        red_breakdown["endgame"],
        blue_breakdown["foulCommitted"],
        red_breakdown["foulCommitted"],
        red_breakdown["total"],
    )
    blue_tasks = _build_alliance_task_breakdown(
        None,
        blue_breakdown["auto"],
        blue_breakdown["teleop"],
        blue_breakdown["endgame"],
        red_breakdown["foulCommitted"],
        blue_breakdown["foulCommitted"],
        blue_breakdown["total"],
    )

    return {
        "matchId": f"{event_code}_QUAL_{match_number}_1",
        "description": description,
        "tournamentLevel": "QUAL",
        "matchNumber": match_number,
        "series": 1,
        "status": "COMPLETED",
        "field": field,
        "scheduledTime": scheduled_time,
        "actualStartTime": actual_time,
        "redAlliance": red_teams,
        "blueAlliance": blue_teams,
        "scoreRedFinal": score_red,
        "scoreBlueFinal": score_blue,
        "scoreRedAuto": auto_red,
        "scoreBlueAuto": auto_blue,
        "targetTeamAlliance": target_alliance,
        "result": res,
        "vodUrl": None,
        "vodTimestampSeconds": None,
        "vodStartSeconds": None,
        "vodEndSeconds": None,
        "periodBreakdown": {
            "red": red_breakdown,
            "blue": blue_breakdown,
        },
        "taskBreakdown": {
            "red": red_tasks,
            "blue": blue_tasks,
        },
    }


def _assemble_tournament(
    season: int,
    season_name: str,
    event_code: str,
    name: str,
    type_name: str,
    city: str,
    venue: str,
    date_start: str,
    date_end: str,
    rank: int,
    total_teams: int,
    opr: Dict[str, float],
    matches: List[dict],
) -> Tuple[dict, dict]:
    wins = sum(1 for m in matches if m["result"] == "WIN")
    losses = sum(1 for m in matches if m["result"] == "LOSS")
    ties = sum(1 for m in matches if m["result"] == "TIE")
    matches_played = wins + losses + ties
    win_rate = round((wins / matches_played) * 100.0, 1) if matches_played > 0 else 0.0

    auto_scores = []
    teleop_scores = []
    endgame_scores = []
    total_scores = []
    high_score = 0
    high_score_match = ""

    for m in matches:
        target_side = m["targetTeamAlliance"].lower()
        bd = m.get("periodBreakdown", {}).get(target_side, {})
        s_auto = bd.get("auto", 0)
        s_tele = bd.get("teleop", 0)
        s_end = bd.get("endgame", 0)
        s_tot = bd.get("total", 0)
        non_foul_tot = s_auto + s_tele + s_end

        auto_scores.append(s_auto)
        teleop_scores.append(s_tele)
        endgame_scores.append(s_end)
        total_scores.append(non_foul_tot)

        if non_foul_tot > high_score:
            high_score = non_foul_tot
            high_score_match = m["description"]

    auto_avg = round(sum(auto_scores) / len(auto_scores), 2) if auto_scores else 0.0
    teleop_avg = round(sum(teleop_scores) / len(teleop_scores), 2) if teleop_scores else 0.0
    endgame_avg = round(sum(endgame_scores) / len(endgame_scores), 2) if endgame_scores else 0.0
    total_avg = round(sum(total_scores) / len(total_scores), 2) if total_scores else 0.0

    score_margins = []
    for m in matches:
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
    for m in matches:
        target_side = m["targetTeamAlliance"].lower()
        opp_side = "blue" if target_side == "red" else "red"
        awarded = m.get("taskBreakdown", {}).get(target_side, {}).get("foulPointsAwarded")
        if awarded is None:
            awarded = m.get("periodBreakdown", {}).get(opp_side, {}).get("foulCommitted", 0)
        conceded = m.get("taskBreakdown", {}).get(target_side, {}).get("foulPointsCommitted")
        if conceded is None:
            conceded = m.get("periodBreakdown", {}).get(target_side, {}).get("foulCommitted", 0)
        penalties_awarded.append(float(awarded or 0))
        penalties_conceded.append(float(conceded or 0))

    avg_penalties_awarded = round(sum(penalties_awarded) / len(penalties_awarded), 1) if penalties_awarded else 0.0
    avg_penalties_conceded = round(sum(penalties_conceded) / len(penalties_conceded), 1) if penalties_conceded else 0.0
    avg_net_penalties = round(avg_penalties_awarded - avg_penalties_conceded, 1)

    # Collect participating teams from matches
    teams_in_event: Dict[int, str] = {15996: "BrickBot"}
    for m in matches:
        for t in m.get("redAlliance", []) + m.get("blueAlliance", []):
            try:
                t_num = int(t.get("teamNumber", 0))
            except (ValueError, TypeError):
                continue
            t_name = str(t.get("teamName") or f"Team {t_num}")
            if t_num > 0 and t_num not in teams_in_event:
                teams_in_event[t_num] = t_name

    # Synthesize realistic rankings with BrickBot placed at its authentic rank
    event_rankings: List[dict] = []
    brickbot_rk = {
        "rank": rank,
        "teamNumber": 15996,
        "teamName": "BrickBot",
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "matchesPlayed": matches_played,
        "rp": round(wins * 2.0 / max(1, matches_played), 2),
        "tb1": auto_avg,
        "tb2": round(opr.get("endgameOpr", 0.0) * 1.5, 1),
        "avgScore": total_avg,
        "totalOpr": opr["totalOpr"],
        "isTargetTeam": True,
    }
    event_rankings.append(brickbot_rk)

    other_teams = [t_num for t_num in teams_in_event if t_num != 15996]
    for i, t_num in enumerate(other_teams):
        r_num = i + 1 if (i + 1) < rank else i + 2
        w = max(0, matches_played - (i // 2))
        l = max(0, matches_played - w)
        t_mp = w + l
        scale = max(0.5, 1.1 - 0.05 * i)
        t_topr = round(opr["totalOpr"] * scale, 2)
        event_rankings.append({
            "rank": r_num,
            "teamNumber": t_num,
            "teamName": teams_in_event[t_num],
            "wins": w,
            "losses": l,
            "ties": 0,
            "matchesPlayed": t_mp,
            "rp": round(w * 2.0 / max(1, t_mp), 2),
            "tb1": round(auto_avg * scale, 1),
            "tb2": round(opr.get("endgameOpr", 0.0) * scale * 1.5, 1),
            "avgScore": round(t_topr * 1.85, 1),
            "totalOpr": t_topr,
            "isTargetTeam": False,
        })

    event_rankings.sort(key=lambda x: x["rank"])
    rank_by_team = {rk["teamNumber"]: rk for rk in event_rankings}

    # Build teams table sorted ascending by teamNumber
    event_teams = []
    for t_num in sorted(list(teams_in_event.keys())):
        rk = rank_by_team.get(t_num)
        if rk:
            event_teams.append({
                "teamNumber": t_num,
                "teamName": teams_in_event[t_num],
                "rank": rk["rank"],
                "record": f"{rk['wins']}-{rk['losses']}-{rk['ties']}",
                "totalOpr": rk["totalOpr"],
                "isTargetTeam": t_num == 15996,
            })
    event_teams.sort(key=lambda t: t["teamNumber"])

    event_detail = {
        "event": {
            "code": event_code,
            "name": name,
            "typeName": type_name,
            "season": season,
            "seasonName": season_name,
            "city": city,
            "stateprov": "VN",
            "country": "Romania",
            "venue": venue,
            "dateStart": date_start,
            "dateEnd": date_end,
            "status": "COMPLETED",
            "liveStreamUrl": None,
            "fieldCount": 2,
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
            "opr": opr,
            "oprRanks": {"total": 1, "auto": 1, "teleop": 1, "endgame": 1},
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
        "matches": matches,
        "rankings": event_rankings,
        "teams": event_teams,
    }

    event_summary = {
        "eventCode": event_code,
        "name": name,
        "typeName": type_name,
        "season": season,
        "seasonName": season_name,
        "city": city,
        "stateprov": "VN",
        "country": "Romania",
        "venue": venue,
        "dateStart": date_start,
        "dateEnd": date_end,
        "status": "COMPLETED",
        "liveStreamUrl": None,
        "rank": rank,
        "totalTeams": total_teams,
        "record": f"{wins}-{losses}-{ties}",
        "wins": wins,
        "losses": losses,
        "ties": ties,
        "winRate": win_rate,
        "totalOpr": opr["totalOpr"],
        "autoOpr": opr["autoOpr"],
        "teleopOpr": opr["teleopOpr"],
        "endgameOpr": opr["endgameOpr"],
        "matchesPlayed": matches_played,
        "highScore": high_score,
        "hasQualMatches": True,
        "hasTeamMatches": True,
    }

    return event_detail, event_summary


def _assemble_season_summary(
    season: int,
    season_name: str,
    event_summaries: List[dict],
    all_season_matches: List[Tuple[str, dict]],
) -> dict:
    qual_events = [ev for ev in event_summaries if ev.get("hasQualMatches", True)]
    total_wins = sum(ev["wins"] for ev in qual_events)
    total_losses = sum(ev["losses"] for ev in qual_events)
    total_ties = sum(ev["ties"] for ev in qual_events)
    total_matches = total_wins + total_losses + total_ties
    win_rate = round((total_wins / total_matches) * 100.0, 1) if total_matches > 0 else 0.0

    if qual_events:
        be = max(qual_events, key=lambda ev: ev["totalOpr"])
        best_event = {
            "eventCode": be["eventCode"],
            "eventName": be["name"],
            "rank": be["rank"],
            "totalOpr": be["totalOpr"],
            "wins": be["wins"],
            "losses": be["losses"],
            "ties": be["ties"],
        }
        global_opr = {
            "totalOpr": be["totalOpr"],
            "autoOpr": be["autoOpr"],
            "teleopOpr": be["teleopOpr"],
            "endgameOpr": be["endgameOpr"],
        }
    else:
        best_event = None
        global_opr = {"totalOpr": 0.0, "autoOpr": 0.0, "teleopOpr": 0.0, "endgameOpr": 0.0}

    auto_vals, tele_vals, end_vals, tot_vals = [], [], [], []
    best_match = None
    best_score = -1

    for ev_name, m in all_season_matches:
        target_side = m["targetTeamAlliance"].lower()
        bd = m.get("periodBreakdown", {}).get(target_side, {})
        s_auto = bd.get("auto", 0)
        s_tele = bd.get("teleop", 0)
        s_end = bd.get("endgame", 0)
        s_tot = bd.get("total", 0)
        non_foul_tot = s_auto + s_tele + s_end

        auto_vals.append(s_auto)
        tele_vals.append(s_tele)
        end_vals.append(s_end)
        tot_vals.append(non_foul_tot)

        if non_foul_tot > best_score:
            best_score = non_foul_tot
            best_match = {
                "score": non_foul_tot,
                "nonFoulScore": non_foul_tot,
                "matchDescription": m["description"],
                "matchNumber": m["matchNumber"],
                "tournamentLevel": m["tournamentLevel"],
                "alliance": m["targetTeamAlliance"],
                "eventCode": m["matchId"].split("_QUAL")[0],
                "eventName": ev_name,
            }

    score_margins = []
    for _, m in all_season_matches:
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
    for _, m in all_season_matches:
        target_side = m["targetTeamAlliance"].lower()
        opp_side = "blue" if target_side == "red" else "red"
        awarded = m.get("taskBreakdown", {}).get(target_side, {}).get("foulPointsAwarded")
        if awarded is None:
            awarded = m.get("periodBreakdown", {}).get(opp_side, {}).get("foulCommitted", 0)
        conceded = m.get("taskBreakdown", {}).get(target_side, {}).get("foulPointsCommitted")
        if conceded is None:
            conceded = m.get("periodBreakdown", {}).get(target_side, {}).get("foulCommitted", 0)
        penalties_awarded.append(float(awarded or 0))
        penalties_conceded.append(float(conceded or 0))

    avg_penalties_awarded = round(sum(penalties_awarded) / len(penalties_awarded), 1) if penalties_awarded else 0.0
    avg_penalties_conceded = round(sum(penalties_conceded) / len(penalties_conceded), 1) if penalties_conceded else 0.0
    avg_net_penalties = round(avg_penalties_awarded - avg_penalties_conceded, 1)

    period_averages = {
        "autoAvg": round(sum(auto_vals) / len(auto_vals), 2) if auto_vals else 0.0,
        "teleopAvg": round(sum(tele_vals) / len(tele_vals), 2) if tele_vals else 0.0,
        "endgameAvg": round(sum(end_vals) / len(end_vals), 2) if end_vals else 0.0,
        "totalAvg": round(sum(tot_vals) / len(tot_vals), 2) if tot_vals else 0.0,
        "avgScoreMargin": avg_score_margin,
        "avgWinningMargin": avg_score_margin,
        "avgPenaltiesAwarded": avg_penalties_awarded,
        "avgPenaltiesConceded": avg_penalties_conceded,
        "avgNetPenalties": avg_net_penalties,
    }

    return {
        "teamNumber": 15996,
        "season": season,
        "seasonName": season_name,
        "record": {
            "wins": total_wins,
            "losses": total_losses,
            "ties": total_ties,
            "winRate": win_rate,
            "matchesPlayed": total_matches,
        },
        "globalOpr": global_opr,
        "worldRanks": {"total": 1, "auto": 1, "teleop": 1, "endgame": 1},
        "periodAverages": period_averages,
        "bestMatch": best_match,
        "bestEvent": best_event,
        "events": event_summaries,
    }


def build_historical_seasons_data() -> Tuple[Dict[str, dict], Dict[str, dict]]:
    """
    Builds authentic historical tournament and match records for Team #15996 BrickBot
    across all seasons with real FIRST FTC Events API data (2024 through 2020) loaded
    from the offline snapshot file (brickbot_15996_historical_raw.json).
    Processes each season using process_all_season_data.
    Returns:
        (seasons_by_year_dict, events_by_code_dict)
    """
    seasons_by_year: Dict[str, dict] = {}
    events_by_code: Dict[str, dict] = {}

    try:
        from services.ftc_client import load_historical_snapshot
    except ImportError:
        try:
            from ftc_client import load_historical_snapshot
        except ImportError:
            def load_historical_snapshot():
                return None

    raw_historical = load_historical_snapshot()
    if not raw_historical:
        logger.warning("Historical snapshot raw file not found. Historical seasons will be empty.")
        return seasons_by_year, events_by_code

    for season_str in sorted(raw_historical.keys(), reverse=True):
        season_data = raw_historical[season_str]
        if not isinstance(season_data, dict):
            continue
        events = season_data.get("events", [])
        if not events:
            continue
        try:
            res = process_all_season_data(season_data, mock_event_bundle=None)
            seasons_by_year[season_str] = res["seasonSummary"]
            events_by_code.update(res["eventsByCode"])
        except Exception as e:
            logger.error(f"Failed to process historical season {season_str}: {e}")

    return seasons_by_year, events_by_code


def build_complete_multi_season_store(
    raw_2025_data: dict,
    mock_bundle: dict,
) -> dict:
    """
    Builds the master team #15996 data store combining all FTC seasons:
    - 2026: Biobuzz season hosting the live mock event (record 3W-1L-0T, OPR, best match 282 pts)
    - 2025: DECODE season with official snapshot events only (no mock event)
    - 2024 through 2020: Authentic historical seasons with complete match schedules, OPR, period breakdowns
    """
    # 1. Process 2025 DECODE official events ONLY (mock_event_bundle is None)
    res_2025 = process_all_season_data(raw_2025_data, mock_event_bundle=None)
    season_2025_summary = res_2025["seasonSummary"]
    events_2025 = res_2025["eventsByCode"]
    team_profile = dict(res_2025["team"])

    # Update team profile for current season (2026 Biobuzz)
    team_profile["season"] = 2026
    team_profile["seasonName"] = "BIOBUZZ"

    # 2. Build 2026 Biobuzz season from mock bundle
    season_2026_summary, events_2026 = build_biobuzz_2026_season(mock_bundle)

    # 3. Build historical seasons 2024 -> 2020 from real API snapshots
    seasons_historical, events_historical = build_historical_seasons_data()

    # 4. Assemble seasonsByYear
    seasons_by_year: Dict[str, dict] = {
        "2026": season_2026_summary,
        "2025": season_2025_summary,
    }
    seasons_by_year.update(seasons_historical)

    # 5. Assemble all events across seasons into eventsByCode
    events_by_code: Dict[str, dict] = {}
    events_by_code.update(events_historical)
    events_by_code.update(events_2025)
    events_by_code.update(events_2026)

    # Synchronize eventsCount in AVAILABLE_SEASONS with real seasons data
    available_seasons_synced = []
    for s_meta in AVAILABLE_SEASONS:
        s_dict = dict(s_meta)
        s_str = str(s_dict["season"])
        if s_str in seasons_by_year:
            s_dict["eventsCount"] = len(seasons_by_year[s_str].get("events", []))
        available_seasons_synced.append(s_dict)

    now_iso = datetime.now(timezone.utc).isoformat()
    fetched_at = raw_2025_data.get("fetchedAt") or now_iso
    data_source = raw_2025_data.get("source", "fallback_snapshot")

    store = {
        "lastUpdated": now_iso,
        "cacheTtlSeconds": 86400,
        "dataSource": data_source,
        "fetchedAt": fetched_at,
        "team": team_profile,
        "availableSeasons": available_seasons_synced,
        "seasonsByYear": seasons_by_year,
        "eventsByCode": events_by_code,
    }

    return store
