import smtplib
import ssl
import secrets
import asyncio
import time
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.utils import formatdate, make_msgid
from datetime import datetime, timezone, timedelta
from typing import Optional, Dict, Any

from core.config import get_settings
from db.supabase_client import get_supabase

settings = get_settings()

# In-memory OTP storage fallback (e.g. while Supabase table is being created)
# key: f"{email.lower()}:{purpose}" -> { otp, expires_at, verified, attempts, name, data }
_memory_otps: Dict[str, Dict[str, Any]] = {}


def generate_otp() -> str:
    """Generate a secure 6-digit numeric OTP."""
    return f"{secrets.randbelow(900000) + 100000}"


def _build_html_email(otp: str, purpose_text: str, name: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0b0f19; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="520px" cellpadding="0" cellspacing="0" style="max-width: 520px; background: #131b2e; border: 1px solid rgba(99, 102, 241, 0.25); border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 28px 32px; background: linear-gradient(135deg, rgba(99, 102, 241, 0.2), rgba(168, 85, 247, 0.1)); border-bottom: 1px solid rgba(255,255,255,0.08); text-align: center;">
              <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #ffffff; letter-spacing: 0.5px;">
                🎓 Campus Nexus
              </h1>
              <p style="margin: 4px 0 0; font-size: 13px; color: #a5b4fc; font-weight: 500;">
                Examination & Assessment Portal
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 32px 32px 24px;">
              <p style="margin: 0 0 14px; font-size: 16px; color: #f8fafc; font-weight: 600;">
                Hello {name or 'Student'},
              </p>
              <p style="margin: 0 0 24px; font-size: 14px; line-height: 1.6; color: #94a3b8;">
                Use the One-Time Password (OTP) below to complete your {purpose_text}. This code is valid for <strong>{settings.otp_expire_minutes} minutes</strong>.
              </p>

              <!-- OTP Box -->
              <div style="background: rgba(99, 102, 241, 0.12); border: 1px dashed #6366f1; border-radius: 12px; padding: 18px 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-size: 34px; font-weight: 800; letter-spacing: 8px; color: #ffffff; display: inline-block; font-family: monospace;">
                  {otp}
                </span>
              </div>

              <p style="margin: 0 0 12px; font-size: 13px; color: #64748b; line-height: 1.5;">
                ⚠️ If you did not request this verification code, please ignore this email or notify your system administrator immediately.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background: #0c1222; border-top: 1px solid rgba(255,255,255,0.05); text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #475569;">
                Secured by Campus Nexus Anti-Cheat & Identity Shield
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _send_smtp_sync(to_email: str, subject: str, html_body: str, plain_body: Optional[str] = None) -> bool:
    """
    High-reliability SMTP mail delivery with dual-port failover (465 SSL and 587 STARTTLS) and retries.
    """
    smtp_user = settings.smtp_user.strip()
    raw_pass = (getattr(settings, "smtp_password", "") or getattr(settings, "smtp_pass", "") or "").strip()
    # Google App Passwords have 16 characters often formatted with spaces (e.g. "xxxx xxxx xxxx xxxx")
    smtp_pass = raw_pass.replace(" ", "")

    smtp_host = settings.smtp_host.strip()
    if not smtp_host and "gmail.com" in smtp_user:
        smtp_host = "smtp.gmail.com"

    if not smtp_host or not smtp_user or not smtp_pass:
        print("[EMAIL_SERVICE] Incomplete SMTP credentials. Email dispatch skipped.")
        return False

    sender_email = settings.smtp_from_email.strip() or smtp_user
    sender_name = settings.smtp_from_name or "Campus Nexus"

    # Build RFC-compliant multi-part email
    msg = MIMEMultipart("alternative")
    msg["From"] = f"{sender_name} <{sender_email}>"
    msg["To"] = to_email
    msg["Subject"] = subject
    msg["Date"] = formatdate(localtime=True)
    msg["Message-ID"] = make_msgid(domain=smtp_host if "." in smtp_host else "campusnexus.edu")
    msg["X-Priority"] = "1"
    msg["Importance"] = "high"
    msg["Auto-Submitted"] = "auto-generated"

    if plain_body:
        msg.attach(MIMEText(plain_body, "plain", "utf-8"))
    msg.attach(MIMEText(html_body, "html", "utf-8"))
    msg_str = msg.as_string()

    # Determine primary and fallback ports
    # Direct SSL (465) is generally faster and less susceptible to ISP STARTTLS drops,
    # but we support both 465 and 587 seamlessly.
    configured_port = int(settings.smtp_port) if settings.smtp_port else 465
    ports_to_try = [configured_port]
    if configured_port == 465:
        ports_to_try.append(587)
    else:
        ports_to_try.append(465)

    for port in ports_to_try:
        for attempt in range(1, 3):
            try:
                if port == 465:
                    context = ssl.create_default_context()
                    with smtplib.SMTP_SSL(smtp_host, 465, context=context, timeout=22) as server:
                        server.login(smtp_user, smtp_pass)
                        server.sendmail(sender_email, [to_email], msg_str)
                else:
                    with smtplib.SMTP(smtp_host, port, timeout=22) as server:
                        server.ehlo()
                        if settings.smtp_use_tls:
                            server.starttls(context=ssl.create_default_context())
                            server.ehlo()
                        server.login(smtp_user, smtp_pass)
                        server.sendmail(sender_email, [to_email], msg_str)

                print(f"[EMAIL_SERVICE] Successfully dispatched email to {to_email} via {smtp_host}:{port} (attempt {attempt})")
                return True
            except Exception as e:
                print(f"[EMAIL_SERVICE] SMTP dispatch attempt {attempt} failed on {smtp_host}:{port}: {e}")
                time.sleep(0.5)

    print(f"[EMAIL_SERVICE] All SMTP delivery attempts failed for {to_email}")
    return False


async def send_otp(to_email: str, purpose: str = "signup", name: str = "Student") -> Dict[str, Any]:
    """
    Generates OTP, stores it in Supabase (with in-memory fallback), and dispatches email with automatic retry.
    """
    to_email_clean = to_email.strip().lower()
    otp = generate_otp()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(minutes=settings.otp_expire_minutes)

    # 1. Store in memory fallback
    key = f"{to_email_clean}:{purpose}"
    _memory_otps[key] = {
        "otp": otp,
        "expires_at": expires_at,
        "verified": False,
        "attempts": 0,
        "name": name,
    }

    # 2. Store in Supabase table email_otps if available
    db = get_supabase()
    try:
        db.table("email_otps").insert({
            "email": to_email_clean,
            "otp_code": otp,
            "purpose": purpose,
            "expires_at": expires_at.isoformat(),
            "verified": False,
            "attempts": 0,
        }).execute()
    except Exception as e:
        print(f"[EMAIL_SERVICE] Supabase email_otps note: {e}")

    # 3. Purpose label
    purpose_label = "account registration" if purpose == "signup" else "sign-in verification"
    subject = f"{otp} is your Campus Nexus verification code"
    html_content = _build_html_email(otp, purpose_label, name)
    plain_content = f"Hello {name},\n\nYour Campus Nexus verification code is: {otp}\n\nThis code expires in {settings.otp_expire_minutes} minutes.\nIf you did not request this, please ignore this message."

    # 4. Dispatch email asynchronously with retry
    sent = await asyncio.to_thread(_send_smtp_sync, to_email_clean, subject, html_content, plain_content)

    if not sent:
        print(f"[EMAIL_SERVICE] First cycle unconfirmed for {to_email_clean}. Running immediate fallback...")
        await asyncio.sleep(0.8)
        sent = await asyncio.to_thread(_send_smtp_sync, to_email_clean, subject, html_content, plain_content)

    # Always log to server console for testing/debugging
    print(f"\n=========================================================")
    print(f"  [CAMPUS NEXUS OTP] To: {to_email_clean}")
    print(f"  Purpose: {purpose} | CODE: >>> {otp} <<<")
    print(f"  Delivery: {'Delivered via SMTP' if sent else 'Fallback Console Mode (SMTP error or unconfigured)'}")
    print(f"=========================================================\n")

    return {
        "success": True,
        "email": to_email_clean,
        "purpose": purpose,
        "sent_via_smtp": sent,
        "expires_in_seconds": settings.otp_expire_minutes * 60,
    }


async def verify_otp(email: str, otp: str, purpose: str = "signup") -> bool:
    """
    Validates provided OTP against Supabase or memory store.
    """
    to_email_clean = email.strip().lower()
    input_otp = otp.strip()
    now = datetime.now(timezone.utc)

    # 1. Try checking in Supabase
    db = get_supabase()
    try:
        res = (
            db.table("email_otps")
            .select("*")
            .eq("email", to_email_clean)
            .eq("purpose", purpose)
            .eq("verified", False)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data and len(res.data) > 0:
            row = res.data[0]
            exp_str = row.get("expires_at")
            if exp_str:
                exp_dt = datetime.fromisoformat(exp_str.replace("Z", "+00:00"))
                if now <= exp_dt and row.get("otp_code") == input_otp:
                    # Mark verified
                    try:
                        db.table("email_otps").update({"verified": True}).eq("id", row["id"]).execute()
                    except Exception:
                        pass
                    return True
    except Exception as e:
        print(f"[EMAIL_SERVICE] Supabase verify note: {e}")

    # 2. Check in memory fallback
    key = f"{to_email_clean}:{purpose}"
    entry = _memory_otps.get(key)
    if entry:
        if entry["verified"]:
            return False
        if now > entry["expires_at"]:
            return False
        if entry["otp"] == input_otp:
            entry["verified"] = True
            return True

    return False
