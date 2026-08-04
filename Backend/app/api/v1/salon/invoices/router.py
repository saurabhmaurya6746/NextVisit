import logging
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.services.pdf_service import SalonInvoicePdfService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/salon/invoices",
    tags=["Salon Invoices"],
)


@router.get(
    "/{invoice_id}/pdf",
    summary="Download database-driven Salon Invoice PDF",
)
def download_salon_invoice_pdf(
    invoice_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates an official PDF invoice directly from PostgreSQL database records.
    Returns application/pdf binary content for instant browser downloading.
    """
    pdf_bytes, filename = SalonInvoicePdfService(db).generate_pdf_for_visit(current_user, invoice_id)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Access-Control-Expose-Headers": "Content-Disposition",
        },
    )


@router.post(
    "/{invoice_id}/generate-thank-you-whatsapp",
    summary="Generate personalized Salon Thank You WhatsApp Message from PostgreSQL",
)
def generate_salon_thank_you_whatsapp(
    invoice_id: str,
    tone: str | None = "Friendly",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generates a personalized, natural, and professional Thank You WhatsApp message
    based on PostgreSQL appointment data, customer details, and loyalty rewards.
    """
    from app.services.salon_thank_you_service import SalonThankYouMessageService
    return SalonThankYouMessageService(db).generate_thank_you_whatsapp_message(
        current_user=current_user,
        appointment_id_str=invoice_id,
        custom_tone=tone or "Friendly",
    )
