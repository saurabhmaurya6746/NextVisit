from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class VipSettingsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    min_lifetime_spend: float = Field(default=10000.0, ge=0.0)
    min_visits: int = Field(default=15, ge=0)
    min_avg_bill: float = Field(default=0.0, ge=0.0)
    last_visit_within_days: int | None = Field(default=None)
    rule_logic: str = Field(default="ANY", description="ANY (OR) or ALL (AND)")
    is_active: bool = True
    formatted_rule_display: str = ""
    created_at: datetime
    updated_at: datetime


class VipSettingsUpdate(BaseModel):
    min_lifetime_spend: float = Field(default=10000.0, ge=0.0)
    min_visits: int = Field(default=15, ge=0)
    min_avg_bill: float = Field(default=0.0, ge=0.0)
    last_visit_within_days: int | None = Field(default=None)
    rule_logic: str = Field(default="ANY", description="ANY (OR) or ALL (AND)")
    is_active: bool = True
