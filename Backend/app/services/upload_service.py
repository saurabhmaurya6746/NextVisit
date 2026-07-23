import logging
import os
import uuid

from fastapi import HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from app.models.user import User
from app.schemas.business_settings import BusinessSettingsUpdate
from app.schemas.upload import PaymentQRUploadResponse
from app.services.business_settings_service import BusinessSettingsService

logger = logging.getLogger(__name__)

ALLOWED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".webp"}
ALLOWED_CONTENT_TYPES = {
    "image/png",
    "image/jpeg",
    "image/pjpeg",
    "image/webp",
}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB


class UploadService:

    def __init__(self, db: Session):
        self.db = db
        self.settings_service = BusinessSettingsService(db)

    def upload_payment_qr(
        self, current_user: User, file: UploadFile
    ) -> PaymentQRUploadResponse:
        filename = file.filename or ""
        ext = os.path.splitext(filename)[1].lower()

        logger.info(
            "Payment QR upload attempt | business_id=%s filename=%s content_type=%s",
            current_user.business_id,
            filename,
            file.content_type,
        )

        # 1. Validate file extension
        if ext not in ALLOWED_EXTENSIONS:
            logger.warning(
                "Upload rejected — invalid file extension | business_id=%s ext=%s",
                current_user.business_id,
                ext,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Allowed formats: PNG, JPG, JPEG, WEBP.",
            )

        # 2. Validate content type if available
        if (
            file.content_type
            and file.content_type.lower() not in ALLOWED_CONTENT_TYPES
        ):
            logger.warning(
                "Upload rejected — invalid content type | business_id=%s content_type=%s",
                current_user.business_id,
                file.content_type,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid file type. Allowed formats: PNG, JPG, JPEG, WEBP.",
            )

        # 3. Read file content and validate size
        file.file.seek(0, os.SEEK_END)
        file_size = file.file.tell()
        file.file.seek(0)

        if file_size > MAX_FILE_SIZE_BYTES:
            logger.warning(
                "Upload rejected — file size exceeds 5 MB | business_id=%s size=%s",
                current_user.business_id,
                file_size,
            )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="File size exceeds maximum limit of 5 MB.",
            )

        if file_size == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Uploaded file is empty.",
            )

        content = file.file.read()

        # 4. Prepare directory and save file
        dir_path = os.path.join("uploads", str(current_user.business_id), "payment-qr")
        os.makedirs(dir_path, exist_ok=True)

        unique_filename = f"qr_{uuid.uuid4().hex}{ext}"
        full_filepath = os.path.join(dir_path, unique_filename)

        with open(full_filepath, "wb") as f:
            f.write(content)

        # Uniform relative path with forward slashes
        relative_filepath = f"uploads/{current_user.business_id}/payment-qr/{unique_filename}"

        logger.info(
            "Payment QR saved successfully | business_id=%s path=%s size=%s",
            current_user.business_id,
            relative_filepath,
            file_size,
        )

        # 5. Update BusinessSettings in database
        self.settings_service.update_settings(
            current_user,
            BusinessSettingsUpdate(payment_qr_image=relative_filepath),
        )

        return PaymentQRUploadResponse(
            payment_qr_image=relative_filepath,
            message="Payment QR image uploaded successfully.",
        )
