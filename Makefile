.PHONY: check db-config db-up db-down

check:
	python3 scripts/validate_handoff.py

db-config:
	docker compose config --quiet

db-up:
	docker compose up -d db

db-down:
	docker compose down
