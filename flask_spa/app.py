import json
from pathlib import Path

from flask import Flask, jsonify, render_template, request

from config import SECTIONS, SITE, Config


def create_app() -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)

    # Character presets live in data/characters.json so you can edit them
    # without touching code. Speeds change between patches, so verify them.
    data_file = Path(app.root_path) / "data" / "characters.json"

    @app.route("/")
    def index():
        return render_template("index.html", site=SITE, sections=SECTIONS)

    @app.get("/api/characters")
    def characters():
        return jsonify(json.loads(data_file.read_text(encoding="utf-8")))

    @app.errorhandler(404)
    def not_found(_):
        if request.path.startswith("/api/"):
            return jsonify(ok=False, error="Not found."), 404
        return render_template("index.html", site=SITE, sections=SECTIONS), 404

    return app


app = create_app()

if __name__ == "__main__":
    app.run(debug=app.config["DEBUG"])
