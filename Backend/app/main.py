import logging

from fastapi import FastAPI
from sqlalchemy import text

from app.db.database import engine
from app.api.v1.auth.router import router as auth_router
from app.api.v1.business.router import router as business_router
from app.api.v1.business_types.router import router as business_type_router
from app.api.v1.customers.router import router as customers_router
from app.api.v1.dashboard.router import router as dashboard_router
from app.api.v1.services.router import router as services_router
from app.api.v1.staff.router import router as staff_router
from app.api.v1.visits.router import router as visits_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(title="NextVisit API")

app.include_router(
    auth_router,
    prefix="/api/v1",
)

app.include_router(
    business_router,
    prefix="/api/v1",
)

app.include_router(
    business_type_router,
    prefix="/api/v1",
)

app.include_router(
    customers_router,
    prefix="/api/v1",
)

app.include_router(
    dashboard_router,
    prefix="/api/v1",
)

app.include_router(
    services_router,
    prefix="/api/v1",
)

app.include_router(
    staff_router,
    prefix="/api/v1",
)

app.include_router(
    visits_router,
    prefix="/api/v1",
)


@app.get("/")
def root():
    with engine.connect() as connection:
        version = connection.execute(
            text("SELECT version();")
        ).scalar()

    return {
        "status": "Running",
        "database": version
    }