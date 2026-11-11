import json
from pathlib import Path
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from flask import Flask, jsonify, render_template, request

from config import SECTIONS, SITE, Config


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
            return jsonify(ok=True, source="cache", uid=uid, data=cached["data"])

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
        return jsonify(ok=True, source="network", uid=uid, data=payload)

    @app.errorhandler(404)
    def not_found(_):
        if request.path.startswith("/api/"):
            return jsonify(ok=False, error="Not found."), 404
        return render_template("index.html", site=SITE, sections=SECTIONS), 404

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=app.config["DEBUG"])
