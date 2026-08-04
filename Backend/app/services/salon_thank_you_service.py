import logging
import re
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings as app_config
from app.models.business import Business
from app.models.business_settings import BusinessSettings
from app.models.customer import Customer
from app.models.user import User
from app.models.visit import Visit, VisitService

logger = logging.getLogger(__name__)


class SalonThankYouMessageService:

    def __init__(self, db: Session):
        self.db = db

    def generate_thank_you_whatsapp_message(
        self,
        current_user: User,
        appointment_id_str: str,
        custom_tone: str = "Friendly",
    ) -> dict:
        # 1. Fetch Visit by UUID or fallback to latest visit
        visit = None
        parsed_uuid = None
        try:
            parsed_uuid = UUID(str(appointment_id_str).strip())
        except Exception:
            parsed_uuid = None

        if parsed_uuid:
            visit_stmt = (
                select(Visit)
                .options(joinedload(Visit.services).joinedload(VisitService.service), joinedload(Visit.customer))
                .where(Visit.id == parsed_uuid, Visit.business_id == current_user.business_id)
            )
            visit = self.db.scalar(visit_stmt)

        if not visit:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Appointment not found for WhatsApp message generation.",
            )

        # 2. Fetch Business & Settings
        biz = self.db.get(Business, current_user.business_id)
        settings_stmt = select(BusinessSettings).where(BusinessSettings.business_id == current_user.business_id)
        biz_settings = self.db.scalar(settings_stmt)

        biz_name = biz.name if (biz and biz.name) else "Salon Business"
        tax_pct = biz_settings.tax_percentage if biz_settings else 0.0

        # 3. Extract Customer Info
        customer = visit.customer
        c_name = customer.name if (customer and customer.name) else "Valued Client"
        c_phone = customer.phone if (customer and customer.phone) else ""
        c_email = customer.email if (customer and customer.email) else ""

        # 4. Extract Services Info
        services_names = []
        if visit.services:
            for vs in visit.services:
                s_name = vs.service.name if (vs.service and vs.service.name) else "Salon Service"
                dur = vs.service.duration_minutes if (vs.service and vs.service.duration_minutes) else 30
                services_names.append(f"{s_name} ({dur} min)")
        else:
            services_names.append("Salon Service")

        services_str = ", ".join(services_names)

        # 5. Extract Financials
        subtotal = visit.subtotal if visit.subtotal > 0 else (visit.total_amount if visit.total_amount > 0 else 0.0)
        tax_amount = round((subtotal * max(0.0, tax_pct)) / 100.0, 2)
        grand_total = visit.total_amount if visit.total_amount > 0 else (subtotal + tax_amount)
        advance_paid = 0.0
        if visit.notes:
            match = re.search(r"Advance Paid:\s*₹?\s*(\d+(?:\.\d+)?)", visit.notes, re.IGNORECASE)
            if match:
                advance_paid = float(match.group(1))

        paid_amount = max(0.0, grand_total - advance_paid)

        # 6. Extract Loyalty
        pts_earned = int(grand_total // 10)
        loyalty_balance = customer.loyalty_points if customer else pts_earned

        date_formatted = visit.started_at.strftime("%d/%m/%Y at %I:%M %p") if visit.started_at else datetime.now(timezone.utc).strftime("%d/%m/%Y at %I:%M %p")
        staff_name = "Stylist"

        # 7. Generate Personalized Thank You Message Content
        tone_vibe = custom_tone or (biz_settings.ai_default_tone if biz_settings else "Friendly")

        msg = (
            f"Dear {c_name},\n\n"
            f"Thank you for visiting {biz_name} today! ❤️ We hope you had a relaxing and wonderful experience.\n\n"
            f"📋 *Visit Details:*\n"
            f"• Date & Time: {date_formatted}\n"
            f"• Services: {services_str}\n"
            f"• Grand Total: ₹{paid_amount:,.2f}\n\n"
            f"🎁 *Loyalty Rewards:*\n"
            f"• Points Earned Today: +{pts_earned} pts\n"
            f"• Total Loyalty Balance: {loyalty_balance} pts\n\n"
            f"We truly value your patronage and look forward to welcoming you back soon!\n\n"
            f"Warm regards,\n"
            f"Team {biz_name}"
        )

        return {
            "message": msg,
            "customer_name": c_name,
            "customer_phone": c_phone,
            "salon_name": biz_name,
            "visit_date": date_formatted,
            "services_summary": services_str,
            "grand_total": paid_amount,
            "points_earned": pts_earned,
            "loyalty_balance": loyalty_balance,
            "tone": tone_vibe,
        }
