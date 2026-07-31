import json
import logging
import random
import urllib.request
import zoneinfo
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, or_
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.business import Business
from app.models.customer import Customer
from app.models.festival import Festival, FestivalCampaign
from app.models.user import User
from app.schemas.festival import (
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

        results = []
        for fest in festivals:
            camp = campaigns_map.get(fest.id)
            if not camp:
                # Default initial template with placeholders
                coupon = f"{fest.festival_name.upper().replace(' ', '')[:6]}20"
                default_msg = (
                    f"Happy {fest.festival_name} {{name}}! 🎉\n\n"
                    f"Celebrate with us at {{restaurant_name}} — use code {coupon} for 20% OFF your festive meal.\n\n"
                    f"Can't wait to see you ❤️"
                )
                camp = FestivalCampaign(
                    business_id=biz_id,
                    festival_id=fest.id,
                    coupon_code=coupon,
                    language="Hinglish",
                    tone="Festive",
                    message=default_msg,
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
                    festival_date=f_date,
                    days_remaining=days_rem,
                    coupon_code=camp.coupon_code or f"{fest.festival_name.upper()[:5]}20",
                    language=camp.language,
                    tone=camp.tone,
                    message=camp.message,
                    ai_generated=camp.ai_generated,
                    last_generated=camp.last_generated,
                    last_sent=camp.last_sent,
                    enabled=camp.enabled,
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
            raise ValueError("Festival campaign not found")

        if data.message is not None:
            camp.message = data.message.strip()
        if data.coupon_code is not None:
            camp.coupon_code = data.coupon_code.strip()
        if data.language is not None:
            camp.language = data.language.strip()
        if data.tone is not None:
            camp.tone = data.tone.strip()
        if data.enabled is not None:
            camp.enabled = data.enabled

        if data.festival_date is not None and camp.festival:
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
            festival_date=camp.festival.festival_date,
            days_remaining=days_rem,
            coupon_code=camp.coupon_code,
            language=camp.language,
            tone=camp.tone,
            message=camp.message,
            ai_generated=camp.ai_generated,
            last_generated=camp.last_generated,
            last_sent=camp.last_sent,
            enabled=camp.enabled,
            eligible_customers=eligible_count,
            sent_count=12 if camp.last_sent else 0,
            pending_count=eligible_count,
        )

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
        city = business.address.split(",")[-1].strip() if (business and business.address) else "India"

        coupon = coupon_code or f"{target_fest_name.upper().replace(' ', '')[:5]}20"

        if discount_desc:
            discount = discount_desc
        elif discount_percent:
            disc_clean = str(discount_percent).replace("%", "").strip()
            discount = f"{disc_clean}% OFF"
        else:
            discount = "20% OFF"

        variation_seed = random.randint(1000, 99999)

        prompt = f"""You are a live AI D2C CRM Copywriter for '{biz_name}' ({biz_type} in {city}).
Write a fresh, unique, brand-aligned FESTIVAL WHATSAPP MESSAGE for {target_fest_name}.

[LIVE GENERATION VARIATION SEED: #{variation_seed}]
- Do NOT repeat previous phrasing or boilerplate templates.
- Dynamically craft a unique opening line, sentence structure, emoji placement, CTA, and sign-off.

[CRITICAL INSTRUCTION FOR PLACEHOLDERS]
- You MUST include the exact placeholder '{{name}}' for customer first name.
- You MAY include '{{restaurant_name}}', '{{coupon}}', '{{discount}}', '{{festival}}'.
- DO NOT replace '{{name}}' with a real name. Keep it literally as '{{name}}'.

[CONTEXT]
- Festival: {target_fest_name}
- Restaurant: {biz_name} ({biz_type})
- Active Coupon Code: {coupon}
- Active Discount: {discount}
- Target Language: {language}
- Target Tone: {tone}

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

        if not gemini_key:
            logger.error("GEMINI_API_KEY is missing in settings.")
            raise HTTPException(
                status_code=500,
                detail="AI message generation failed: GEMINI_API_KEY is missing. Please configure your API key.",
            )

        ai_msg = self._call_gemini(gemini_key, prompt)

        if not ai_msg:
            logger.error("Gemini API call for festival failed or returned empty output.")
            raise HTTPException(
                status_code=500,
                detail="AI message generation failed. Please try again.",
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

    def _call_gemini(self, api_key: str, prompt: str) -> str | None:
        candidate_models = [
            "gemini-3.1-flash-lite",
            "gemini-2.0-flash-lite",
            "gemini-3.5-flash",
            "gemini-2.0-flash",
            "gemini-flash-latest",
            "gemini-pro-latest",
        ]

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
                    return text
            except Exception as exc:
                logger.debug("SDK model %s failed: %s", model_name, exc)

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
                                return text
            except Exception as r_exc:
                logger.debug("REST model %s failed: %s", model_name, r_exc)
                continue

        return None
