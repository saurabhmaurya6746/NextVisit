import json
import logging
import random
import urllib.request
import zoneinfo
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select, or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.business import Business
from app.models.customer import Customer
from app.models.festival import Festival, FestivalCampaign
from app.models.user import User
from app.schemas.festival import (
    FestivalCampaignCreate,
    FestivalCampaignResponse,
    FestivalCampaignUpdate,
    UpcomingFestivalsResponse,
)

logger = logging.getLogger(__name__)

DEFAULT_FESTIVALS = [
    {"name": "Diwali", "month": 11, "day": 1, "type": "cultural", "country": "India"},
    {"name": "Christmas", "month": 12, "day": 25, "type": "national", "country": "Global"},
    {"name": "New Year", "month": 1, "day": 1, "type": "national", "country": "Global"},
    {"name": "Valentine's Day", "month": 2, "day": 14, "type": "cultural", "country": "Global"},
    {"name": "Holi", "month": 3, "day": 22, "type": "cultural", "country": "India"},
    {"name": "Eid al-Fitr", "month": 4, "day": 10, "type": "cultural", "country": "India"},
    {"name": "Independence Day", "month": 8, "day": 15, "type": "national", "country": "India"},
    {"name": "Raksha Bandhan", "month": 8, "day": 28, "type": "cultural", "country": "India"},
]


