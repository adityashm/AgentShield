.PHONY: setup dev migrate test lint sdk-test e2e up down demo loadtest gen-api

setup:
	python -m pip install -e ./sdk/python[all]
	python -m pip install -r backend/requirements.txt
	cd frontend && npm install

dev:
	python -m uvicorn backend.app.main:app --reload --port 8000 & cd frontend && npm run dev

migrate:
	cd backend && python -m alembic upgrade head

test:
	python -m pytest backend/tests/ -v
	python -m pytest sdk/python/tests/ -v
	cd frontend && npm run test

lint:
	python -m ruff check backend/app backend/tests sdk/python
	python -m mypy backend/app/core backend/app/detection
	cd frontend && npm run lint

sdk-test:
	python -m pytest sdk/python/tests/ -v

e2e:
	python examples/attack_scenarios.py

up:
	docker compose up --build -d

down:
	docker compose down -v

demo:
	docker compose --profile demo up --build

loadtest:
	python scripts/loadtest.py --rps 25 --duration 10

gen-api:
	sh scripts/gen_api_types.sh
