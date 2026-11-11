import json
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Flask, jsonify, render_template, request

from config import SECTIONS, SITE, Config


def _extract_speed(avatar: dict) -> float:
    if not isinstance(avatar, dict):
        return 0.0

    direct = avatar.get("speed")
    try:
        if direct is not None:
            val = float(direct)
            if val > 0:
                return val
    except (TypeError, ValueError):
        pass

    stat_lists = [
        avatar.get("stats"),
        avatar.get("properties"),
        avatar.get("fightProperties"),
    ]
    for stats in stat_lists:
        if isinstance(stats, dict):
            for key in ("speed", "spd", "SpeedDelta"):
                value = stats.get(key)
                try:
                    if value is not None:
                        val = float(value)
                        if val > 0:
                            return val
                except (TypeError, ValueError):
                    continue
        if isinstance(stats, list):
            for item in stats:
                if not isinstance(item, dict):
                    continue
                name = str(item.get("name") or item.get("type") or item.get("key") or "").lower()
                if "speed" not in name and "spd" not in name:
                    continue
                value = item.get("value")
                try:
                    val = float(value)
                    if val > 0:
                        return val
                except (TypeError, ValueError):
                    continue
    return 0.0


def summarize_enka_hsr(payload: dict) -> dict:
    if not isinstance(payload, dict):
        return {"character_count": 0, "character_names": [], "characters": []}

    detail_info = payload.get("detailInfo") if isinstance(payload.get("detailInfo"), dict) else {}
    candidates = [
        payload.get("avatarDetailList"),
        detail_info.get("avatarDetailList"),
        payload.get("characters"),
    ]
    avatars = next((c for c in candidates if isinstance(c, list)), [])

    names = []
    characters = []
    for avatar in avatars:
        if not isinstance(avatar, dict):
            continue
        name = avatar.get("name") or avatar.get("avatarName") or ""
        if not isinstance(name, str) or not name.strip():
            continue
        clean = name.strip()
        names.append(clean)
        characters.append({"name": clean, "spd": _extract_speed(avatar)})

    return {
        "character_count": len(avatars),
        "character_names": names,
        "characters": characters,
    }


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    enka_cache = {}
    rate_limiter = {"last": 0.0}

    # Character presets live in data/characters.json so you can edit them
    # without touching code. Speeds change between patches, so verify them.
    data_file = Path(app.root_path) / "data" / "characters.json"

    @app.route("/")
    def index():
        return render_template("index.html", site=SITE, sections=SECTIONS)

    @app.get("/api/characters")
    def characters():
        return jsonify(json.loads(data_file.read_text(encoding="utf-8")))

    @app.get("/api/enka/uid/<uid>")
    def enka_uid(uid: str):
        if not uid.isdigit() or len(uid) != 9:
            return jsonify(ok=False, error="UID must be a 9-digit number."), 400

        now = time.time()
        cached = enka_cache.get(uid)
        if cached and (now - cached["at"]) <= app.config["ENKA_CACHE_TTL_SECONDS"]:
            return jsonify(
                ok=True,
                source="cache",
                uid=uid,
                data=cached["data"],
                summary=summarize_enka_hsr(cached["data"]),
            )

        min_interval = app.config["ENKA_MIN_SECONDS_BETWEEN_REQUESTS"]
        elapsed = now - rate_limiter["last"]
        if elapsed < min_interval:
            retry_after = round(min_interval - elapsed, 2)
            return jsonify(ok=False, error="Rate limit active.", retry_after=retry_after), 429

        rate_limiter["last"] = now
        url = f"https://enka.network/api/hsr/uid/{uid}"
        req = Request(
            url,
            headers={
                "User-Agent": app.config["ENKA_USER_AGENT"],
                "Accept": "application/json",
            },
        )

        try:
            with urlopen(req, timeout=10) as res:
                payload = json.loads(res.read().decode("utf-8"))
        except HTTPError as err:
            if err.code == 404:
                return jsonify(ok=False, error="UID not found on Enka.Network."), 404
            return jsonify(ok=False, error=f"Enka request failed ({err.code})."), 502
        except URLError:
            return jsonify(ok=False, error="Could not reach Enka.Network."), 502
        except json.JSONDecodeError:
            return jsonify(ok=False, error="Invalid JSON from Enka.Network."), 502

        enka_cache[uid] = {"at": time.time(), "data": payload}
        return jsonify(
            ok=True,
            source="network",
            uid=uid,
            data=payload,
            summary=summarize_enka_hsr(payload),
        )

    @app.errorhandler(404)
    def not_found(_):
        if request.path.startswith("/api/"):
            return jsonify(ok=False, error="Not found."), 404
        return render_template("index.html", site=SITE, sections=SECTIONS), 404

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=app.config["DEBUG"])