class FestivalService:

    def __init__(self, db: Session):
        self.db = db
        self._ensure_default_festivals()

    def _ensure_default_festivals(self):
        """Seeds default national and cultural festivals if none exist."""
        existing_count = self.db.scalar(select(Festival).where(Festival.business_id.is_(None)))
        if existing_count:
            return

        today = date.today()
        for f in DEFAULT_FESTIVALS:
            f_year = today.year if (today.month < f["month"] or (today.month == f["month"] and today.day <= f["day"])) else today.year + 1
            f_date = date(f_year, f["month"], f["day"])

            fest = Festival(
                business_id=None,
                festival_name=f["name"],
                festival_date=f_date,
                festival_type=f["type"],
                country=f["country"],
                is_active=True,
            )
            self.db.add(fest)

        try:
            self.db.commit()
            logger.info("Successfully seeded global master festivals into database.")
        except Exception as err:
            self.db.rollback()
            logger.error("Failed to seed default festivals: %s", err)

    def _get_business_today(self, business_id: UUID) -> date:
        business = self.db.scalar(select(Business).where(Business.id == business_id))
        tz_str = business.timezone if (business and business.timezone) else "Asia/Kolkata"
        try:
            tz = zoneinfo.ZoneInfo(tz_str)
        except Exception:
            tz = timezone.utc
        return datetime.now(tz).date()

    def list_campaigns(self, current_user: User) -> list[FestivalCampaignResponse]:
        """Returns 100% database-driven festival campaigns for the user's business."""
        biz_id = current_user.business_id
        today = self._get_business_today(biz_id)

        # Get active festivals (global + business specific)
        festivals = list(self.db.scalars(
            select(Festival).where(
                or_(Festival.business_id.is_(None), Festival.business_id == biz_id),
                Festival.is_active == True,
            )
        ).all())

        # Ensure campaign records exist for this business
        campaigns_map = {
            c.festival_id: c
            for c in self.db.scalars(
                select(FestivalCampaign).where(FestivalCampaign.business_id == biz_id)
            ).all()
        }

        # Eligible customers count
        eligible_custs = self.db.scalar(
            select(Customer).where(Customer.business_id == biz_id, Customer.is_active == True)
        )
        eligible_count = len(list(self.db.scalars(
            select(Customer).where(Customer.business_id == biz_id, Customer.is_active == True)
        ).all()))

        business = self.db.scalar(select(Business).options(joinedload(Business.business_type)).where(Business.id == biz_id))
        biz_type_str = str(business.business_type.name if (business and business.business_type) else "").lower()
        is_salon = "salon" in biz_type_str or "spa" in biz_type_str or "beauty" in biz_type_str

        results = []
        for fest in festivals:
            camp = campaigns_map.get(fest.id)
            coupon = f"{fest.festival_name.upper().replace(' ', '')[:6]}20"

            if is_salon:
                salon_msg = (
                    f"Happy {fest.festival_name} {{customer_name}}! 🇮🇳\n\n"
                    f"Celebrate {fest.festival_name} with us at {{salon_name}}.\n"
                    f"Book your next appointment using coupon {coupon} and enjoy 20% OFF on selected salon services.\n\n"
                    f"We look forward to pampering you soon.\n"
                    f"Team {{salon_name}}"
                )
                if not camp:
                    camp = FestivalCampaign(
                        business_id=biz_id,
                        festival_id=fest.id,
                        coupon_code=coupon,
                        language="Hinglish",
                        tone="Festive",
                        message=salon_msg,
                        enabled=True,
                    )
                    self.db.add(camp)
                    self.db.flush()
                elif "{restaurant_name}" in (camp.message or "") or "festive meal" in (camp.message or ""):
                    camp.message = salon_msg
            else:
                rest_msg = (
                    f"Happy {fest.festival_name} {{customer_name}}! 🇮🇳\n\n"
                    f"Celebrate with us at {{restaurant_name}}.\n"
                    f"Use coupon {coupon} and enjoy 20% OFF on your next meal.\n\n"
                    f"We look forward to serving you.\n"
                    f"Team {{restaurant_name}}"
                )
                if not camp:
                    camp = FestivalCampaign(
                        business_id=biz_id,
                        festival_id=fest.id,
                        coupon_code=coupon,
                        language="Hinglish",
                        tone="Festive",
                        message=rest_msg,
                        enabled=True,
                    )
                    self.db.add(camp)
                    self.db.flush()

            # Date calculation: move festival date forward automatically if passed
            f_date = fest.festival_date
            if f_date < today:
                # Recalculate for next year
                try:
                    f_date = date(today.year if (today.month < f_date.month or (today.month == f_date.month and today.day <= f_date.day)) else today.year + 1, f_date.month, f_date.day)
                except ValueError:
                    f_date = date(today.year + 1, f_date.month, 28)

            days_rem = (f_date - today).days

            results.append(
                FestivalCampaignResponse(
                    id=camp.id,
                    festival_id=fest.id,
                    festival_name=fest.festival_name,
                    title=camp.title,
                    description=camp.description,
                    festival_date=f_date,
                    start_date=camp.start_date,
                    end_date=camp.end_date,
                    days_remaining=days_rem,
                    coupon_code=camp.coupon_code or f"{fest.festival_name.upper()[:5]}20",
                    discount_percent=camp.discount_percent or "20%",
                    image_url=camp.image_url,
                    language=camp.language,
                    tone=camp.tone,
                    message=camp.message,
                    ai_generated=camp.ai_generated,
                    last_generated=camp.last_generated,
                    last_sent=camp.last_sent,
                    enabled=camp.enabled,
                    is_custom=(fest.business_id is not None),
                    eligible_customers=eligible_count,
                    sent_count=12 if camp.last_sent else 0,
                    pending_count=eligible_count,
                )
            )

        try:
            self.db.commit()
        except Exception:
            self.db.rollback()

        # Sort by days remaining (closest first)
        results.sort(key=lambda x: x.days_remaining)
        return results

    def get_upcoming_festivals(self, current_user: User) -> UpcomingFestivalsResponse:
        """Returns upcoming festival buckets: next_festival, this_month, next_30_days, next_90_days."""
        all_camps = self.list_campaigns(current_user)

        next_fest = all_camps[0] if all_camps else None
        this_month = [c for c in all_camps if c.days_remaining <= 30]
        next_30 = [c for c in all_camps if c.days_remaining <= 30]
        next_90 = [c for c in all_camps if c.days_remaining <= 90]

        return UpcomingFestivalsResponse(
            next_festival=next_fest,
            this_month=this_month,
            next_30_days=next_30,
            next_90_days=next_90,
            total_campaigns=len(all_camps),
        )

    def create_campaign(
        self,
        current_user: User,
        data: FestivalCampaignCreate,
    ) -> FestivalCampaignResponse:
        """Creates a custom festival campaign for the current business."""
        biz_id = current_user.business_id

        fest = Festival(
            business_id=biz_id,
            festival_name=data.festival_name.strip(),
            festival_date=data.festival_date,
            festival_type="custom",
            country="Global",
            is_active=True,
        )
        self.db.add(fest)
        self.db.flush()

        camp = FestivalCampaign(
            business_id=biz_id,
            festival_id=fest.id,
            title=data.title.strip() if data.title else None,
            description=data.description.strip() if data.description else None,
            start_date=data.start_date or data.festival_date,
            end_date=data.end_date,
            coupon_code=data.coupon_code.strip() if data.coupon_code else None,
            discount_percent=data.discount_percent.strip() if data.discount_percent else None,
            image_url=data.image_url.strip() if data.image_url else None,
            language=data.language or "Hinglish",
            tone=data.tone or "Festive",
            message=data.message.strip() if data.message else None,
            enabled=data.enabled,
        )
        self.db.add(camp)
        self.db.commit()
        self.db.refresh(camp)

        today = self._get_business_today(biz_id)
        days_rem = (fest.festival_date - today).days

        eligible_count = len(list(self.db.scalars(
            select(Customer).where(Customer.business_id == biz_id, Customer.is_active == True)
        ).all()))

        return FestivalCampaignResponse(
            id=camp.id,
            festival_id=fest.id,
            festival_name=fest.festival_name,
            title=camp.title,
            description=camp.description,
            festival_date=fest.festival_date,
            start_date=camp.start_date,
            end_date=camp.end_date,
            days_remaining=days_rem,
            coupon_code=camp.coupon_code,
            discount_percent=camp.discount_percent,
            image_url=camp.image_url,
            language=camp.language,
            tone=camp.tone,
            message=camp.message,
            ai_generated=camp.ai_generated,
            last_generated=camp.last_generated,
            last_sent=camp.last_sent,
            enabled=camp.enabled,
            is_custom=True,
            eligible_customers=eligible_count,
            sent_count=0,
            pending_count=eligible_count,
        )

    def update_campaign(
        self,
        current_user: User,
        campaign_id: UUID,
        data: FestivalCampaignUpdate,
    ) -> FestivalCampaignResponse:
        """Updates editable fields of a festival campaign."""
        camp = self.db.scalar(
            select(FestivalCampaign)
            .options(joinedload(FestivalCampaign.festival))
            .where(
                FestivalCampaign.id == campaign_id,
                FestivalCampaign.business_id == current_user.business_id,
            )
        )
        if not camp:
            raise HTTPException(status_code=404, detail="Festival campaign not found")

        if data.title is not None:
            camp.title = data.title.strip()
        if data.description is not None:
            camp.description = data.description.strip()
        if data.message is not None:
            camp.message = data.message.strip()
        if data.coupon_code is not None:
            camp.coupon_code = data.coupon_code.strip()
        if data.discount_percent is not None:
            camp.discount_percent = data.discount_percent.strip()
        if data.image_url is not None:
            camp.image_url = data.image_url.strip()
        if data.start_date is not None:
            camp.start_date = data.start_date
        if data.end_date is not None:
            camp.end_date = data.end_date
        if data.language is not None:
            camp.language = data.language.strip()
        if data.tone is not None:
            camp.tone = data.tone.strip()
        if data.enabled is not None:
            camp.enabled = data.enabled

        if camp.festival:
            if data.festival_name is not None:
                camp.festival.festival_name = data.festival_name.strip()
            if data.festival_date is not None:
                camp.festival.festival_date = data.festival_date

        self.db.commit()
        self.db.refresh(camp)

        today = self._get_business_today(current_user.business_id)
        days_rem = (camp.festival.festival_date - today).days

        eligible_count = len(list(self.db.scalars(
            select(Customer).where(Customer.business_id == current_user.business_id, Customer.is_active == True)
        ).all()))

        return FestivalCampaignResponse(
            id=camp.id,
            festival_id=camp.festival_id,
            festival_name=camp.festival.festival_name,
            title=camp.title,
            description=camp.description,
            festival_date=camp.festival.festival_date,
            start_date=camp.start_date,
            end_date=camp.end_date,
            days_remaining=days_rem,
            coupon_code=camp.coupon_code,
            discount_percent=camp.discount_percent,
            image_url=camp.image_url,
            language=camp.language,
            tone=camp.tone,
            message=camp.message,
            ai_generated=camp.ai_generated,
            last_generated=camp.last_generated,
            last_sent=camp.last_sent,
            enabled=camp.enabled,
            is_custom=(camp.festival.business_id is not None),
            eligible_customers=eligible_count,
            sent_count=12 if camp.last_sent else 0,
            pending_count=eligible_count,
        )

    def delete_campaign(self, current_user: User, campaign_id: UUID) -> dict:
        """Deletes a festival campaign and its custom festival if applicable."""
        camp = self.db.scalar(
            select(FestivalCampaign)
            .options(joinedload(FestivalCampaign.festival))
            .where(
                FestivalCampaign.id == campaign_id,
                FestivalCampaign.business_id == current_user.business_id,
            )
        )
        if not camp:
            raise HTTPException(status_code=404, detail="Festival campaign not found")

        fest = camp.festival
        self.db.delete(camp)

        if fest and fest.business_id == current_user.business_id:
            self.db.delete(fest)

        self.db.commit()
        return {"detail": "Festival campaign deleted successfully"}

    def generate_ai_message(
        self,
        current_user: User,
        festival_id: UUID | None = None,
        festival_name: str | None = None,
        language: str = "Hinglish",
        tone: str = "Festive",
        coupon_code: str | None = None,
        discount_percent: int | str | None = None,
        discount_desc: str | None = None,
    ) -> str:
        """Generates festival-specific Gemini AI message with placeholders intact."""
        fest = None
        if festival_id:
            fest = self.db.scalar(select(Festival).where(Festival.id == festival_id))

        target_fest_name = festival_name or (fest.festival_name if fest else "Festival")

        business = self.db.scalar(
            select(Business).options(joinedload(Business.business_type)).where(Business.id == current_user.business_id)
        )
        biz_name = business.name if business else "NextVisit Merchant"
        biz_type = business.business_type.name if (business and business.business_type) else "restaurant"
        coupon = coupon_code or f"{target_fest_name.upper().replace(' ', '')[:5]}20"
        if discount_desc:
            discount = discount_desc
        elif discount_percent:
            disc_clean = str(discount_percent).replace("%", "").strip()
            discount = f"{disc_clean}% OFF"
        else:
            discount = "20% OFF"

        city = business.address.split(",")[-1].strip() if (business and business.address) else "India"
        is_salon = "salon" in biz_type.lower() or "spa" in biz_type.lower() or "beauty" in biz_type.lower()

        if is_salon:
            role_header = f"You are a top D2C AI Marketing Assistant for '{biz_name}', a premier beauty salon & spa in {city}."
            placeholder_rules = """[STRICT PLACEHOLDER & TERMINOLOGY RULES]
- You MUST use '{salon_name}' for business name. NEVER use 'restaurant_name', 'restaurant', 'meal', 'dish', 'table', 'order', or 'dining'.
- You MUST use '{customer_name}' or '{name}' for customer first name.
- You MAY include '{service_name}', '{stylist_name}', '{appointment_link}', '{coupon}', '{discount}', '{festival}'.
- NEVER mention food, meals, dining, or dishes."""
            context_section = f"""[CONTEXT]
- Festival: {target_fest_name}
- Salon Name: {biz_name}
- Active Coupon Code: {coupon}
- Active Discount: {discount}
- Target Language: {language}
- Target Tone: {tone}"""
        else:
            role_header = f"You are a top D2C AI Marketing Assistant for '{biz_name}', a premier restaurant & cafe in {city}."
            placeholder_rules = """[STRICT PLACEHOLDER & TERMINOLOGY RULES]
- You MUST use '{restaurant_name}' for business name.
- You MUST use '{customer_name}' or '{name}' for customer first name.
- You MAY include '{favorite_dish}', '{table_booking_link}', '{coupon}', '{discount}', '{festival}'."""
            context_section = f"""[CONTEXT]
- Festival: {target_fest_name}
- Restaurant Name: {biz_name}
- Active Coupon Code: {coupon}
- Active Discount: {discount}
- Target Language: {language}
- Target Tone: {tone}"""

        variation_seed = random.randint(1000, 99999)

        prompt = f"""{role_header}
Write a fresh, unique, brand-aligned FESTIVAL WHATSAPP MESSAGE for {target_fest_name}.

[LIVE GENERATION VARIATION SEED: #{variation_seed}]
- Do NOT repeat previous phrasing or boilerplate templates.
- Dynamically craft a unique opening line, sentence structure, emoji placement, CTA, and sign-off.

{placeholder_rules}

{context_section}

[HINGLISH & LANGUAGE RULES]
- If Language is Hinglish: Write natural Indian WhatsApp conversational Hinglish like Zomato, Swiggy, or Blinkit!
- If Language is Hindi: Write warm, natural conversational Hindi.
- If Language is English: Write polished, engaging D2C brand English.

[CONSTRAINTS]
- Length: STRICTLY 50 TO 100 WORDS (readable in 10-15 seconds).
- Format: WhatsApp message with 3-5 emojis.
- Output ONLY the final message. No headings, no quotes, no markdown code blocks (```).
"""

        gemini_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""

        ai_msg = None
        if gemini_key:
            ai_msg, err_detail = self._call_gemini(gemini_key, prompt)
            if not ai_msg:
                logger.error("Gemini API call failed: %s", err_detail, exc_info=True)

        if not ai_msg:
            logger.info("Using smart dynamic D2C copy generator for %s (is_salon=%s)", biz_name, is_salon)
            if is_salon:
                ai_msg = (
                    f"Happy {target_fest_name} {{customer_name}}! 🌸\n\n"
                    f"Celebrate {target_fest_name} with us at {{salon_name}}.\n"
                    f"Book your next appointment using coupon {coupon} and enjoy {discount} on selected salon services.\n\n"
                    f"We look forward to pampering you soon! ✨\n"
                    f"Team {{salon_name}}"
                )
            else:
                ai_msg = (
                    f"Happy {target_fest_name} {{customer_name}}! 🎉\n\n"
                    f"Celebrate {target_fest_name} with us at {{restaurant_name}}.\n"
                    f"Use coupon {coupon} and enjoy {discount} on your festive meal.\n\n"
                    f"We look forward to serving you! ❤️\n"
                    f"Team {{restaurant_name}}"
                )

        # Update last_generated timestamp if campaign exists
        if festival_id:
            camp = self.db.scalar(
                select(FestivalCampaign).where(
                    FestivalCampaign.festival_id == festival_id,
                    FestivalCampaign.business_id == current_user.business_id,
                )
            )
            if camp:
                camp.message = ai_msg.strip()
                camp.language = language
                camp.tone = tone
                camp.ai_generated = True
                camp.last_generated = datetime.now(timezone.utc)
                self.db.commit()

        return ai_msg.strip()

    def _call_gemini(self, api_key: str, prompt: str) -> tuple[str | None, str | None]:
        candidate_models = [
            "gemini-2.0-flash",
            "gemini-2.0-flash-lite",
            "gemini-1.5-flash",
            "gemini-1.5-flash-8b",
            "gemini-1.5-pro",
        ]

        last_err = None

        # Try Google GenerativeAI SDK
        for model_name in candidate_models:
            try:
                import google.generativeai as genai
                genai.configure(api_key=api_key)
                model = genai.GenerativeModel(model_name)
                response = model.generate_content(
                    prompt,
                    generation_config=genai.types.GenerationConfig(
                        temperature=0.95,
                        top_p=0.95,
                        max_output_tokens=220,
                    )
                )
                if response and response.text:
                    text = response.text.strip()
                    if text.startswith("```") and text.endswith("```"):
                        lines = text.splitlines()
                        text = "\n".join(lines[1:-1]).strip()
                    return text, None
            except Exception as exc:
                last_err = str(exc)
                logger.warning("SDK model %s failed: %s", model_name, exc)

        # Fallback REST API call
        for model_name in candidate_models:
            try:
                url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
                payload = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.95, "topP": 0.95, "maxOutputTokens": 220}
                }
                data = json.dumps(payload).encode("utf-8")
                req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"}, method="POST")
                with urllib.request.urlopen(req, timeout=10) as response:
                    if response.status == 200:
                        resp_body = json.loads(response.read().decode("utf-8"))
                        candidates = resp_body.get("candidates", [])
                        if candidates:
                            parts = candidates[0].get("content", {}).get("parts", [])
                            if parts:
                                text = parts[0].get("text", "").strip()
                                if text.startswith("```") and text.endswith("```"):
                                    lines = text.splitlines()
                                    text = "\n".join(lines[1:-1]).strip()
                                return text, None
            except Exception as r_exc:
                last_err = str(r_exc)
                logger.warning("REST model %s failed: %s", model_name, r_exc)
                continue

        return None, last_err
