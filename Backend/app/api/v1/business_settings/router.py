import logging

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user, get_optional_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.business_settings import (
    BusinessSettingsResponse,
    BusinessSettingsUpdate,
    ChangePasswordRequest,
    Toggle2faRequest,
    UserSessionItemResponse,
)
from app.schemas.vip_settings import VipSettingsUpdate
from app.services.business_settings_service import BusinessSettingsService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/business-settings",
    tags=["Business Settings"],
)


@router.get(
    "",
    response_model=BusinessSettingsResponse,
    summary="Get settings for the authenticated business",
)
def get_business_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns settings for the authenticated business.
    Auto-initializes default settings if none exist.
    Requires a valid Bearer JWT.
    """
    return BusinessSettingsService(db).get_settings(current_user)


@router.put(
    "",
    response_model=BusinessSettingsResponse,
    summary="Update settings for the authenticated business",
)
def update_business_settings(
    data: BusinessSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Updates settings (general, whatsapp, google, invoice, tax, notifications, ai, pos, branding)
    for the authenticated business.
    Requires a valid Bearer JWT.
    """
    return BusinessSettingsService(db).update_settings(current_user, data)


@router.get(
    "/vip",
    response_model=dict,
    summary="Get VIP settings for the authenticated business",
)
def get_vip_settings(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.services.customer_service import CustomerService
    cs = CustomerService(db)
    v_set = cs.get_or_create_vip_settings(current_user.business_id)
    formatted_rule = cs.format_vip_rule_display(v_set)
    return {
        "id": v_set.id,
        "business_id": v_set.business_id,
        "min_lifetime_spend": v_set.min_lifetime_spend,
        "min_visits": v_set.min_visits,
        "min_avg_bill": v_set.min_avg_bill,
        "last_visit_within_days": v_set.last_visit_within_days,
        "rule_logic": v_set.rule_logic,
        "is_active": v_set.is_active,
        "formatted_rule_display": formatted_rule,
        "created_at": v_set.created_at,
        "updated_at": v_set.updated_at,
    }


@router.put(
    "/vip",
    response_model=dict,
    summary="Update VIP settings for the authenticated business",
)
def update_vip_settings(
    data: VipSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.schemas.vip_settings import VipSettingsUpdate
    from app.services.customer_service import CustomerService
    return CustomerService(db).update_vip_settings(current_user, data)


# ── Section 9: Security Endpoints ───────────────────────────────────────────

@router.post(
    "/security/change-password",
    summary="Change current user password",
)
def change_password(
    data: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).change_password(current_user, data)


@router.post(
    "/security/toggle-2fa",
    summary="Toggle Two-Factor Authentication",
)
def toggle_2fa(
    data: Toggle2faRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).toggle_2fa(current_user, data.enable)


@router.get(
    "/security/sessions",
    response_model=list[UserSessionItemResponse],
    summary="List active sessions for current user",
)
def get_active_sessions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).get_active_sessions(current_user)


@router.post(
    "/security/sessions/logout-others",
    summary="Revoke all active sessions on other devices",
)
def logout_other_devices(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).logout_other_devices(current_user)


# ── Section 10: Backup & Export Endpoints ────────────────────────────────────

@router.get(
    "/export/database",
    summary="Export full JSON database backup for business",
)
def export_database(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).export_database_json(current_user)


@router.get(
    "/export/customers",
    summary="Export customers CSV backup for business",
)
def export_customers(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).export_customers_csv(current_user)


@router.get(
    "/export/orders",
    summary="Export orders CSV backup for business",
)
def export_orders(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).export_orders_csv(current_user)


@router.get(
    "/export/menu",
    summary="Export menu CSV backup for business",
)
def export_menu(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).export_menu_csv(current_user)


@router.get(
    "/export/catalog-pdf",
    summary="Export branded PDF catalog of menu or services",
)
def export_catalog_pdf(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return BusinessSettingsService(db).export_catalog_pdf(current_user)
