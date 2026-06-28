FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_LINK_MODE=copy \
    PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip install uv==0.5.11

COPY pyproject.toml ./
RUN uv venv /app/.venv && \
    uv pip install --python /app/.venv/bin/python \
        "fastapi>=0.115.0" "uvicorn[standard]>=0.30.0" \
        "asyncpg>=0.29.0" "pydantic>=2.7.0" \
        "python-dateutil>=2.9.0" "httpx>=0.27.0"

COPY profile_service /app/profile_service
COPY game_telemetry_service /app/game_telemetry_service

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app"

EXPOSE 8000
CMD ["uvicorn", "profile_service.app.main:app", "--host", "0.0.0.0", "--port", "8000"] 
