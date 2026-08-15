import csv
import io
import json
import logging
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from fastapi.responses import Response, StreamingResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import hash_password, verify_password
from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.models.customer import Customer
from app.models.menu_category import MenuCategory
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderItem
from app.models.service import Service
from app.models.user import User
from app.models.user_session import UserSession
from app.models.visit import Visit
from app.repositories.business_settings_repository import (
    BusinessSettingsRepository,
)
from app.schemas.business_settings import (
    BusinessSettingsUpdate,
    ChangePasswordRequest,
    RestaurantSetupSettingsUpdate,
    UserSessionItemResponse,
)

logger = logging.getLogger(__name__)


class BusinessSettingsService:

    def __init__(self, db: Session):
        self.db = db
        self.repo = BusinessSettingsRepository(db)

    def init_default_settings_for_business(
        self, business_id: UUID
    ) -> BusinessSettings:
        settings = self.repo.get_by_business(business_id)
        if not settings:
            settings = BusinessSettings(
                business_id=business_id,
                currency="INR",
                timezone="Asia/Kolkata",
                language="en",
                tax_percentage=5.0,
                service_charge=0.0,
                default_discount=0.0,
            )
            self.repo.create(settings)
            self.db.commit()
            self.db.refresh(settings)
            logger.info(
                "Initialized default business settings | business_id=%s",
                business_id,
            )

        return settings

    def get_settings(self, current_user: User) -> BusinessSettings:
        logger.info(
            "Fetching business settings | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        settings = self.repo.get_by_business(current_user.business_id)
        if not settings:
            settings = self.init_default_settings_for_business(
                current_user.business_id
            )
        return settings

    def update_settings(
        self,
        current_user: User,
        data: BusinessSettingsUpdate,
    ) -> BusinessSettings:
        logger.info(
            "Updating business settings | business_id=%s requested_by=%s",
            current_user.business_id,
            current_user.id,
        )
        
        # 1. Fetch existing settings row (loaded directly in ORM session)
        settings = self.get_settings(current_user)

        # 2. Extract clean dictionary of only provided fields
        update_data = data.model_dump(exclude_unset=True)

        # 3. Direct ORM attribute update (guarantees dirty tracking in session)
        for key, value in update_data.items():
            if hasattr(settings, key):
                setattr(settings, key, value)

        # 4. Save and commit to DB
        self.db.add(settings)
        self.db.commit()
        self.db.refresh(settings)

        logger.info(
            "Business settings updated successfully in DB | business_id=%s allow_guest_checkout=%s",
            current_user.business_id,
            settings.allow_guest_checkout,
        )
        return settings

    def get_restaurant_setup_settings(self, current_user: User) -> dict:
        business = self.db.query(Business).filter(Business.id == current_user.business_id).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found.")
        settings = self.get_settings(current_user)

        is_saved = bool(business.name and (business.phone or business.address))

        return {
            "name": business.name,
            "phone": business.phone,
            "email": business.email,
            "address": business.address,
            "city": settings.city,
            "state": settings.state,
            "country": business.country,
            "gst_number": settings.gst_number,
            "currency": business.currency or settings.currency or "INR",
            "timezone": business.timezone or settings.timezone or "Asia/Kolkata",
            "opening_time": settings.opening_time or "09:00 AM",
            "closing_time": settings.closing_time or "10:00 PM",
            "enable_qr_ordering": settings.enable_qr_ordering,
            "enable_staff_ordering": settings.enable_staff_ordering,
            "enable_parcel": settings.enable_parcel,
            "enable_takeaway": settings.enable_takeaway,
            "allow_guest_checkout": settings.allow_guest_checkout,
            "tax_percentage": settings.tax_percentage,
            "invoice_prefix": settings.invoice_prefix or "INV-",
            "is_saved": is_saved,
        }

    def save_restaurant_setup_settings(
        self, current_user: User, data: RestaurantSetupSettingsUpdate
    ) -> dict:
        business = self.db.query(Business).filter(Business.id == current_user.business_id).first()
        if not business:
            raise HTTPException(status_code=404, detail="Business not found.")

        # Update Business
        business.name = data.name.strip()
        business.phone = data.phone.strip()
        business.email = data.email.strip()
        business.address = data.address.strip()
        business.country = data.country.strip()
        business.currency = data.currency.strip()
        business.timezone = data.timezone.strip()

        # Update BusinessSettings
        settings = self.get_settings(current_user)
        settings.city = data.city.strip() if data.city else None
        settings.state = data.state.strip() if data.state else None
        settings.gst_number = data.gst_number.strip() if data.gst_number else None
        settings.currency = data.currency.strip()
        settings.timezone = data.timezone.strip()
        settings.opening_time = data.opening_time.strip() if data.opening_time else "09:00 AM"
        settings.closing_time = data.closing_time.strip() if data.closing_time else "10:00 PM"
        settings.enable_qr_ordering = data.enable_qr_ordering
        settings.enable_staff_ordering = data.enable_staff_ordering
        settings.enable_parcel = data.enable_parcel
        settings.enable_takeaway = data.enable_takeaway
        settings.allow_guest_checkout = data.allow_guest_checkout
        settings.tax_percentage = data.tax_percentage
        settings.invoice_prefix = data.invoice_prefix.strip() if data.invoice_prefix else "INV-"

        self.db.commit()
        self.db.refresh(business)
        self.db.refresh(settings)

        return self.get_restaurant_setup_settings(current_user)

    # ── Section 9: Security Methods ──────────────────────────────────────────

    def change_password(self, current_user: User, data: ChangePasswordRequest) -> dict:
        user = self.db.scalar(select(User).where(User.id == current_user.id))
        if not user or not verify_password(data.old_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Current password is incorrect.",
            )

        if not data.new_password or len(data.new_password) < 8:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password must be at least 8 characters.",
            )

        if data.old_password == data.new_password or verify_password(data.new_password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="New password cannot be the same as the current password.",
            )

        user.hashed_password = hash_password(data.new_password)
        self.db.commit()
        logger.info("User password changed successfully | user_id=%s", user.id)
        return {"message": "Password updated successfully."}

    def toggle_2fa(self, current_user: User, enable: bool) -> dict:
        user = self.db.scalar(select(User).where(User.id == current_user.id))
        if user:
            user.two_factor_enabled = enable
            self.db.commit()
        return {"two_factor_enabled": enable, "message": f"Two Factor Authentication {'enabled' if enable else 'disabled'}."}

    def get_active_sessions(self, current_user: User) -> list[UserSessionItemResponse]:
        sessions = self.db.scalars(
            select(UserSession)
            .where(UserSession.user_id == current_user.id, UserSession.is_active == True)
            .order_by(UserSession.last_active_at.desc())
        ).all()
        return [
            UserSessionItemResponse(
                id=s.id,
                ip_address=s.ip_address,
                user_agent=s.user_agent,
                is_active=s.is_active,
                last_active_at=s.last_active_at,
                created_at=s.created_at,
            )
            for s in sessions
        ]

    def logout_other_devices(self, current_user: User) -> dict:
        sessions = self.db.scalars(
            select(UserSession).where(UserSession.user_id == current_user.id, UserSession.is_active == True)
        ).all()
        for s in sessions:
            s.is_active = False
        self.db.commit()
        return {"message": "All other devices logged out successfully."}

    # ── Section 10: Backup / Export Methods ──────────────────────────────────

    def export_customers_csv(self, current_user: User) -> StreamingResponse:
        customers = self.db.scalars(
            select(Customer).where(Customer.business_id == current_user.business_id)
        ).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Name", "Phone", "Email", "Visit Count", "Total Spent ($)", "Gender", "Address", "Created At"])

        for c in customers:
            writer.writerow([
                str(c.id),
                c.name or "",
                c.phone or "",
                c.email or "",
                c.visit_count or 0,
                c.total_spent or 0.0,
                c.gender or "",
                c.address or "",
                c.created_at.isoformat() if c.created_at else "",
            ])

        output.seek(0)
        filename = f"Customers_Backup_{datetime.now().strftime('%Y%m%d')}.csv"
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    def export_orders_csv(self, current_user: User) -> StreamingResponse:
        orders = self.db.scalars(
            select(Order).where(Order.business_id == current_user.business_id).order_by(Order.created_at.desc())
        ).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["Order ID", "Order Number", "Source", "Status", "Total Amount ($)", "Payment Status", "Created At"])

        for o in orders:
            writer.writerow([
                str(o.id),
                o.order_number or "",
                o.order_source or "",
                o.status or "",
                o.total_amount or 0.0,
                o.payment_status or "",
                o.created_at.isoformat() if o.created_at else "",
            ])

        output.seek(0)
        filename = f"Orders_Backup_{datetime.now().strftime('%Y%m%d')}.csv"
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    def export_menu_csv(self, current_user: User) -> StreamingResponse:
        items = self.db.scalars(
            select(MenuItem).where(MenuItem.business_id == current_user.business_id)
        ).all()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["ID", "Category ID", "Name", "Price ($)", "Is Available", "Created At"])

        for it in items:
            writer.writerow([
                str(it.id),
                str(it.category_id) if it.category_id else "",
                it.name or "",
                it.price or 0.0,
                "Yes" if it.is_available else "No",
                it.created_at.isoformat() if it.created_at else "",
            ])

        output.seek(0)
        filename = f"Menu_Backup_{datetime.now().strftime('%Y%m%d')}.csv"
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    def export_catalog_pdf(self, current_user: User) -> Response:
        from app.services.pdf_service import generate_catalog_export_pdf_bytes
        from app.models.service import Service
        from fastapi.responses import Response

        biz_name = current_user.business.name if current_user.business else "NextVisit Merchant"
        biz_type_name = (
            current_user.business.business_type.name
            if (current_user.business and current_user.business.business_type)
            else "Business"
        )
        is_salon = "salon" in biz_type_name.lower() or "spa" in biz_type_name.lower()

        items_list = []
        if is_salon:
            services = self.db.scalars(
                select(Service).where(Service.business_id == current_user.business_id)
            ).all()
            for s in services:
                cat_name = s.category.name if hasattr(s.category, "name") else (str(s.category) if s.category else "Services")
                items_list.append({
                    "category_name": cat_name,
                    "name": s.name,
                    "price": float(s.price or 0.0),
                    "is_available": getattr(s, "is_active", True),
                })
            catalog_title = "Salon Services Catalog"
        else:
            items = self.db.scalars(
                select(MenuItem).where(MenuItem.business_id == current_user.business_id)
            ).all()
            for it in items:
                cat_name = it.category.name if hasattr(it.category, "name") else (str(it.category) if it.category else "Menu Items")
                items_list.append({
                    "category_name": cat_name,
                    "name": it.name,
                    "price": float(it.price or 0.0),
                    "is_available": getattr(it, "is_available", True),
                })
            catalog_title = "Restaurant Menu Catalog"

        pdf_bytes = generate_catalog_export_pdf_bytes(
            business_name=biz_name,
            business_type_name=biz_type_name,
            catalog_title=catalog_title,
            items=items_list,
        )

        filename = f"{'Services' if is_salon else 'Menu'}_Catalog_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                "Access-Control-Expose-Headers": "Content-Disposition",
            },
        )

    def export_database_json(self, current_user: User) -> StreamingResponse:
        biz = self.db.scalar(select(Business).where(Business.id == current_user.business_id))
        settings = self.get_settings(current_user)
        customers = self.db.scalars(select(Customer).where(Customer.business_id == current_user.business_id)).all()
        categories = self.db.scalars(select(MenuCategory).where(MenuCategory.business_id == current_user.business_id)).all()
        menu_items = self.db.scalars(select(MenuItem).where(MenuItem.business_id == current_user.business_id)).all()

        backup_payload = {
            "version": "1.0",
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "business": {
                "id": str(biz.id) if biz else "",
                "name": biz.name if biz else "",
                "email": biz.email if biz else "",
                "phone": biz.phone if biz else "",
                "address": biz.address if biz else "",
            },
            "settings": {
                "currency": settings.currency,
                "tax_percentage": settings.tax_percentage,
                "service_charge": settings.service_charge,
                "invoice_prefix": settings.invoice_prefix,
                "website": settings.website,
                "whatsapp_number": settings.whatsapp_number,
                "review_link": settings.review_link,
            },
            "customers_count": len(customers),
            "customers": [
                {"id": str(c.id), "name": c.name, "phone": c.phone, "email": c.email, "visit_count": c.visit_count, "total_spent": c.total_spent}
                for c in customers
            ],
            "menu_categories": [
                {"id": str(cat.id), "name": cat.name} for cat in categories
            ],
            "menu_items": [
                {"id": str(item.id), "name": item.name, "price": item.price, "available": item.is_available}
                for item in menu_items
            ],
        }

        json_str = json.dumps(backup_payload, indent=2)
        filename = f"Full_Database_Backup_{datetime.now().strftime('%Y%m%d')}.json"
        return StreamingResponse(
            io.BytesIO(json_str.encode("utf-8")),
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
