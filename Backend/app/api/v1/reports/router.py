import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.reports import (
    BiReportsAnalyticsResponse,
    ReportFilterOptionsResponse,
    ReportFilterParams,
)
from app.services.reports_service import ReportsService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/reports",
    tags=["Reports & Analytics"],
)


def get_report_filters(
    date_range: str = Query(default="this_month", description="today | yesterday | last_7_days | last_30_days | this_month | last_month | custom"),
    start_date: Optional[str] = Query(default=None),
    end_date: Optional[str] = Query(default=None),
    payment_method: Optional[str] = Query(default="all"),
    booking_source: Optional[str] = Query(default="all"),
    staff_id: Optional[str] = Query(default=None),
    service_area_id: Optional[str] = Query(default=None),
    chair_id: Optional[str] = Query(default=None),
    customer_type: Optional[str] = Query(default="all"),
    membership: Optional[str] = Query(default="all"),
    campaign_type: Optional[str] = Query(default="all"),
    status: Optional[str] = Query(default="all"),
) -> ReportFilterParams:
    return ReportFilterParams(
        date_range=date_range,
        start_date=start_date,
        end_date=end_date,
        payment_method=payment_method,
        booking_source=booking_source,
        staff_id=staff_id,
        service_area_id=service_area_id,
        chair_id=chair_id,
        customer_type=customer_type,
        membership=membership,
        campaign_type=campaign_type,
        status=status,
    )


@router.get(
    "",
    response_model=BiReportsAnalyticsResponse,
    summary="Get 100% database-driven Business Intelligence analytics",
)
def get_bi_reports(
    filters: ReportFilterParams = Depends(get_report_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReportsService(db)
    return svc.get_bi_reports_analytics(current_user, filters)


@router.get(
    "/filter-options",
    response_model=ReportFilterOptionsResponse,
    summary="Get dynamic filter dropdown options (staff, service areas, chairs)",
)
def get_filter_options(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReportsService(db)
    return svc.get_filter_options(current_user)


@router.get(
    "/pdf",
    summary="Download PDF BI Analytics report",
)
def download_pdf_report(
    filters: ReportFilterParams = Depends(get_report_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReportsService(db)
    pdf_buffer = svc.export_pdf_report(current_user, filters)

    filename = f"BI_Analytics_Report_{filters.date_range}.pdf"
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/excel",
    summary="Download Excel (.xlsx) BI Analytics report",
)
def download_excel_report(
    filters: ReportFilterParams = Depends(get_report_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReportsService(db)
    excel_buffer = svc.export_excel_report(current_user, filters)

    filename = f"BI_Analytics_Report_{filters.date_range}.xlsx"
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.get(
    "/csv",
    summary="Download CSV BI Analytics report",
)
def download_csv_report(
    filters: ReportFilterParams = Depends(get_report_filters),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    svc = ReportsService(db)
    csv_io = svc.export_csv_report(current_user, filters)

    filename = f"BI_Analytics_Report_{filters.date_range}.csv"
    return Response(
        content=csv_io.getvalue(),
        media_type="text/csv",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )
