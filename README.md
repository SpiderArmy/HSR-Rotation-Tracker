# Flask single-page app

## Run
    pip install -r requirements.txt
    python app.py          # http://127.0.0.1:5000

## One-Command Run
    make run

This command creates `.venv` if needed, installs dependencies, and starts Flask.

Optional first-time setup only:
    make setup

## Structure
    app.py                 App factory, page route, API routes
    config.py              Site name, tagline, and the SECTIONS list
    templates/base.html    Page shell (head, scripts)
    templates/index.html   Sidebar buttons + one panel per section
    templates/sections/    One template per section
    static/css/style.css   Theme variables at the top, edit to restyle
    static/js/app.js       Section switching + API calls

## Customize
- **Add a section:** add an entry to `SECTIONS` in `config.py`, then create its template in `templates/sections/`. The nav button and panel appear automatically.
- **Link to a section from anywhere:** add `data-goto="section-id"` to any button or link.
- **Add an API route:** define it in `app.py` under `/api/...` and call it with the `api()` helper in `app.js`.
- **Restyle:** change the variables at the top of `style.css`.

## Planning
- Roadmap and milestone scopes live in `docs/ROADMAP.md`.
- GitHub issue templates for milestones live in `.github/ISSUE_TEMPLATE/`.
