from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class AiGenerateMessageRequest(BaseModel):
    customer_id: UUID | None = None
    campaign_type: str = Field(default="welcome", description="welcome, birthday, anniversary, festival, recovery, review, vip, loyalty, coupon")
    tone: str | None = Field(default="Friendly", description="Funny, Cute, Emotional, Friendly, Premium, Playful, Festival vibe, Casual, Luxury, Minimal")
    timing: str | None = Field(default="birthday_morning", description="30_days_before, 15_days_before, 7_days_before, 3_days_before, 1_day_before, birthday_morning, birthday_evening, 1_day_after, 3_days_after")
    language: str | None = Field(default="auto", description="auto, hinglish, english, hindi")
    message_length: str | None = Field(default="medium", description="short (40-60 words), medium (60-90 words), long (90-120 words)")
    coupon_code: str | None = None
    discount_percent: str | int | None = None
    coupon_expiry: str | None = None
    festival_name: str | None = None


class AiGenerateMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    message: str
    tone: str
    campaign_type: str
    customer_name: str
    is_ai_generated: bool = True
