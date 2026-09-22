import logging
import requests
from fastapi import HTTPException, status

from app.core.config import settings

logger = logging.getLogger(__name__)

BREVO_API_URL = "https://api.brevo.com/v3/smtp/email"


class BrevoService:
    """
    Dedicated service for sending transactional emails via Brevo (Sendinblue) API.
    Isolated strictly for registration OTP verification.
    """

    def __init__(self):
        self.api_key = settings.BREVO_API_KEY
        self.sender_email = settings.BREVO_SENDER_EMAIL
        self.sender_name = settings.BREVO_SENDER_NAME

    def send_otp_email(self, to_email: str, otp: str, to_name: str | None = None) -> bool:
        """
        Send a 6-digit verification code to the given recipient using Brevo's REST API.
        Never logs the plaintext OTP or exposes the API key.
        """
        headers = {
            "accept": "application/json",
            "api-key": self.api_key,
            "content-type": "application/json",
        }

        recipient_name = to_name.strip() if to_name else to_email

        html_content = f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Verification Code</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f6f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f4f6f8;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:540px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:32px 32px 20px 32px;background:linear-gradient(135deg, #18181b 0%, #27272a 100%);text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;letter-spacing:-0.5px;">NextVisit</h1>
              <p style="margin:6px 0 0 0;color:#a1a1aa;font-size:13px;">Grow Customer Retention & Loyalty</p>
            </td>
          </tr>
          <tr>
            <td style="padding:36px 32px 28px 32px;">
              <h2 style="margin:0 0 12px 0;font-size:20px;font-weight:600;color:#18181b;">Verify your email address</h2>
              <p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#52525b;">
                Hi {recipient_name},<br><br>
                Thank you for registering your business with NextVisit. Please use the 6-digit verification code below to verify your account:
              </p>
              <div style="background:#f8fafc;border:2px dashed #cbd5e1;border-radius:12px;padding:20px;text-align:center;margin:0 0 24px 0;">
                <span style="font-family:Consolas,Monaco,monospace;font-size:36px;font-weight:700;letter-spacing:10px;color:#0f172a;display:inline-block;padding-left:10px;">
                  {otp}
                </span>
              </div>
              <p style="margin:0 0 8px 0;font-size:13px;line-height:1.5;color:#71717a;">
                This code will expire in <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>. For security reasons, please do not share this code with anyone.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#a1a1aa;">
                If you did not attempt to sign up for NextVisit, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px;background:#fafafa;border-top:1px solid #f4f4f5;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                &copy; NextVisit Platform. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
"""

        text_content = (
            f"Hello {recipient_name},\n\n"
            f"Your NextVisit email verification code is: {otp}\n\n"
            f"This code will expire in {settings.OTP_EXPIRE_MINUTES} minutes.\n"
            "If you did not request this, please ignore this email."
        )

        payload = {
            "sender": {
                "name": self.sender_name,
                "email": self.sender_email,
            },
            "to": [
                {
                    "email": to_email,
                    "name": recipient_name,
                }
            ],
            "subject": f"{otp} is your NextVisit verification code",
            "htmlContent": html_content,
            "textContent": text_content,
        }

        if not self.api_key:
            logger.error("Brevo API key is not configured. Cannot send OTP.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email delivery service is currently not configured. Please set BREVO_API_KEY in environment variables.",
            )

        if not self.sender_email:
            logger.error("Brevo sender email is not configured. Cannot send OTP.")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Email sender address is not configured.",
            )

        try:
            logger.info("Sending OTP verification email via Brevo | recipient=%s", to_email)
            response = requests.post(
                BREVO_API_URL,
                json=payload,
                headers=headers,
                timeout=10,
            )

            if response.status_code in (200, 201, 202):
                logger.info("Brevo OTP email successfully accepted | recipient=%s status=%s", to_email, response.status_code)
                return True
            else:
                logger.error(
                    "Brevo API error response | status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                error_msg = ""
                try:
                    err_json = response.json()
                    error_msg = err_json.get("message", "")
                except Exception:
                    error_msg = response.text[:200]

                if response.status_code == 401:
                    detail = "Brevo API authentication failed ('Key not found'). Please ensure your BREVO_API_KEY in .env is an API v3 Key (starts with 'xkeysib-'), not an SMTP key (starts with 'xsmtpsib-')."
                elif response.status_code == 400 and "sender" in response.text.lower():
                    detail = "Brevo sender email is not verified. Please verify your sender in the Brevo dashboard."
                elif error_msg:
                    detail = f"Email delivery failed ({response.status_code}): {error_msg}"
                else:
                    detail = f"Failed to send verification code (Brevo status {response.status_code}). Please try again later."

                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=detail,
                )

        except HTTPException:
            raise

        except requests.RequestException as e:
            logger.error("Network error while connecting to Brevo API: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Unable to reach email delivery service: {str(e)}",
            ) from e

        except Exception as e:
            logger.exception("Unexpected error while sending email via Brevo: %s", str(e))
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail=f"Email delivery service failed: {str(e)}",
            ) from e

