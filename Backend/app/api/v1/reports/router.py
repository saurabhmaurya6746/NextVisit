import logging

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.reports import ReportsAnalyticsResponse
from app.services.reports_service import ReportsService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/reports",
    tags=["Reports & Analytics"],
)


@router.get(
    "",
    response_model=ReportsAnalyticsResponse,
    summary="Get 100% database-driven analytics for Reports dashboard",
)
def get_reports_analytics(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReportsService(db)
    return svc.get_reports_analytics(current_user)


@router.get(
    "/pdf",
    summary="Download PDF performance report for business",
)
def download_pdf_report(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReportsService(db)
    pdf_buffer = svc.export_pdf_report(current_user)

    filename = f"Business_Analytics_Report.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
