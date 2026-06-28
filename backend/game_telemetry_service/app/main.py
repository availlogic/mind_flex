"""game-telemetry-service FastAPI app entry."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .db import PostgresProfileLookup, PostgresTelemetryStore
from .dependencies import get_profile_lookup, get_telemetry_store
from .routers import games


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = get_telemetry_store()
    lookup = get_profile_lookup()
    if isinstance(store, PostgresTelemetryStore):
        await store.connect()
    if isinstance(lookup, PostgresProfileLookup):
        await lookup.connect()
    try:
        yield
    finally:
        if isinstance(store, PostgresTelemetryStore):
            await store.close()
        if isinstance(lookup, PostgresProfileLookup):
            await lookup.close()


def create_app() -> FastAPI:
    app = FastAPI(title="MindFlex game-telemetry-service", version="0.1.0", lifespan=lifespan)
    app.include_router(games.router)

    @app.exception_handler(RequestValidationError)
    async def _on_validation_error(_: Request, exc: RequestValidationError):
        safe_errors = []
        for err in exc.errors():
            safe_errors.append({
                "loc": list(err.get("loc", [])),
                "msg": str(err.get("msg", "")),
                "type": err.get("type", ""),
            })
        return JSONResponse(
            status_code=400,
            content={
                "error": {
                    "code": "INVALID_PARAMETER",
                    "message": "Request data violates schemas or validations.",
                    "details": {"errors": safe_errors},
                }
            },
        )

    @app.exception_handler(HTTPException)
    async def _on_http_exception(_: Request, exc: HTTPException):
        detail = exc.detail
        if isinstance(detail, dict) and "error" in detail:
            return JSONResponse(status_code=exc.status_code, content=detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={"error": {"code": "INTERNAL_SERVER_ERROR",
                               "message": str(detail),
                               "details": {}}},
        )

    @app.get("/healthz")
    async def _healthz():
        return {"status": "ok"}

    return app


app = create_app()
