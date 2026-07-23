import logging

from fastapi import APIRouter, Depends, File, UploadFile, status
from sqlalchemy.orm import Session

from app.core.dependencies import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.upload import PaymentQRUploadResponse
from app.services.upload_service import UploadService

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/uploads",
    tags=["Uploads"],
)


@router.post(
    "/payment-qr",
    response_model=PaymentQRUploadResponse,
    status_code=status.HTTP_200_OK,
    summary="Upload Payment QR code image for authenticated business",
)
def upload_payment_qr(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Uploads Payment QR code image (PNG, JPG, JPEG, WEBP, max 5 MB).
    Saves file under /uploads/{business_id}/payment-qr/ and updates
    payment_qr_image in BusinessSettings.
    Requires a valid Bearer JWT.
    """
    return UploadService(db).upload_payment_qr(current_user, file)
