from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from app.api.routes import auth, dashboard, drills, maintenance, ships, users
from app.core.config import settings
from app.core.database import SessionLocal, init_db
from app.services.seed import seed_initial_data
from app.services.drill_service import refresh_drill_statuses


def create_app() -> FastAPI:
    app = FastAPI(title=settings.APP_NAME)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_origin_regex=settings.CORS_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth.router, prefix=settings.API_PREFIX)
    app.include_router(users.router, prefix=settings.API_PREFIX)
    app.include_router(ships.router, prefix=settings.API_PREFIX)
    app.include_router(maintenance.router, prefix=settings.API_PREFIX)
    app.include_router(drills.router, prefix=settings.API_PREFIX)
    app.include_router(dashboard.router, prefix=settings.API_PREFIX)

    scheduler = BackgroundScheduler()

    def _auto_refresh_drills() -> None:
        db = SessionLocal()
        try:
            refresh_drill_statuses(db)
        finally:
            db.close()

    @app.on_event("startup")
    def on_startup() -> None:
        init_db()
        db = SessionLocal()
        try:
            seed_initial_data(db)
        finally:
            db.close()
        scheduler.add_job(_auto_refresh_drills, "interval", seconds=60, id="drill_refresh")
        scheduler.start()

    @app.on_event("shutdown")
    def on_shutdown() -> None:
        scheduler.shutdown(wait=False)

    @app.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok", "service": settings.APP_NAME}

    return app


app = create_app()
