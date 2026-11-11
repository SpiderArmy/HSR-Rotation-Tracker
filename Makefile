.PHONY: setup run

setup:
	python3 -m venv .venv
	. .venv/bin/activate && pip install -r requirements.txt

run:
	./scripts/run.sh
