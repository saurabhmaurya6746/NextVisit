from pydantic import BaseModel


class PaymentQRUploadResponse(BaseModel):
    payment_qr_image: str
    message: str
