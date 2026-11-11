"""Site settings. Edit this file to customize the app without touching routes."""
import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "change-me-in-production")
    DEBUG = os.environ.get("FLASK_DEBUG", "1") == "1"
    ENKA_USER_AGENT = os.environ.get(
        "ENKA_USER_AGENT",
        "HSR-Rotation-Tracker/0.1 (+https://github.com/SpiderArmy/HSR-Rotation-Tracker)",
    )
    ENKA_CACHE_TTL_SECONDS = int(os.environ.get("ENKA_CACHE_TTL_SECONDS", "300"))
    ENKA_MIN_SECONDS_BETWEEN_REQUESTS = float(
        os.environ.get("ENKA_MIN_SECONDS_BETWEEN_REQUESTS", "1.0")
    )


SITE = {
    "name": "Rotation Planner",
    "tagline": "Turn order and skill points for a four-unit team.",
}

# Each entry becomes a nav stop AND a panel. To add one: append here and
# create the template file.
SECTIONS = [
    {"id": "basics",   "label": "Basics",   "template": "sections/basics.html"},
    {"id": "team",     "label": "Team",     "template": "sections/team.html"},
    {"id": "rotation", "label": "Rotation", "template": "sections/rotation.html"},
]
