import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.security import hash_password
from app.models.business import Business
from app.models.user import User
from app.schemas.user import PaginatedStaffResponse, StaffCreate, StaffResponse, StaffUpdate

logger = logging.getLogger(__name__)

BUSINESS_TYPE_TAG_MAP = {
    "RESTAURANT": "RST",
    "SALON": "SLN",
    "SPA": "SPA",
    "CLINIC": "CLN",
    "GYM": "GYM",
    "BARBER": "BAR",
}


def get_business_type_prefix(business_type_name: str | None) -> str:
    """
    Returns 3-letter uppercase tag for Business Type.
    Examples:
      - Restaurant -> RST
      - Salon -> SLN
      - Clinic -> CLN
      - Gym -> GYM
      - Spa -> SPA
      - Barber -> BAR
    """
    if not business_type_name or not business_type_name.strip():
        return "RST"

    clean_name = business_type_name.strip().upper()
    if clean_name in BUSINESS_TYPE_TAG_MAP:
        return BUSINESS_TYPE_TAG_MAP[clean_name]

    for k, v in BUSINESS_TYPE_TAG_MAP.items():
        if k in clean_name:
            return v

    letters_only = re.sub(r'[^A-Z]', '', clean_name)
    if len(letters_only) >= 3:
        return letters_only[:3]
    elif len(letters_only) > 0:
        return (letters_only + "X" * 3)[:3]
    else:
        return "RST"


def get_business_name_prefix(business_name: str | None) -> str:
    """
    Takes the FIRST THREE alphabetic characters of the BUSINESS NAME.
    NOT the Staff Name. Ignores spaces and special characters. Converts to uppercase.
    Examples:
      - Saurabh Restaurant -> SAU
      - Jail Restaurant -> JAI
      - Spice Hub -> SPI
      - Glow Salon -> GLO
    """
    if not business_name or not business_name.strip():
        return "BIZ"

    clean = re.sub(r'[^A-Za-z]', '', business_name.strip()).upper()
    if len(clean) >= 3:
        return clean[:3]
    elif len(clean) > 0:
        return (clean + "X" * 3)[:3]
    else:
        return "BIZ"


def generate_staff_login_id(business_type_name: str | None, business_name: str | None, database_id: int) -> str:
    """
    Generates Staff Login ID in required format:
    [BUSINESS_TYPE]-[FIRST_3_LETTERS_OF_BUSINESS_NAME]-[GLOBAL_DATABASE_ID]

    Examples:
      - Restaurant + Saurabh Restaurant + 10025 -> RST-SAU-10025
      - Restaurant + Saurabh Restaurant + 10026 -> RST-SAU-10026
      - Restaurant + Jail Restaurant + 10027    -> RST-JAI-10027
      - Salon      + Glow Salon      + 10028    -> SLN-GLO-10028
    """
    type_prefix = get_business_type_prefix(business_type_name)
    biz_prefix = get_business_name_prefix(business_name)
    return f"{type_prefix}-{biz_prefix}-{database_id}"


