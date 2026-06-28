"""profile-service FastAPI app entry."""
from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .db import PostgresProfileStore
from .dependencies import get_profile_store
from .routers import profiles


@asynccontextmanager
async def lifespan(app: FastAPI):
    store = get_profile_store()
    if isinstance(store, PostgresProfileStore):
        await store.connect()
    try:
        yield
    finally:
        if isinstance(store, PostgresProfileStore):
            await store.close()


def create_app() -> FastAPI:
    app = FastAPI(title="MindFlex profile-service", version="0.1.0", lifespan=lifespan)
    app.include_router(profiles.router)

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
