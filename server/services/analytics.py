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
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

try:
    import numpy as np
except ImportError:
    np = None


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

    Args:
        matches: list of match dicts from FIRST FTC API or simulated schedule.
        qual_scores: list of score breakdown dicts for qualification matches.

    Returns:
        dict: { team_num: { "totalOpr": float, "autoOpr": float, "teleopOpr": float, "endgameOpr": float } }
    """
    # 1. Filter matches to qualification matches where scores are recorded
    valid_matches = []
    for m in matches:
        if not isinstance(m, dict):
            continue
        level = str(m.get("tournamentLevel", "")).upper()
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
    b_total: List[float] = []
    b_auto: List[float] = []
    b_teleop: List[float] = []
    b_endgame: List[float] = []

    for m in valid_matches:
        try:
            m_num = int(m.get("matchNumber", 0))
        except (ValueError, TypeError):
            m_num = 0

        # Separate teams by alliance
        red_team_nums = []
        blue_team_nums = []
        for t in m.get("teams", []):
            try:
                num = int(t.get("teamNumber", 0))
                station = str(t.get("station", "")).upper()
                alliance = str(t.get("alliance", "")).upper()
                if "RED" in station or alliance == "RED":
                    red_team_nums.append(num)
                elif "BLUE" in station or alliance == "BLUE":
                    blue_team_nums.append(num)
            except (ValueError, TypeError):
                continue

        # Extract scores for Red and Blue
        for color, alliance_teams in [("Red", red_team_nums), ("Blue", blue_team_nums)]:
            if not alliance_teams:
                continue

            bd = scores_by_match.get(m_num, {}).get(color)
            if bd:
                auto_pts = float(bd.get("autoPoints", 0) or 0)
                endgame_pts = float(bd.get("teleopBasePoints", 0) or 0)
                teleop_driver_pts = float(bd.get("teleopPoints", 0) or 0) - endgame_pts
                non_foul_total = auto_pts + float(bd.get("teleopPoints", 0) or 0)
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

            # Build participation row
            row = [0.0] * num_teams
            for t_num in alliance_teams:
                if t_num in team_to_col:
                    row[team_to_col[t_num]] = 1.0

            A_rows.append(row)
            b_total.append(non_foul_total)
            b_auto.append(auto_pts)
            b_teleop.append(teleop_driver_pts)
            b_endgame.append(endgame_pts)

    if not A_rows:
        return {}

    # Solve Ridge regressions: (A^T A + lambda * I) X = A^T B
    X_total = _solve_ridge_regression(A_rows, b_total, lambda_reg=1e-4)
    X_auto = _solve_ridge_regression(A_rows, b_auto, lambda_reg=1e-4)
    X_teleop = _solve_ridge_regression(A_rows, b_teleop, lambda_reg=1e-4)
    X_endgame = _solve_ridge_regression(A_rows, b_endgame, lambda_reg=1e-4)

    opr_results: Dict[int, Dict[str, float]] = {}
    for idx, num in enumerate(team_list):
        opr_results[num] = {
            "totalOpr": round(float(X_total[idx]), 2),
            "autoOpr": round(float(X_auto[idx]), 2),
            "teleopOpr": round(float(X_teleop[idx]), 2),
            "endgameOpr": round(float(X_endgame[idx]), 2),
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
        "season": 2025,
        "seasonName": "DECODE (2025-2026)",
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
            or "https://www.youtube.com/watch?v=H920hSVJw7E"
        )
        try:
            field_count = max(1, int(meta.get("fieldCount") or 2))
        except (ValueError, TypeError):
            field_count = 2

        # Compute OPR for this event
        event_opr = compute_event_opr(matches, scores)

        # Build scores lookup for this event
        scores_by_match: Dict[int, Dict[str, dict]] = {}
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

        # Filter matches where team 15996 participated
        team_matches: List[dict] = []
        match_idx = 0

        # Sort matches by matchNumber if present
        def _match_sort_key(m_dict: dict) -> int:
            try:
                return int(m_dict.get("matchNumber") or 0)
            except (ValueError, TypeError):
                return 0

        sorted_matches = sorted(matches, key=_match_sort_key) if isinstance(matches, list) else []

        for m in sorted_matches:
            if not isinstance(m, dict):
                continue

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

            # Period breakdown calculation
            red_bd = scores_by_match.get(match_num, {}).get("Red")
            blue_bd = scores_by_match.get(match_num, {}).get("Blue")

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
            elif score_red is not None and score_blue is not None:
                r_auto = int(m.get("scoreRedAuto", 0) or 0)
                r_foul = int(m.get("scoreRedFoul", 0) or 0)
                b_foul = int(m.get("scoreBlueFoul", 0) or 0)
                r_tot = int(score_red)
                r_non_foul = max(0, r_tot - b_foul)
                r_tele = max(0, r_non_foul - r_auto)

                b_auto = int(m.get("scoreBlueAuto", 0) or 0)
                b_tot = int(score_blue)
                b_non_foul = max(0, b_tot - r_foul)
                b_tele = max(0, b_non_foul - b_auto)

                period_breakdown = {
                    "red": {"auto": r_auto, "teleop": r_tele, "endgame": 0, "foulCommitted": r_foul, "total": r_tot},
                    "blue": {"auto": b_auto, "teleop": b_tele, "endgame": 0, "foulCommitted": b_foul, "total": b_tot},
                }
            else:
                period_breakdown = None

            vod_url = (
                m.get("videoURL")
                or live_stream_url
                or "https://www.youtube.com/watch?v=H920hSVJw7E"
            )
            vod_timestamp = (
                int(m["vodTimestampSeconds"])
                if m.get("vodTimestampSeconds") is not None
                else int(300 + match_idx * 420)
            )

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
                "redAlliance": [
                    {
                        "teamNumber": int(t["teamNumber"]),
                        "teamName": team_names.get(int(t["teamNumber"]), f"Team {t['teamNumber']}"),
                        "station": t.get("station", "Red"),
                        "isTargetTeam": int(t["teamNumber"]) == 15996,
                    }
                    for t in red_teams
                ],
                "blueAlliance": [
                    {
                        "teamNumber": int(t["teamNumber"]),
                        "teamName": team_names.get(int(t["teamNumber"]), f"Team {t['teamNumber']}"),
                        "station": t.get("station", "Blue"),
                        "isTargetTeam": int(t["teamNumber"]) == 15996,
                    }
                    for t in blue_teams
                ],
                "scoreRedFinal": score_red,
                "scoreBlueFinal": score_blue,
                "scoreRedAuto": m.get("scoreRedAuto"),
                "scoreBlueAuto": m.get("scoreBlueAuto"),
                "targetTeamAlliance": target_alliance,
                "result": result,
                "vodUrl": vod_url,
                "vodTimestampSeconds": vod_timestamp,
                "periodBreakdown": period_breakdown,
            }
            team_matches.append(norm_match)
            match_idx += 1

        # Calculate statistics for team 15996 at this event
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
            wins = sum(1 for m in team_matches if m["result"] == "WIN")
            losses = sum(1 for m in team_matches if m["result"] == "LOSS")
            ties = sum(1 for m in team_matches if m["result"] == "TIE")

        matches_played = wins + losses + ties
        win_rate = round((wins / matches_played) * 100.0, 1) if matches_played > 0 else 0.0

        team_opr = event_opr.get(
            15996,
            {"totalOpr": 0.0, "autoOpr": 0.0, "teleopOpr": 0.0, "endgameOpr": 0.0},
        )

        # Compute period score averages and high score for completed matches
        completed_matches = [m for m in team_matches if m["result"] in ("WIN", "LOSS", "TIE")]
        auto_scores: List[float] = []
        teleop_scores: List[float] = []
        endgame_scores: List[float] = []
        total_scores: List[float] = []
        event_high_score = 0
        event_high_score_match = ""

        for cm in completed_matches:
            target_col = cm["targetTeamAlliance"]
            bd = cm.get("periodBreakdown")
            if target_col == "Red":
                s_tot = cm.get("scoreRedFinal") or 0
                if bd and "red" in bd:
                    s_auto = bd["red"]["auto"]
                    s_tele = bd["red"]["teleop"]
                    s_end = bd["red"]["endgame"]
                else:
                    s_auto = cm.get("scoreRedAuto") or 0
                    s_tele = max(0, s_tot - s_auto)
                    s_end = 0
            else:
                s_tot = cm.get("scoreBlueFinal") or 0
                if bd and "blue" in bd:
                    s_auto = bd["blue"]["auto"]
                    s_tele = bd["blue"]["teleop"]
                    s_end = bd["blue"]["endgame"]
                else:
                    s_auto = cm.get("scoreBlueAuto") or 0
                    s_tele = max(0, s_tot - s_auto)
                    s_end = 0

            auto_scores.append(float(s_auto))
            teleop_scores.append(float(s_tele))
            endgame_scores.append(float(s_end))
            total_scores.append(float(s_tot))

            if int(s_tot) > event_high_score:
                event_high_score = int(s_tot)
                event_high_score_match = str(cm.get("description", ""))

            # Save to global completed matches pool for season best calculation
            opp_foul = (
                (cm.get("scoreBlueFoul") or 0) if target_col == "Red"
                else (cm.get("scoreRedFoul") or 0)
            )
            all_official_played_matches.append({
                "score": int(s_tot),
                "nonFoulScore": max(0, int(s_tot) - int(opp_foul)),
                "matchDescription": str(cm.get("description", "")),
                "matchNumber": int(cm.get("matchNumber", 0)),
                "tournamentLevel": str(cm.get("tournamentLevel", "QUAL")),
                "alliance": str(target_col),
                "eventCode": event_code,
                "eventName": name,
                "auto": float(s_auto),
                "teleop": float(s_tele),
                "endgame": float(s_end),
            })

        auto_avg = round(sum(auto_scores) / len(auto_scores), 2) if auto_scores else 0.0
        teleop_avg = round(sum(teleop_scores) / len(teleop_scores), 2) if teleop_scores else 0.0
        endgame_avg = round(sum(endgame_scores) / len(endgame_scores), 2) if endgame_scores else 0.0
        total_avg = round(sum(total_scores) / len(total_scores), 2) if total_scores else 0.0

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
            "averages": {
                "autoAvg": auto_avg,
                "teleopAvg": teleop_avg,
                "endgameAvg": endgame_avg,
                "totalAvg": total_avg,
            },
            "highScore": event_high_score,
            "highScoreMatch": event_high_score_match,
        }

        event_meta_cleaned = {
            "code": event_code,
            "name": name,
            "typeName": type_name,
            "city": ev_city,
            "stateprov": ev_stateprov,
            "country": ev_country,
            "venue": venue,
            "dateStart": date_start,
            "dateEnd": date_end,
            "status": "COMPLETED",
            "liveStreamUrl": live_stream_url,
            "fieldCount": field_count,
        }

        # Save event detail in eventsByCode dictionary
        events_by_code[event_code] = {
            "event": event_meta_cleaned,
            "stats": event_stats,
            "matches": team_matches,
        }

        # Only add to seasonSummary events list if matches were played (filters umbrella shells)
        if matches_played > 0:
            official_summaries.append({
                "eventCode": event_code,
                "name": name,
                "typeName": type_name,
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

    # 5. Compute global season statistics across played official events
    total_wins = sum(ev["wins"] for ev in official_summaries)
    total_losses = sum(ev["losses"] for ev in official_summaries)
    total_ties = sum(ev["ties"] for ev in official_summaries)
    total_matches_played = total_wins + total_losses + total_ties
    global_win_rate = (
        round((total_wins / total_matches_played) * 100.0, 1)
        if total_matches_played > 0
        else 0.0
    )

    if official_summaries:
        global_opr = {
            "totalOpr": round(sum(ev["totalOpr"] for ev in official_summaries) / len(official_summaries), 2),
            "autoOpr": round(sum(ev["autoOpr"] for ev in official_summaries) / len(official_summaries), 2),
            "teleopOpr": round(sum(ev["teleopOpr"] for ev in official_summaries) / len(official_summaries), 2),
            "endgameOpr": round(sum(ev["endgameOpr"] for ev in official_summaries) / len(official_summaries), 2),
        }
    else:
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
    else:
        global_auto_avg = 0.0
        global_teleop_avg = 0.0
        global_endgame_avg = 0.0
        global_total_avg = 0.0

    global_period_averages = {
        "autoAvg": global_auto_avg,
        "teleopAvg": global_teleop_avg,
        "endgameAvg": global_endgame_avg,
        "totalAvg": global_total_avg,
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

    # Best event performance of the season (by total OPR)
    if official_summaries:
        best_event_raw = max(official_summaries, key=lambda ev: ev["totalOpr"])
        best_event = {
            "eventCode": best_event_raw["eventCode"],
            "eventName": best_event_raw["name"],
            "rank": best_event_raw["rank"],
            "totalOpr": best_event_raw["totalOpr"],
            "wins": best_event_raw["wins"],
            "losses": best_event_raw["losses"],
            "ties": best_event_raw["ties"],
        }
    else:
        best_event = None

    season_summary = {
        "teamNumber": 15996,
        "season": 2025,
        "seasonName": "DECODE (2025-2026)",
        "record": {
            "wins": total_wins,
            "losses": total_losses,
            "ties": total_ties,
            "winRate": global_win_rate,
            "matchesPlayed": total_matches_played,
        },
        "globalOpr": global_opr,
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