class UserService:

    def __init__(self, db: Session):
        self.db = db

    def get_next_login_id_for_business(self, current_user: User, name: str = "") -> str:
        """Returns live preview format of auto-generated staff login_id for the business."""
        business = self.db.scalar(
            select(Business)
            .options(joinedload(Business.business_type))
            .where(Business.id == current_user.business_id)
        )
        biz_type_name = business.business_type.name if (business and business.business_type) else "Restaurant"
        biz_name = business.name if business else "Business"

        type_prefix = get_business_type_prefix(biz_type_name)
        biz_prefix = get_business_name_prefix(biz_name)

        max_auto_id = self.db.scalar(select(func.max(User.auto_id))) or 10000
        if max_auto_id < 10000:
            max_auto_id = 10000
        next_id = max_auto_id + 1
        return f"{type_prefix}-{biz_prefix}-{next_id}"

    def list_staff(
        self, current_user: User, search: str = "", status_filter: str = "ALL", page: int = 1, limit: int = 10
    ) -> PaginatedStaffResponse:
        page = max(1, page)
        limit = max(1, min(100, limit))

        query = select(User).where(
            User.business_id == current_user.business_id,
            User.role != "OWNER",
        )

        if status_filter and status_filter.upper() != "ALL":
            st_val = status_filter.upper()
            query = query.where(User.status == st_val)

        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.where(
                or_(
                    func.lower(User.name).like(pattern),
                    func.lower(User.phone).like(pattern),
                    func.lower(User.email).like(pattern),
                    func.lower(User.designation).like(pattern),
                    func.lower(User.login_id).like(pattern),
                )
            )

        total = self.db.scalar(select(func.count()).select_from(query.subquery())) or 0
        pages = max(1, (total + limit - 1) // limit)

        staff_members = list(self.db.scalars(
            query.order_by(User.created_at.desc())
            .offset((page - 1) * limit)
            .limit(limit)
        ).all())

        items = [StaffResponse.model_validate(s) for s in staff_members]

        return PaginatedStaffResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
            pages=pages,
        )

    def get_staff_detail(self, current_user: User, user_id: UUID) -> StaffResponse:
        target = self.db.scalar(select(User).where(User.id == user_id, User.business_id == current_user.business_id))
        if not target:
            raise HTTPException(status_code=404, detail="Staff member not found.")
        return StaffResponse.model_validate(target)

    def create_staff(self, current_user: User, data: StaffCreate) -> StaffResponse:
        if current_user.role != "OWNER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Business Owners can create staff members.",
            )

        from app.services.subscription_limit_service import SubscriptionLimitService
        SubscriptionLimitService(self.db).check_staff_limit(current_user.business_id)

        business = self.db.scalar(
            select(Business)
            .options(joinedload(Business.business_type))
            .where(Business.id == current_user.business_id)
        )
        biz_type_name = business.business_type.name if (business and business.business_type) else "Restaurant"
        biz_name = business.name if business else "Business"

        clean_email = data.email.strip() if data.email and data.email.strip() else None
        if clean_email:
            dup_email = self.db.scalar(
                select(User).where(
                    func.lower(User.email) == clean_email.lower(),
                )
            )
            if dup_email:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"An account with email '{clean_email}' already exists. Please use a different email or leave email blank.",
                )

        st_val = data.status.upper() if data.status else "ACTIVE"
        if st_val == "INACTIVE" and data.permissions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot assign permissions to an INACTIVE staff account.",
            )

        # 1. Insert Staff into database
        new_staff = User(
            business_id=current_user.business_id,
            name=data.name.strip(),
            phone=data.phone.strip(),
            email=clean_email,
            designation=data.designation.strip() if data.designation and data.designation.strip() else None,
            login_id=None,
            hashed_password=hash_password(data.password),
            role="STAFF",
            status=st_val,
            is_active=(st_val == "ACTIVE"),
            permissions=data.permissions or [],
            created_by_id=current_user.id,
        )

        try:
            self.db.add(new_staff)
            # 2. Database generates global auto-increment ID (auto_id)
            self.db.flush()

            # 3. Generate staff_login_id using Business Type + First 3 letters of BUSINESS NAME + Database ID
            auto_login_id = generate_staff_login_id(biz_type_name, biz_name, new_staff.auto_id)

            # 4. Update Staff record with generated Login ID
            new_staff.login_id = auto_login_id
            self.db.commit()
            self.db.refresh(new_staff)
        except IntegrityError as ie:
            self.db.rollback()
            err_msg = str(ie.orig) if hasattr(ie, "orig") else str(ie)
            if clean_email and ("users_email_key" in err_msg or "email" in err_msg):
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"An account with email '{clean_email}' already exists.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Database integrity error while creating staff member: {err_msg}",
            )

        logger.info("Staff member created | staff_id=%s login_id=%s auto_id=%s", new_staff.id, new_staff.login_id, new_staff.auto_id)
        # 5. Return Login ID in API response
        return StaffResponse.model_validate(new_staff)

    def update_staff(self, current_user: User, user_id: UUID, data: StaffUpdate) -> StaffResponse:
        if current_user.role != "OWNER":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only Business Owners can update staff members.",
            )

        target = self.db.scalar(select(User).where(User.id == user_id, User.business_id == current_user.business_id))
        if not target or target.role == "OWNER":
            raise HTTPException(status_code=404, detail="Staff member not found.")

        if data.name is not None:
            target.name = data.name.strip()
            # Rule 5: Login ID must NEVER change even if Business Name or Staff Name changes later.
        if data.phone is not None:
            target.phone = data.phone.strip()
        if data.email is not None:
            clean_email = data.email.strip() if data.email.strip() else None
            if clean_email and clean_email.lower() != (target.email or "").lower():
                dup_email = self.db.scalar(
                    select(User).where(
                        func.lower(User.email) == clean_email.lower(),
                        User.id != target.id,
                    )
                )
                if dup_email:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail=f"An account with email '{clean_email}' already exists.",
                    )
            target.email = clean_email

        if data.designation is not None:
            target.designation = data.designation.strip() if data.designation.strip() else None

        if data.password:
            target.hashed_password = hash_password(data.password)

        if data.status is not None:
            st_val = data.status.upper()
            target.status = st_val
            target.is_active = (st_val == "ACTIVE")

        if data.permissions is not None:
            if target.status == "INACTIVE" and data.permissions:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot assign permissions to an INACTIVE staff account.",
                )
            target.permissions = data.permissions

        try:
            self.db.commit()
            self.db.refresh(target)
        except IntegrityError as ie:
            self.db.rollback()
            err_msg = str(ie.orig) if hasattr(ie, "orig") else str(ie)
            if "users_email_key" in err_msg or "email" in err_msg:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="An account with this email address already exists.",
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Database integrity error while updating staff member.",
            )

        logger.info("Staff member updated | staff_id=%s login_id=%s", target.id, target.login_id)
        return StaffResponse.model_validate(target)

    def reset_password(self, current_user: User, user_id: UUID, new_password: str) -> dict:
        if current_user.role != "OWNER":
            raise HTTPException(status_code=403, detail="Only Business Owners can reset staff passwords.")

        target = self.db.scalar(select(User).where(User.id == user_id, User.business_id == current_user.business_id))
        if not target or target.role == "OWNER":
            raise HTTPException(status_code=404, detail="Staff member not found.")

        target.hashed_password = hash_password(new_password)
        self.db.commit()
        logger.info("Staff password reset | staff_id=%s", target.id)
        return {"message": "Staff password reset successfully."}

    def toggle_status(self, current_user: User, user_id: UUID, new_status: str) -> StaffResponse:
        if current_user.role != "OWNER":
            raise HTTPException(status_code=403, detail="Only Business Owners can toggle staff status.")

        target = self.db.scalar(select(User).where(User.id == user_id, User.business_id == current_user.business_id))
        if not target or target.role == "OWNER":
            raise HTTPException(status_code=404, detail="Staff member not found.")

        st_val = new_status.upper()
        if st_val not in {"ACTIVE", "INACTIVE"}:
            raise HTTPException(status_code=400, detail="Invalid status value. Allowed: ACTIVE, INACTIVE")

        target.status = st_val
        target.is_active = (st_val == "ACTIVE")
        if st_val == "INACTIVE":
            target.permissions = []

        self.db.commit()
        self.db.refresh(target)
        return StaffResponse.model_validate(target)

    def delete_staff(self, current_user: User, user_id: UUID) -> dict:
        if current_user.role != "OWNER":
            raise HTTPException(status_code=403, detail="Only Business Owners can delete staff members.")

        target = self.db.scalar(select(User).where(User.id == user_id, User.business_id == current_user.business_id))
        if not target or target.role == "OWNER":
            raise HTTPException(status_code=404, detail="Staff member not found.")

        self.db.delete(target)
        self.db.commit()
        logger.info("Staff member deleted | staff_id=%s", user_id)
        return {"message": "Staff member deleted successfully."}
