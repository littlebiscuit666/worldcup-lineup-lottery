import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path


PROJECT_DIR = Path(__file__).resolve().parents[1]
WORKSPACE_DIR = PROJECT_DIR.parent
SOURCE_CSV = WORKSPACE_DIR / "世界杯" / "worldcup_players_fc26_public_ratings.csv"
OUTPUT_JS = PROJECT_DIR / "data" / "players.js"


def parse_number(value):
    if value is None or value == "":
        return None
    try:
        number = float(value)
    except ValueError:
        return None
    if math.isnan(number):
        return None
    return number


def parse_int(value):
    number = parse_number(value)
    if number is None:
        return None
    return int(round(number))


def estimate_overall(market_value_eur):
    if not market_value_eur or market_value_eur <= 0:
        return 60
    raw = 28.85 + 6.88 * math.log10(market_value_eur)
    return int(max(55, min(84, round(raw))))


def player_record(row):
    market_value_eur = parse_int(row.get("market_value_eur")) or 0
    fc26_overall = parse_int(row.get("fc26_overall"))
    overall = fc26_overall if fc26_overall is not None else estimate_overall(market_value_eur)

    return {
        "id": str(row.get("player_id", "")).strip(),
        "teamId": str(row.get("team_id", "")).strip(),
        "team": row.get("team", "").strip(),
        "name": row.get("player", "").strip(),
        "jerseyNumber": parse_int(row.get("jersey_number")),
        "positionGroup": row.get("position_group", "").strip(),
        "position": row.get("position", "").strip(),
        "age": parse_int(row.get("age")),
        "club": row.get("club", "").strip(),
        "foot": row.get("foot", "").strip(),
        "caps": parse_int(row.get("caps")),
        "goals": parse_int(row.get("goals")),
        "marketValueEur": market_value_eur,
        "marketValueText": row.get("market_value_text", "").strip(),
        "fc26Overall": fc26_overall,
        "overall": overall,
        "overallSource": "fc26" if fc26_overall is not None else "estimated",
        "fc26Positions": row.get("fc26_positions", "").strip(),
        "pace": parse_int(row.get("fc26_pace")),
        "shooting": parse_int(row.get("fc26_shooting")),
        "passing": parse_int(row.get("fc26_passing")),
        "dribbling": parse_int(row.get("fc26_dribbling")),
        "defending": parse_int(row.get("fc26_defending")),
        "physicality": parse_int(row.get("fc26_physicality")),
        "playerUrl": row.get("player_url", "").strip(),
        "ratingUrl": row.get("fc26_detail_source_url", "").strip(),
    }


def main():
    if not SOURCE_CSV.exists():
        raise FileNotFoundError(f"Missing source CSV: {SOURCE_CSV}")

    with SOURCE_CSV.open("r", encoding="utf-8-sig", newline="") as csv_file:
        players = [player_record(row) for row in csv.DictReader(csv_file)]

    players.sort(key=lambda item: (item["team"], item["positionGroup"], item["name"]))
    metadata = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "sourceCsv": str(SOURCE_CSV),
        "playerCount": len(players),
        "fc26RatingCount": sum(1 for player in players if player["overallSource"] == "fc26"),
        "estimatedRatingCount": sum(1 for player in players if player["overallSource"] == "estimated"),
        "estimateFormula": "clamp(round(28.85 + 6.88 * log10(market_value_eur)), 55, 84)",
    }

    OUTPUT_JS.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "metadata": metadata,
        "players": players,
    }
    OUTPUT_JS.write_text(
        "window.WORLD_CUP_DATA = "
        + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
        + ";\n",
        encoding="utf-8",
    )
    print(f"Wrote {OUTPUT_JS} with {len(players)} players")


if __name__ == "__main__":
    main()
