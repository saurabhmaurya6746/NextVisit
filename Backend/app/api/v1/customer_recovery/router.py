"""
Customer Recovery API Router
-----------------------------
All endpoints under /api/v1/customer-recovery/

Endpoints:
  GET    /dashboard          — bucket counts
  GET    /customers          — paginated recoverable customers
  GET    /analytics          — revenue, rate, ROI
  GET    /preview            — preview before launch
  POST   /launch             — launch campaign (creates queue)
  GET    /offers             — suggested offers
  GET    /history            — past campaign history
  GET    /settings           — read recovery settings
  PUT    /settings           — update recovery settings
"""
import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.customer_recovery import (
    PaginatedRecoverableCustomersResponse,
    RecoveryAnalyticsResponse,
    RecoveryDashboardResponse,
    RecoveryLaunchRequest,
    RecoveryLaunchResponse,
    RecoveryPreviewResponse,
    RecoverySettingsResponse,
    RecoverySettingsUpdate,
    SuggestedOffersResponse,
    RecoveryHistoryResponse,
    RecoveryAiGenerateRequest,
    RecoveryAiGenerateResponse,
)
from app.services.customer_recovery_service import CustomerRecoveryService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/customer-recovery",
    tags=["Customer Recovery"],
)


@router.get(
    "/dashboard",
    summary="Recovery dashboard — customer counts per inactivity bucket",
)
def get_recovery_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns per-bucket counts of recoverable customers.
    Buckets: 15, 30, 45, 60, 90 days.
    Based on last *completed* visit date (ignores cancelled visits).
    """
    return CustomerRecoveryService(db).get_dashboard(current_user)


@router.get(
    "/customers",
    response_model=PaginatedRecoverableCustomersResponse,
    summary="Recoverable customer list for a given bucket",
)
def get_recoverable_customers(
    bucket: int = Query(..., description="Inactivity bucket in days: 15, 30, 45, 60, or 90"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None, description="Search by name or phone"),
    sort_by: str = Query(
        default="days_desc",
        description="days_desc | days_asc | spend_desc | spend_asc | visits_desc",
    ),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns paginated list of customers who have not visited in `bucket` days.
    Each entry includes: last visit, days since visit, spend, visits, loyalty points, favorite item, VIP flag.
    """
    return CustomerRecoveryService(db).get_customers(
        current_user=current_user,
        bucket=bucket,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
    )


@router.get(
    "/analytics",
    response_model=RecoveryAnalyticsResponse,
    summary="Recovery analytics — potential revenue, recovery rate, ROI",
)
def get_recovery_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns recovery analytics including:
    - Potential revenue (avg_spend × recoverable_customers)
    - Recovery rate %
    - Messages sent/failed
    - Recovered customers count
    """
    return CustomerRecoveryService(db).get_analytics(current_user)


@router.get(
    "/preview",
    response_model=RecoveryPreviewResponse,
    summary="Preview a recovery campaign before launching",
)
def preview_recovery_campaign(
    bucket: int = Query(..., description="Inactivity bucket in days: 15, 30, 45, 60, or 90"),
    coupon_code: str | None = Query(default=None, description="Coupon code to attach"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns preview information:
    - Number of recipients
    - Estimated revenue
    - Estimated message count
    - Coupon code attached
    """
    return CustomerRecoveryService(db).get_preview(
        current_user=current_user,
        bucket=bucket,
        coupon_code=coupon_code,
    )


@router.post(
    "/launch",
    response_model=RecoveryLaunchResponse,
    summary="Launch a recovery campaign — creates queue entries for WhatsApp sending",
    status_code=201,
)
def launch_recovery_campaign(
    data: RecoveryLaunchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a Campaign record and enqueues CampaignLog entries (PENDING) for each recipient.
    Validates:
    - Bucket must be valid (15, 30, 45, 60, 90)
    - Cooldown period between launches (configurable, default 7 days)
    - At least 1 recoverable customer must exist

    Reuses existing Campaign + CampaignLog queue infrastructure.
    """
    return CustomerRecoveryService(db).launch_campaign(current_user, data)


@router.get(
    "/offers",
    response_model=SuggestedOffersResponse,
    summary="Suggested recovery offers",
)
def get_suggested_offers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns a list of standard recovery offer types for the UI."""
    return CustomerRecoveryService(db).get_suggested_offers()


@router.get(
    "/history",
    response_model=RecoveryHistoryResponse,
    summary="Recovery campaign history with per-campaign outcomes",
)
def get_recovery_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns all past RECOVERY campaigns with:
    - Recipients, sent, failed counts
    - Recovered customers (visited again within recovery_window_days after send)
    - Revenue generated from recovered customers
    """
    return CustomerRecoveryService(db).get_history(current_user)


@router.get(
    "/settings",
    response_model=RecoverySettingsResponse,
    summary="Get recovery settings for this business",
)
def get_recovery_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns recovery settings stored in BusinessSettings (no new table):
    - recovery_enabled
    - recovery_buckets (e.g. [15, 30, 45, 60, 90])
    - recovery_cooldown_days
    - recovery_max_messages_per_day
    - recovery_window_days (days to count a re-visit as recovered)
    """
    return CustomerRecoveryService(db).get_settings(current_user)


@router.put(
    "/settings",
    response_model=RecoverySettingsResponse,
    summary="Update recovery settings for this business",
)
def update_recovery_settings(
    data: RecoverySettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates recovery settings in BusinessSettings.
    Validates that recovery_buckets only contains values from {15, 30, 45, 60, 90}.
    """
    return CustomerRecoveryService(db).update_settings(current_user, data)


@router.post(
    "/ai-generate",
    response_model=RecoveryAiGenerateResponse,
    summary="Generate Gemini AI recovery copy (title, message, cta)",
)
def generate_recovery_ai(
    data: RecoveryAiGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates live Gemini AI message with title, message, and CTA.
    Reuses existing AiMessageService.
    """
    return CustomerRecoveryService(db).generate_ai_message(
        current_user=current_user,
        bucket=data.bucket,
        restaurant_name=data.restaurant_name,
        offer_type=data.offer_type,
        tone=data.tone,
        language=data.language,
    )

