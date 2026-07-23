import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.v1.auth.router import router as auth_router
from app.api.v1.automation.router import router as automation_router
from app.api.v1.business.router import router as business_router
from app.api.v1.business_settings.router import router as business_settings_router
from app.api.v1.business_types.router import router as business_type_router
from app.api.v1.campaign_logs.router import router as campaign_logs_router
from app.api.v1.campaigns.router import router as campaigns_router
from app.api.v1.customers.router import router as customers_router
from app.api.v1.dashboard.router import router as dashboard_router
from app.api.v1.loyalty.router import router as loyalty_router
from app.api.v1.message_templates.router import router as message_templates_router
from app.api.v1.services.router import router as services_router
from app.api.v1.staff.router import router as staff_router
from app.api.v1.uploads.router import router as uploads_router
from app.api.v1.visits.router import router as visits_router
from app.db.database import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(title="NextVisit API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

app.include_router(
    auth_router,
    prefix="/api/v1",
)

app.include_router(
    automation_router,
    prefix="/api/v1",
)

app.include_router(
    business_router,
    prefix="/api/v1",
)

app.include_router(
    business_settings_router,
    prefix="/api/v1",
)

app.include_router(
    business_type_router,
    prefix="/api/v1",
)

app.include_router(
    campaign_logs_router,
    prefix="/api/v1",
)

app.include_router(
    campaigns_router,
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
    loyalty_router,
    prefix="/api/v1",
)

app.include_router(
    message_templates_router,
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
    uploads_router,
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