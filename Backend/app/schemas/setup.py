from pydantic import BaseModel, Field


class AreaSetupItem(BaseModel):
    name: str = Field(..., min_length=1, max_length=100, example="Main Hall")
    count: int = Field(..., ge=1, le=100, example=4)


class AreaSetupResponse(BaseModel):
    message: str
    areas_created: int
    tables_created: int
