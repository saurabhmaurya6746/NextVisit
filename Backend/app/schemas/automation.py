from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.automation import ScheduleType
from app.models.campaign import CampaignType


class AutomationRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    business_id: UUID
    campaign_type: CampaignType
    is_enabled: bool
    schedule_type: ScheduleType
    run_time: str | None
    last_run_at: datetime | None
    created_at: datetime
    updated_at: datetime


class AutomationRuleUpdate(BaseModel):
    is_enabled: bool | None = None
    schedule_type: ScheduleType | None = None
    run_time: str | None = Field(default=None, max_length=10)


class AutomationRunDetail(BaseModel):
    campaign_type: CampaignType
    campaign_id: UUID
    customers_found: int
    logs_created: int
    duplicates_skipped: int


class AutomationRunResponse(BaseModel):
    business_id: UUID
    rules_evaluated: int
    campaigns_processed: int
    total_logs_created: int
    details: list[AutomationRunDetail]
