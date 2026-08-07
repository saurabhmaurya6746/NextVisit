import logging
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text

from app.api.v1.admin_approvals.router import router as admin_approvals_router
from app.api.v1.admin_auth.router import router as admin_auth_router
from app.api.v1.admin_clients.router import router as admin_clients_router
from app.api.v1.admin_dashboard.router import router as admin_dashboard_router
from app.api.v1.admin_settings.router import router as admin_settings_router
from app.api.v1.admin_subscriptions.router import router as admin_subscriptions_router
from app.api.v1.credit_management.router import router as credit_management_router
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
from app.api.v1.menu.router import router as menu_router
from app.api.v1.message_templates.router import router as message_templates_router
from app.api.v1.orders.router import router as orders_router
from app.api.v1.services.router import router as services_router
from app.api.v1.staff.router import router as staff_router
from app.api.v1.dining_areas.router import router as dining_areas_router
from app.api.v1.festivals.router import router as festivals_router
from app.api.v1.setup.router import router as setup_router
from app.api.v1.tables.router import router as tables_router
from app.api.v1.uploads.router import router as uploads_router
from app.api.v1.visits.router import router as visits_router
from app.api.v1.qr.router import router as qr_router
from app.api.v1.customer_recovery.router import router as customer_recovery_router
from app.api.v1.review_booster.router import router as review_booster_router
from app.api.v1.coupons.router import router as coupons_router
from app.api.v1.reports.router import router as reports_router
from app.api.v1.subscription.router import router as subscription_router
from app.api.v1.salon.service_areas.router import router as salon_service_areas_router
from app.api.v1.salon.chairs.router import router as salon_chairs_router
from app.api.v1.salon.service_categories.router import router as salon_service_categories_router
from app.api.v1.salon.invoices.router import router as salon_invoices_router
from app.api.v1.salon.revenue.router import router as salon_revenue_router
from app.db.database import engine
from app.models.base import Base

# Ensure all database tables exist
Base.metadata.create_all(bind=engine)

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
    admin_approvals_router,
    prefix="/api/v1",
)

app.include_router(
    admin_auth_router,
    prefix="/api/v1",
)

app.include_router(
    admin_clients_router,
    prefix="/api/v1",
)

app.include_router(
    admin_dashboard_router,
    prefix="/api/v1",
)

app.include_router(
    admin_settings_router,
    prefix="/api/v1",
)

app.include_router(
    admin_subscriptions_router,
    prefix="/api/v1",
)

app.include_router(
    credit_management_router,
    prefix="/api/v1",
)

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
    menu_router,
    prefix="/api/v1",
)

app.include_router(
    orders_router,
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
    dining_areas_router,
    prefix="/api/v1",
)

app.include_router(
    setup_router,
    prefix="/api/v1",
)

app.include_router(
    tables_router,
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

app.include_router(
    qr_router,
    prefix="/api/v1",
)

app.include_router(
    festivals_router,
    prefix="/api/v1",
)

app.include_router(
    customer_recovery_router,
    prefix="/api/v1",
)

app.include_router(
    review_booster_router,
    prefix="/api/v1",
)

app.include_router(
    coupons_router,
    prefix="/api/v1",
)

app.include_router(
    reports_router,
    prefix="/api/v1",
)

app.include_router(
    subscription_router,
    prefix="/api/v1",
)

app.include_router(
    salon_service_areas_router,
    prefix="/api/v1",
)

app.include_router(
    salon_chairs_router,
    prefix="/api/v1",
)

app.include_router(
    salon_service_categories_router,
    prefix="/api/v1",
)

app.include_router(
    salon_invoices_router,
    prefix="/api/v1",
)

app.include_router(
    salon_revenue_router,
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