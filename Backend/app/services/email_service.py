import logging
from datetime import datetime, timezone
import resend

from app.core.config import settings

logger = logging.getLogger(__name__)


class EmailService:
    """
    Transactional email service powered by Resend API.
    Handles admin and customer notifications safely with robust error isolation.
    """

    @classmethod
    def is_configured(cls) -> bool:
        """Check if Resend API key is configured."""
        return bool(settings.RESEND_API_KEY and settings.RESEND_API_KEY.strip())

    @classmethod
    def send_resend_email(
        cls,
        to: str | list[str],
        subject: str,
        html: str,
        text: str | None = None,
    ) -> tuple[bool, str | None]:
        """
        Low-level safe email sender using Resend API.
        Never throws exceptions to caller; returns (success: bool, error_message: str | None).
        """
        if not cls.is_configured():
            err_msg = "RESEND_API_KEY is not configured."
            logger.warning("Resend email dispatch skipped: %s", err_msg)
            return False, err_msg

        try:
            resend.api_key = settings.RESEND_API_KEY.strip()

            recipient_list = [to] if isinstance(to, str) else list(to)
            clean_recipients = [r.strip() for r in recipient_list if r and r.strip()]

            if not clean_recipients:
                err_msg = "No valid recipients provided."
                logger.warning("Resend email dispatch skipped: %s", err_msg)
                return False, err_msg

            params: resend.Emails.SendParams = {
                "from": settings.RESEND_FROM_EMAIL or "NextVisit <onboarding@resend.dev>",
                "to": clean_recipients,
                "subject": subject,
                "html": html,
            }
            if text:
                params["text"] = text

            response = resend.Emails.send(params)
            email_id = getattr(response, "id", None) or (response.get("id") if isinstance(response, dict) else str(response))
            logger.info(
                "Resend email delivered successfully | subject='%s' recipients=%s id=%s",
                subject,
                clean_recipients,
                email_id,
            )
            return True, None

        except Exception as exc:
            err_msg = str(exc)
            logger.error(
                "Failed to send email notification: %s | subject='%s' to=%s",
                err_msg,
                subject,
                clean_recipients if 'clean_recipients' in locals() else to,
            )
            return False, err_msg

    @classmethod
    def send_new_signup_notification(
        cls,
        business_name: str,
        owner_name: str,
        owner_email: str,
        business_type: str,
        signup_time: datetime | str | None = None,
        business_id: str | None = None,
    ) -> tuple[bool, str | None]:
        """
        Send notification to NextVisit Super Admin when a new merchant registers.
        """
        admin_email = settings.NEXTVISIT_ADMIN_EMAIL or "saurabhmauryajnp28@gmail.com"
        subject = "New NextVisit Signup - Approval Required"

        if isinstance(signup_time, datetime):
            formatted_time = signup_time.strftime("%d %b %Y, %I:%M %p UTC")
        elif isinstance(signup_time, str):
            formatted_time = signup_time
        else:
            formatted_time = datetime.now(timezone.utc).strftime("%d %b %Y, %I:%M %p UTC")

        biz_id_str = str(business_id) if business_id else "N/A"
        biz_type_str = str(business_type).capitalize() if business_type else "Business"

        text_content = f"""New NextVisit Signup - Approval Required

A new business has registered on NextVisit and is awaiting administrator approval.

Signup Details:
---------------------------------------------
• Business Name : {business_name}
• Business Type : {biz_type_str}
• Owner Name    : {owner_name}
• Owner Email   : {owner_email}
• Signup Time   : {formatted_time}
• Business ID   : {biz_id_str}
---------------------------------------------

Action Required:
Please log in to the NextVisit Super Admin Portal to review and approve or reject this merchant account.

Best regards,
NextVisit System
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: #ffffff; padding: 24px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }}
    .content {{ padding: 24px; }}
    .alert-box {{ background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 6px; margin-bottom: 20px; color: #1e40af; font-size: 14px; }}
    .details-table {{ width: 100%; border-collapse: collapse; margin-top: 16px; }}
    .details-table td {{ padding: 10px 12px; font-size: 14px; border-bottom: 1px solid #f1f5f9; }}
    .details-table td.label {{ color: #64748b; font-weight: 600; width: 38%; }}
    .details-table td.value {{ color: #0f172a; font-weight: 500; }}
    .footer {{ background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>New NextVisit Registration</h1>
    </div>
    <div class="content">
      <div class="alert-box">
        <strong>Approval Required:</strong> A new business account has been created and is waiting for your review.
      </div>
      <table class="details-table">
        <tr>
          <td class="label">Business Name</td>
          <td class="value"><strong>{business_name}</strong></td>
        </tr>
        <tr>
          <td class="label">Business Type</td>
          <td class="value">{biz_type_str}</td>
        </tr>
        <tr>
          <td class="label">Owner Name</td>
          <td class="value">{owner_name}</td>
        </tr>
        <tr>
          <td class="label">Owner Email</td>
          <td class="value"><a href="mailto:{owner_email}" style="color:#2563eb; text-decoration:none;">{owner_email}</a></td>
        </tr>
        <tr>
          <td class="label">Signup Time</td>
          <td class="value">{formatted_time}</td>
        </tr>
        <tr>
          <td class="label">Business ID</td>
          <td class="value"><code style="background:#f1f5f9; padding:2px 6px; border-radius:4px; font-size:12px;">{biz_id_str}</code></td>
        </tr>
      </table>
    </div>
    <div class="footer">
      NextVisit Automated Notification · Manage approvals via the Super Admin Dashboard
    </div>
  </div>
</body>
</html>"""

        return cls.send_resend_email(
            to=admin_email,
            subject=subject,
            html=html_content,
            text=text_content,
        )

    @classmethod
    def send_account_approved_email(
        cls,
        owner_email: str,
        owner_name: str,
        business_name: str,
        login_url: str | None = None,
    ) -> tuple[bool, str | None]:
        """
        Send welcome and approval confirmation email to merchant owner once approved by admin.
        """
        subject = "Your NextVisit Account Has Been Approved 🎉"
        resolved_login_url = (
            login_url or f"{settings.FRONTEND_URL.rstrip('/')}/login"
        )
        safe_name = owner_name.strip() if owner_name else "Merchant"

        text_content = f"""Hi {safe_name},

Great news! Your NextVisit account has been approved.

You can now log in and start using NextVisit to manage your business and grow repeat customers.

Login: {resolved_login_url}

Best regards,
NextVisit Team
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 28px 24px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.025em; }}
    .content {{ padding: 32px 24px; }}
    .greeting {{ font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }}
    .paragraph {{ font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 16px; }}
    .btn-container {{ text-align: center; margin: 28px 0; }}
    .btn {{ display: inline-block; background: #10b981; color: #ffffff !important; padding: 12px 32px; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 8px; box-shadow: 0 2px 4px rgba(16,185,129,0.2); }}
    .footer {{ background: #f8fafc; padding: 20px 24px; border-top: 1px solid #e2e8f0; font-size: 13px; color: #64748b; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Account Approved 🎉</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {safe_name},</div>
      <p class="paragraph">
        Great news! Your NextVisit account for <strong>{business_name}</strong> has been approved.
      </p>
      <p class="paragraph">
        You can now log in and start using NextVisit to manage your business and grow repeat customers.
      </p>
      <div class="btn-container">
        <a href="{resolved_login_url}" class="btn">Log In to NextVisit</a>
      </div>
      <p class="paragraph" style="font-size:13px; color:#64748b; margin-top:20px;">
        Or navigate to: <a href="{resolved_login_url}" style="color:#2563eb;">{resolved_login_url}</a>
      </p>
      <p class="paragraph" style="margin-top:24px;">
        Best regards,<br>
        <strong>NextVisit Team</strong>
      </p>
    </div>
    <div class="footer">
      © NextVisit · Empowering local businesses to grow repeat customers
    </div>
  </div>
</body>
</html>"""

        return cls.send_resend_email(
            to=owner_email,
            subject=subject,
            html=html_content,
            text=text_content,
        )

    @classmethod
    def send_account_rejected_email(
        cls,
        owner_email: str,
        owner_name: str,
        business_name: str,
        reason: str | None = None,
    ) -> tuple[bool, str | None]:
        """
        Send professional status update email to merchant owner if registration was rejected.
        """
        subject = "Update Regarding Your NextVisit Account"
        safe_name = owner_name.strip() if owner_name else "Merchant"
        reason_text = f"\nReason: {reason.strip()}\n" if reason and reason.strip() else ""
        reason_html = f"""<div style="background:#fef2f2; border-left:4px solid #ef4444; padding:12px 16px; border-radius:6px; margin:16px 0; color:#991b1b; font-size:14px;"><strong>Feedback from Administrator:</strong><br>{reason.strip()}</div>""" if reason and reason.strip() else ""

        text_content = f"""Hi {safe_name},

Thank you for your interest in NextVisit.

We regret to inform you that your business account registration for {business_name} could not be approved at this time.{reason_text}
If you believe this is a mistake or if you would like to submit updated information, please reach out to our support team.

Best regards,
NextVisit Team
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background: #475569; color: #ffffff; padding: 24px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 20px; font-weight: 700; letter-spacing: -0.025em; }}
    .content {{ padding: 28px 24px; }}
    .greeting {{ font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 16px; }}
    .paragraph {{ font-size: 15px; line-height: 1.6; color: #334155; margin-bottom: 16px; }}
    .footer {{ background: #f8fafc; padding: 16px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NextVisit Account Update</h1>
    </div>
    <div class="content">
      <div class="greeting">Hi {safe_name},</div>
      <p class="paragraph">
        Thank you for your interest in NextVisit.
      </p>
      <p class="paragraph">
        We regret to inform you that your business account registration for <strong>{business_name}</strong> could not be approved at this time.
      </p>
      {reason_html}
      <p class="paragraph">
        If you believe this was an error or would like to provide updated documentation, please contact our support team.
      </p>
      <p class="paragraph" style="margin-top:24px;">
        Best regards,<br>
        <strong>NextVisit Team</strong>
      </p>
    </div>
    <div class="footer">
      © NextVisit · Support & Account Management
    </div>
  </div>
</body>
</html>"""

        return cls.send_resend_email(
            to=owner_email,
            subject=subject,
            html=html_content,
            text=text_content,
        )

    @classmethod
    def send_password_reset_email(
        cls,
        to_email: str,
        user_name: str,
        reset_url: str,
        expires_in_minutes: int = 45,
    ) -> tuple[bool, str | None]:
        """
        Send a secure password reset email with action link and token expiration.
        """
        subject = "Reset Your NextVisit Password"
        safe_name = user_name.strip() if user_name else "NextVisit User"

        text_content = f"""Reset Your NextVisit Password

Hello {safe_name},

We received a request to reset the password for your NextVisit account.

To choose a new password, click the link below or copy and paste it into your browser:
{reset_url}

This link is valid for {expires_in_minutes} minutes.

If you did not request a password reset, you can safely ignore this email. Your password will not change.

Best regards,
The NextVisit Team
"""

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your NextVisit Password</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; background-color: #f8fafc; margin: 0; padding: 24px; }}
    .container {{ max-width: 580px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }}
    .header {{ background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: #ffffff; padding: 28px 24px; text-align: center; }}
    .header h1 {{ margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.025em; }}
    .header p {{ margin: 6px 0 0 0; font-size: 13px; opacity: 0.9; }}
    .content {{ padding: 28px 24px; }}
    .greeting {{ font-size: 16px; font-weight: 600; color: #0f172a; margin-bottom: 12px; }}
    .paragraph {{ font-size: 14px; line-height: 1.6; color: #475569; margin: 0 0 16px 0; }}
    .btn-container {{ text-align: center; margin: 28px 0; }}
    .btn {{ display: inline-block; background: linear-gradient(135deg, #0ea5e9 0%, #3b82f6 100%); color: #ffffff !important; text-decoration: none; padding: 14px 32px; border-radius: 9999px; font-size: 14px; font-weight: 600; letter-spacing: 0.025em; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }}
    .fallback-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin: 20px 0; font-size: 12px; word-break: break-all; color: #64748b; }}
    .fallback-link {{ color: #2563eb; text-decoration: underline; }}
    .security-note {{ background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; border-radius: 6px; margin-top: 24px; font-size: 12px; color: #166534; line-height: 1.5; }}
    .footer {{ background: #f8fafc; padding: 18px 24px; border-top: 1px solid #e2e8f0; font-size: 12px; color: #94a3b8; text-align: center; line-height: 1.5; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>NextVisit Security</h1>
      <p>Password Reset Request</p>
    </div>
    <div class="content">
      <div class="greeting">Hello {safe_name},</div>
      <p class="paragraph">
        We received a request to reset your password for your NextVisit account. Click the button below to choose a new password:
      </p>
      
      <div class="btn-container">
        <a href="{reset_url}" class="btn" target="_blank">Reset Password</a>
      </div>

      <p class="paragraph" style="font-size: 12px; color: #64748b;">
        If the button above does not work, copy and paste this link into your web browser:
      </p>
      <div class="fallback-box">
        <a href="{reset_url}" class="fallback-link" target="_blank">{reset_url}</a>
      </div>

      <div class="security-note">
        <strong>Security Notice:</strong> This reset link will expire in <strong>{expires_in_minutes} minutes</strong> and can only be used once. If you did not request this password reset, you can safely ignore this email — your account remains secure.
      </div>

      <p class="paragraph" style="margin-top: 24px;">
        Best regards,<br>
        <strong>The NextVisit Team</strong>
      </p>
    </div>
    <div class="footer">
      © NextVisit SaaS Platform · Customer Growth & Automation<br>
      This is an automated security notification.
    </div>
  </div>
</body>
</html>"""

        return cls.send_resend_email(
            to=to_email,
            subject=subject,
            html=html_content,
            text=text_content,
        )


email_service = EmailService()

