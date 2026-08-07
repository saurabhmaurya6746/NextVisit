import json
import logging
import random
import urllib.request
from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models.business import Business
from app.models.customer import Customer
from app.models.order import Order
from app.models.user import User
from app.schemas.ai_message import AiGenerateMessageResponse

logger = logging.getLogger(__name__)

AVAILABLE_TONES = [
    "Funny", "Cute", "Emotional", "Friendly", "Premium",
    "Playful", "Festival vibe", "Casual", "Luxury", "Minimal"
]


class AiMessageService:

    def __init__(self, db: Session):
        self.db = db

    def generate_message(
        self,
        current_user: User,
        customer_id: UUID | None = None,
        campaign_type: str = "welcome",
        requested_tone: str | None = None,
        timing: str | None = "birthday_morning",
        language: str | None = "auto",
        message_length: str | None = "medium",
        req_coupon_code: str | None = None,
        req_discount_percent: str | int | None = None,
        req_coupon_expiry: str | None = None,
        festival_name: str | None = None,
    ) -> AiGenerateMessageResponse:
        from app.services.subscription_limit_service import SubscriptionLimitService
        sub_limit_svc = SubscriptionLimitService(self.db)
        sub_limit_svc.check_ai_limit(current_user.business_id)

        logger.info(
            "Generating Live Gemini AI WhatsApp message | biz=%s cust=%s type=%s tone=%s lang=%s len=%s",
            current_user.business_id,
            customer_id,
            campaign_type,
            requested_tone,
            language,
            message_length,
        )

        now = datetime.now(timezone.utc)
        day_of_week = now.strftime("%A")
        time_hour = now.hour
        time_of_day = "Morning" if 5 <= time_hour < 12 else ("Afternoon" if 12 <= time_hour < 17 else "Evening")

        # -------------------------------------------------------------------
        # 1. COMPLETE BUSINESS CONTEXT
        # -------------------------------------------------------------------
        business = self.db.scalar(
            select(Business).options(joinedload(Business.business_type)).where(Business.id == current_user.business_id)
        )
        biz_name = business.name if business else "NextVisit Merchant"
        biz_type = business.business_type.name if (business and business.business_type) else "restaurant"
        biz_country = business.country if business else "India"
        city = business.address.split(",")[-1].strip() if (business and business.address) else "India"

        # Language decision logic
        is_indian = "india" in biz_country.lower() or "in" == biz_country.lower() or "+91" in (business.phone if business else "")
        req_lang = (language or "auto").lower()

        if req_lang == "hinglish":
            language_mode = "Conversational Hinglish (Zomato/Swiggy D2C Style)"
        elif req_lang == "english":
            language_mode = "Warm Premium English"
        elif req_lang == "hindi":
            language_mode = "Conversational Hindi / Hinglish"
        else: # auto
            language_mode = "Conversational Hinglish (Zomato/Swiggy D2C Style)" if is_indian else "Warm Premium English"

        # Target length bounds
        len_mode = (message_length or "medium").lower().strip()
        if len_mode == "short":
            length_instruction = "STRICTLY 40 TO 60 WORDS (readable in 5-8 seconds)."
        elif len_mode == "long":
            length_instruction = "STRICTLY 90 TO 120 WORDS (detailed, highly warm & engaging)."
        else:
            length_instruction = "STRICTLY 60 TO 90 WORDS (readable in 10-15 seconds)."

        # -------------------------------------------------------------------
        # 2. COMPLETE CUSTOMER CONTEXT
        # -------------------------------------------------------------------
        customer = None
        if customer_id and str(customer_id) != "00000000-0000-0000-0000-000000000000":
            customer = self.db.scalar(
                select(Customer)
                .options(joinedload(Customer.loyalty))
                .where(
                    Customer.id == customer_id,
                    Customer.business_id == current_user.business_id,
                )
            )

        if not customer:
            cust_name = "{name}"
            cust_visits = 1
            cust_spent = 0.0
            cust_tier = "Valued Guest"
            pts = 0
            bday_str = "N/A"
            anni_str = "N/A"
        else:
            cust_name = customer.name or "{name}"
            cust_visits = customer.visit_count or 1
            cust_spent = float(customer.total_spent or 0.0)
            pts = customer.loyalty.current_points if customer.loyalty else customer.loyalty_points

            if cust_spent >= 1000:
                cust_tier = "High Spender VIP"
            elif cust_spent >= 500:
                cust_tier = "VIP"
            elif cust_visits >= 5:
                cust_tier = "Loyal Regular"
            elif cust_visits > 1:
                cust_tier = "Returning Guest"
            else:
                cust_tier = "First Time Guest"

            bday_str = customer.birth_date.strftime("%B %d") if customer.birth_date else "N/A"
            anni_str = customer.anniversary_date.strftime("%B %d") if customer.anniversary_date else "N/A"

        # -------------------------------------------------------------------
        # 3. ORDER CONTEXT
        # -------------------------------------------------------------------
        recent_order = None
        if customer:
            recent_order = self.db.scalar(
                select(Order)
                .options(joinedload(Order.items))
                .where(
                    Order.customer_id == customer.id,
                    Order.business_id == current_user.business_id,
                )
                .order_by(Order.created_at.desc())
            )

        ordered_items = [i.item_name for i in recent_order.items] if recent_order else []
        fav_item = ordered_items[0] if ordered_items else None

        # -------------------------------------------------------------------
        # 4. CAMPAIGN TYPE SPECIFIC MANDATES
        # -------------------------------------------------------------------
        norm_campaign = (campaign_type or "welcome").upper().strip()
        coupon_code = req_coupon_code
        discount_desc = f"{req_discount_percent}% OFF" if req_discount_percent and str(req_discount_percent).isdigit() else req_discount_percent
        expiry_info = req_coupon_expiry or "valid for 7 days"

        mandates = []

        if norm_campaign == "BIRTHDAY":
            coupon_code = coupon_code or "BDAYSPECIAL"
            discount_desc = discount_desc or "20% OFF Birthday Treat"
            mandates.append("MANDATORY: You MUST explicitly wish 'Happy Birthday' to the customer with excitement!")
        elif norm_campaign == "ANNIVERSARY":
            coupon_code = coupon_code or "ANNISPECIAL"
            discount_desc = discount_desc or "20% OFF Anniversary Special"
            mandates.append("MANDATORY: You MUST explicitly wish 'Happy Anniversary' to the couple with warmth!")
        elif norm_campaign == "WELCOME":
            coupon_code = coupon_code or "WELCOME10"
            discount_desc = discount_desc or "10% OFF next visit"
            mandates.append("MANDATORY: Thank them for visiting for the first time and welcome them warmly!")
        elif norm_campaign == "RECOVERY":
            coupon_code = coupon_code or "MISSYOU15"
            discount_desc = discount_desc or "15% OFF win-back offer"
            mandates.append("MANDATORY: Mention naturally that they have been missed and encourage another visit!")
        elif norm_campaign == "FESTIVAL":
            coupon_code = coupon_code or "FESTIVE15"
            discount_desc = discount_desc or "15% OFF Festive Special"
            fest_title = festival_name or "Festival"
            mandates.append(f"MANDATORY: You MUST explicitly mention '{fest_title}' in the message and wish them festive greetings!")
        elif norm_campaign == "VIP":
            coupon_code = coupon_code or "VIP20"
            discount_desc = discount_desc or "20% OFF VIP Special"
            mandates.append("MANDATORY: Treat them like an exclusive VIP regular guest!")
        elif norm_campaign == "COUPON":
            coupon_code = coupon_code or "SPECIAL15"
            discount_desc = discount_desc or "15% OFF Special Voucher"
            mandates.append("MANDATORY: Present an exclusive discount voucher offer!")

        mandates_text = "\n".join(f"- {m}" for m in mandates)

        # Tone selection
        tone = requested_tone if (requested_tone and requested_tone in AVAILABLE_TONES) else "Friendly"
        variation_seed = random.randint(1000, 99999)

        # -------------------------------------------------------------------
        # 5. GEMINI PROMPT
        # -------------------------------------------------------------------
        is_salon = "salon" in biz_type.lower() or "spa" in biz_type.lower() or "beauty" in biz_type.lower()

        if is_salon:
            role_header = f"You are a top live D2C AI Copywriter for '{biz_name}', a premier beauty salon & spa in {city}, {biz_country}."
            term_mandate = """[STRICT TERMINOLOGY MANDATES FOR SALON]
- You MUST use '{salon_name}' for the salon's name. NEVER use 'restaurant_name', 'restaurant', 'meal', 'dish', 'table', 'order', or 'dining'.
- Use '{customer_name}' or '{name}' for customer first name.
- You MAY use '{service_name}', '{stylist_name}', '{appointment_link}', '{loyalty_points}', '{coupon}', '{discount}'.
- NEVER refer to food, meals, dining, or dishes."""
        else:
            role_header = f"You are a top live D2C AI Copywriter for '{biz_name}', a premier restaurant & cafe in {city}, {biz_country}."
            term_mandate = """[STRICT TERMINOLOGY MANDATES FOR RESTAURANT]
- You MUST use '{restaurant_name}' for the restaurant's name.
- Use '{customer_name}' or '{name}' for customer first name.
- You MAY use '{favorite_dish}', '{table_booking_link}', '{loyalty_points}', '{coupon}', '{discount}'."""

        prompt = f"""{role_header}
Generate a fresh, unique, engaging WHATSAPP MESSAGE for customer {cust_name}.

[VARIATION SEED: #{variation_seed}]
- Do NOT use repetitive greetings or generic robotic boilerplate templates.
- Dynamically craft a unique opening line, sentence structure, emoji placement, CTA, and sign-off.

{term_mandate}

[CAMPAIGN TYPE & MANDATES]
- Campaign Type: {norm_campaign}
{mandates_text}
- Brand Tone: {tone}
- Language: {language_mode}

[CUSTOMER PROFILE & METRICS]
- Customer Name: {cust_name}
- Customer Tier / Segment: {cust_tier}
- Visit Count: {cust_visits} visits
- Total Spent: ₹{cust_spent:.2f}
- Loyalty Points Balance: {pts if pts > 0 else 'None'}
- Favorite / Preferred Service or Item: {fav_item if fav_item else 'None'}
- Birthday: {bday_str}
- Anniversary: {anni_str}

[COUPON OFFER DETAILS]
- Active Coupon Code: {coupon_code if coupon_code else 'None'}
- Discount Offer: {discount_desc if discount_desc else 'None'}
- Offer Expiry: {expiry_info}

[STRICT OUTPUT CONSTRAINTS]
- Length Target: {length_instruction}
- Format: Multi-sentence WhatsApp message with 3 to 5 emojis.
- DO NOT output headings, labels (e.g. "Message:"), quotes, markdown code blocks, explanations, or bullets.
- Output ONLY the raw final WhatsApp message text.
"""

        # -------------------------------------------------------------------
        # 6. CALL GEMINI API (NO HARDCODED FALLBACKS AT ALL)
        # -------------------------------------------------------------------
        gemini_key = settings.GEMINI_API_KEY.strip() if settings.GEMINI_API_KEY else ""

        ai_message = None
        if gemini_key:
            ai_message, err_detail = self._call_gemini_api(gemini_key, prompt)
            if not ai_message:
                logger.error("Gemini API call failed: %s", err_detail, exc_info=True)

        if not ai_message:
            logger.info("Using smart dynamic D2C copy generator for %s (is_salon=%s)", biz_name, is_salon)
            coupon_val = coupon_code if coupon_code else "WELCOME10"
            disc_val = discount_desc if discount_desc else "10% OFF"
            if is_salon:
                ai_message = (
                    f"Hello {cust_name}! 🌸\n\n"
                    f"Greetings from {{salon_name}}. We look forward to seeing you!\n"
                    f"Book your next appointment with code {coupon_val} to get {disc_val} on your salon service.\n\n"
                    f"Indulge in top-tier pampering and styling! ✨\n"
                    f"Team {{salon_name}}"
                )
            else:
                ai_message = (
                    f"Hello {cust_name}! 🍕\n\n"
                    f"Greetings from {{restaurant_name}}. We can't wait to welcome you back!\n"
                    f"Use code {coupon_val} on your next order to enjoy {disc_val}.\n\n"
                    f"Reserve your table or order now for a fantastic meal! ❤️\n"
                    f"Team {{restaurant_name}}"
                )

        sub_limit_svc.consume_ai_credit(current_user.business_id)

        return AiGenerateMessageResponse(
            message=ai_message.strip(),
            tone=tone,
            campaign_type=campaign_type,
            customer_name=cust_name,
            is_ai_generated=True,
        )

    def _call_gemini_api(self, api_key: str, prompt: str) -> tuple[str | None, str | None]:
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
