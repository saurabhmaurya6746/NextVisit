from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user import User
from app.core.dependencies import get_current_user
from app.schemas.coupon import (
    CouponCreate,
    CouponRedeemRequest,
    CouponValidateRequest,
)
from app.services.coupon_service import CouponService

router = APIRouter(prefix="/coupons", tags=["Coupons Engine"])


@router.get("", summary="Get paginated list of coupons with dynamic status")
def get_coupons(
    status: str = Query("all", description="Status filter: all, active, inactive, expired, upcoming"),
    search: str | None = Query(None, description="Search by code, name, or description"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    sort_by: str = Query("recent", description="Sort by: recent, code, usage_desc"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = CouponService(db)
    return svc.get_coupons(
        current_user=current_user,
        status_filter=status,
        search=search,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
    )


@router.post("", summary="Create a new coupon", status_code=status.HTTP_201_CREATED)
def create_coupon(
    data: CouponCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = CouponService(db)
    return svc.create_coupon(current_user=current_user, data=data)


@router.delete("/{coupon_id}", summary="Soft delete or deactivate a coupon")
def delete_coupon(
    coupon_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = CouponService(db)
    return svc.delete_coupon(current_user=current_user, coupon_id=coupon_id)


@router.post("/validate", summary="Validate a coupon for an order")
def validate_coupon(
    data: CouponValidateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = CouponService(db)
    return svc.validate_coupon(current_user=current_user, data=data)


@router.post("/redeem", summary="Redeem a coupon for an order")
def redeem_coupon(
    data: CouponRedeemRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    svc = CouponService(db)
    return svc.redeem_coupon(current_user=current_user, data=data)
