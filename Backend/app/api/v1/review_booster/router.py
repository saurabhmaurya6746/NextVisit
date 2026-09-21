"""
Review Booster API Router
--------------------------
All endpoints under /api/v1/review-booster/ and public tracking endpoint.

Endpoints:
  GET    /dashboard                 — review booster dashboard stats
  GET    /customers                 — paginated customers with review eligibility & status
  POST   /send                      — enqueue review booster campaign & logs
  POST   /preview                   — preview personalized review request message
  POST   /ai-generate               — generate live Gemini AI review copy
  GET    /track/{token}             — public review link tracking & Google Review URL redirect
  PATCH  /{customer_id}/reviewed    — mark review as completed by customer
  GET    /history                   — review booster campaign history
  GET    /analytics                 — review booster conversion & delay analytics
  GET    /settings                  — read review booster settings
  PUT    /settings                  — update review booster settings
"""
import logging
from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.review_booster import (
    PaginatedReviewBoosterCustomersResponse,
    ReviewBoosterAiGenerateRequest,
    ReviewBoosterAiGenerateResponse,
    ReviewBoosterAnalyticsResponse,
    ReviewBoosterDashboardResponse,
    ReviewBoosterHistoryResponse,
    ReviewBoosterPreviewRequest,
    ReviewBoosterPreviewResponse,
    ReviewBoosterSendRequest,
    ReviewBoosterSendResponse,
    ReviewBoosterSettingsResponse,
    ReviewBoosterSettingsUpdate,
)
from app.services.review_booster_service import ReviewBoosterService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/review-booster",
    tags=["Review Booster"],
)


@router.get(
    "/dashboard",
    response_model=ReviewBoosterDashboardResponse,
    summary="Review booster dashboard metrics",
)
def get_review_booster_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns counts for pending, requested, clicked, reviewed, and eligible customer counts.
    """
    return ReviewBoosterService(db).get_dashboard(current_user)


@router.get(
    "/customers",
    response_model=PaginatedReviewBoosterCustomersResponse,
    summary="Review booster customer list with eligibility & status filtering",
)
def get_review_booster_customers(
    status: str = Query(
        default="all",
        description="Filter by status: eligible | pending | requested | clicked | reviewed | all",
    ),
    search: str | None = Query(default=None, description="Search by customer name or phone"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    sort_by: str = Query(
        default="recent",
        description="recent | spend_desc | visits_desc | bill_desc",
    ),
    start_date: datetime | None = Query(default=None),
    end_date: datetime | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns paginated list of customers with review request eligibility, last visit, and review status.
    """
    return ReviewBoosterService(db).get_customers(
        current_user=current_user,
        status_filter=status,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        start_date=start_date,
        end_date=end_date,
    )


@router.post(
    "/send",
    response_model=ReviewBoosterSendResponse,
    summary="Enqueue review booster campaign & logs",
    status_code=status.HTTP_201_CREATED,
)
def send_review_request(
    data: ReviewBoosterSendRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Creates a Review Campaign and enqueues CampaignLog items with tracking tokens.
    Reuses existing Campaign and CampaignLog queue infrastructure.
    """
    return ReviewBoosterService(db).send_review_request(current_user, data)


@router.post(
    "/preview",
    response_model=ReviewBoosterPreviewResponse,
    summary="Preview personalized review booster message",
)
def preview_review_message(
    data: ReviewBoosterPreviewRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Previews personalized message with placeholders substituted:
    {{customer_name}}, {{business_name}}, {{review_link}}.
    """
    return ReviewBoosterService(db).preview_message(current_user, data)


@router.post(
    "/ai-generate",
    response_model=ReviewBoosterAiGenerateResponse,
    summary="Generate live Gemini AI review request copy",
)
def generate_review_ai(
    data: ReviewBoosterAiGenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates personalized Gemini AI review copy. Reuses AiMessageService.
    """
    return ReviewBoosterService(db).generate_ai_message(current_user, data)


@router.get(
    "/track/{token}",
    summary="Public link tracking endpoint — records click & redirects to Google Review URL",
)
def track_review_click(
    token: str,
    db: Session = Depends(get_db),
):
    """
    Public endpoint. Records clicked_at timestamp and redirects to the merchant's Google Review URL.
    """
    target_url = ReviewBoosterService(db).track_click(token)
    return RedirectResponse(url=target_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.patch(
    "/{customer_id}/reviewed",
    summary="Mark customer review as completed",
)
def mark_review_completed(
    customer_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Owner/manager manually marks a customer review as completed.
    Stores reviewed_at timestamp and reviewed_by user ID.
    """
    return ReviewBoosterService(db).mark_reviewed(current_user, customer_id)


@router.get(
    "/history",
    response_model=ReviewBoosterHistoryResponse,
    summary="Review booster campaign history",
)
def get_review_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns history of all review booster campaign logs with click and review status.
    """
    return ReviewBoosterService(db).get_history(current_user)


@router.get(
    "/analytics",
    response_model=ReviewBoosterAnalyticsResponse,
    summary="Review booster analytics & conversion metrics",
)
def get_review_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns conversion metrics: Click Rate %, Review Rate %, Avg Review Delay.
    """
    return ReviewBoosterService(db).get_analytics(current_user)


@router.get(
    "/settings",
    response_model=ReviewBoosterSettingsResponse,
    summary="Read review booster settings",
)
def get_review_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Reads review booster settings from BusinessSettings.
    """
    return ReviewBoosterService(db).get_settings(current_user)


@router.put(
    "/settings",
    response_model=ReviewBoosterSettingsResponse,
    summary="Update review booster settings",
)
def update_review_settings(
    data: ReviewBoosterSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates review booster settings stored in BusinessSettings.
    """
    return ReviewBoosterService(db).update_settings(current_user, data)
