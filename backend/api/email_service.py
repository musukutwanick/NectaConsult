import os
import logging
import threading
from django.core.mail import EmailMultiAlternatives
from django.conf import settings
from django.utils.html import strip_tags

logger = logging.getLogger(__name__)

# Primary Brand Colors: Blue (#263682 - matching Navbar), Yellow (#FED41F), White (#FFFFFF)
PRIMARY_BLUE = "#263682"
SECONDARY_YELLOW = "#FED41F"
TEXT_DARK = "#2C3E50"
BG_LIGHT = "#F4F7F9"

def render_nectacare_html(title, recipient_name, content_html, button_text=None, button_url=None):
    """
    Renders a responsive, HTML email layout with official NectaCare logo branding.
    """
    button_html = ""
    if button_text and button_url:
        button_html = f"""
        <div style="text-align: center; margin: 30px 0 20px 0;">
            <a href="{button_url}" target="_blank" style="background-color: {PRIMARY_BLUE}; color: #ffffff; padding: 14px 28px; font-size: 15px; font-weight: bold; text-decoration: none; border-radius: 6px; display: inline-block; box-shadow: 0 3px 6px rgba(38, 54, 130, 0.3);">
                {button_text}
            </a>
        </div>
        """

    html = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>{title}</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: {BG_LIGHT}; color: {TEXT_DARK}; -webkit-font-smoothing: antialiased;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: {BG_LIGHT}; padding: 20px 0;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.08);">
                        <!-- Header Banner with Logo -->
                        <tr>
                            <td style="background-color: {PRIMARY_BLUE}; padding: 24px 30px; text-align: center; border-bottom: 4px solid {SECONDARY_YELLOW};">
                                <img src="https://nectacare.co.zw/nectacare-logo.png" alt="NectaCare Logo" style="max-height: 56px; width: auto; height: auto; border: 0; display: inline-block; vertical-align: middle;" />
                            </td>
                        </tr>
                        <!-- Subheader Accent Bar -->
                        <tr>
                            <td style="background-color: {SECONDARY_YELLOW}; height: 4px; padding: 0;"></td>
                        </tr>
                        <!-- Main Content Container -->
                        <tr>
                            <td style="padding: 35px 35px 25px 35px; background-color: #ffffff;">
                                <h2 style="color: {PRIMARY_BLUE}; font-size: 20px; font-weight: 700; margin-top: 0; margin-bottom: 20px; border-bottom: 2px solid #F0F4F8; padding-bottom: 10px;">
                                    {title}
                                </h2>
                                <p style="font-size: 15px; line-height: 1.6; color: {TEXT_DARK}; margin-bottom: 20px;">
                                    Dear <strong>{recipient_name}</strong>,
                                </p>
                                <div style="font-size: 15px; line-height: 1.6; color: {TEXT_DARK};">
                                    {content_html}
                                </div>
                                {button_html}
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #F8FAFC; padding: 25px 35px; border-top: 1px solid #EAEFF5; text-align: center; font-size: 12px; color: #7F8C8D;">
                                <p style="margin: 0 0 6px 0; font-weight: 700; color: {PRIMARY_BLUE}; font-size: 13px;">NectaCare Healthcare Solutions</p>
                                <p style="margin: 0 0 10px 0; color: #5A6A85;">Providing seamless digital consultation services & virtual healthcare.</p>
                                <p style="margin: 0 0 8px 0; font-size: 12.5px;">Need support? Contact us at <a href="mailto:necta-consult@nectacare.co.zw" style="color: {PRIMARY_BLUE}; font-weight: bold; text-decoration: none;">necta-consult@nectacare.co.zw</a></p>
                                <p style="margin: 0 0 12px 0; font-size: 12px; color: #475569;">
                                    <strong>Call Us:</strong> <a href="tel:08677200200" style="color: {PRIMARY_BLUE}; text-decoration: none; font-weight: 600;">08677 200 200</a> &nbsp;|&nbsp; 
                                    <strong>Econet Toll-Free:</strong> <a href="tel:08080015" style="color: {PRIMARY_BLUE}; text-decoration: none; font-weight: 600;">08080 015</a> &bull; <a href="tel:08080221" style="color: {PRIMARY_BLUE}; text-decoration: none; font-weight: 600;">08080 221</a>
                                </p>
                                <div style="font-size: 11px; color: #BDC3C7; margin-top: 12px; border-top: 1px dashed #E2E8F0; padding-top: 10px;">
                                    &copy; 2026 NectaCare. All rights reserved. Confidential healthcare communication.
                                </div>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

    return html


def send_via_ms_graph(subject, recipient_list, html_content, text_content=None):
    """
    Sends email via Microsoft Graph API using MSAL and client credentials (OAuth2 Mail.Send).
    Sender mailbox: nectaconsult@nectacare.co.zw
    """
    tenant_id = getattr(settings, 'AZURE_TENANT_ID', '').strip()
    client_id = getattr(settings, 'AZURE_CLIENT_ID', '').strip()
    client_secret = getattr(settings, 'AZURE_CLIENT_SECRET', '').strip()
    sender_email = getattr(settings, 'GRAPH_SENDER_EMAIL', 'nectaconsult@nectacare.co.zw').strip()

    if not tenant_id or not client_id or not client_secret:
        return False

    try:
        import msal
        import requests

        authority = f"https://login.microsoftonline.com/{tenant_id}"
        app = msal.ConfidentialClientApplication(
            client_id,
            authority=authority,
            client_credential=client_secret
        )

        token_result = app.acquire_token_for_client(
            scopes=["https://graph.microsoft.com/.default"]
        )

        if "access_token" not in token_result:
            error_desc = token_result.get("error_description", "Token acquisition failed")
            logger.error(f"[MS GRAPH API TOKEN ERROR] {error_desc}")
            print(f"[MS GRAPH API TOKEN ERROR] {error_desc}")
            return False

        access_token = token_result["access_token"]

        to_recipients = [{"emailAddress": {"address": email.strip()}} for email in recipient_list if email]
        if not to_recipients:
            return False

        email_data = {
            "message": {
                "subject": subject,
                "body": {
                    "contentType": "HTML",
                    "content": html_content
                },
                "toRecipients": to_recipients
            },
            "saveToSentItems": "true"
        }

        endpoint = f"https://graph.microsoft.com/v1.0/users/{sender_email}/sendMail"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json"
        }

        response = requests.post(endpoint, headers=headers, json=email_data, timeout=15)
        if response.status_code in (200, 202):
            logger.info(f"[MS GRAPH API EMAIL SENT] '{subject}' to {recipient_list} from {sender_email}")
            print(f"[MS GRAPH API OK] Sent '{subject}' to {recipient_list} via {sender_email}")
            return True
        else:
            logger.error(f"[MS GRAPH API HTTP ERROR {response.status_code}] {response.text}")
            print(f"[MS GRAPH API ERROR {response.status_code}] {response.text}")
            return False
    except Exception as e:
        logger.error(f"[MS GRAPH API EXCEPTION] {e}")
        print(f"[MS GRAPH API EXCEPTION] {e}")
        return False


def _send_email_async(subject, recipient_list, html_content, text_content=None):
    """
    Internal non-blocking email dispatch helper.
    Tries Microsoft Graph API first if credentials are set; falls back to Django Email backend (SMTP/Console).
    """
    def task():
        # 1. Try sending via Microsoft Graph API first
        sent_via_graph = send_via_ms_graph(subject, recipient_list, html_content, text_content)
        if sent_via_graph:
            return

        # 2. Fallback to standard Django Email Backend (SMTP or console)
        try:
            default_sender = getattr(settings, 'GRAPH_SENDER_EMAIL', 'nectaconsult@nectacare.co.zw')
            from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', f'NectaCare <{default_sender}>')
            plain_text = text_content or strip_tags(html_content)
            
            msg = EmailMultiAlternatives(
                subject=subject,
                body=plain_text,
                from_email=from_email,
                to=recipient_list
            )
            msg.attach_alternative(html_content, "text/html")
            
            msg.send(fail_silently=False)
            logger.info(f"[EMAIL SERVICE] Successfully sent email '{subject}' to {recipient_list}")
            print(f"[EMAIL SERVICE OK] Sent '{subject}' to {recipient_list}")
        except Exception as e:
            logger.error(f"[EMAIL SERVICE ERROR] Failed sending '{subject}' to {recipient_list}: {str(e)}")
            print(f"[EMAIL SERVICE ERROR] Failed to send email '{subject}' to {recipient_list}: {str(e)}")

    thread = threading.Thread(target=task)
    thread.daemon = True
    thread.start()



# ==========================================
# 1. Patient Registration Emails
# ==========================================

def send_patient_welcome_email(user, profile):
    """Send welcome email immediately after successful registration."""
    if not user.email:
        return
    subject = "Welcome to NectaCare - Registration Received"
    recipient_name = user.get_full_name() or user.username
    membership_num = profile.medical_aid_number or "N/A"
    
    content = f"""
    <p>Thank you for registering with <strong>NectaCare</strong>. Your patient account has been successfully created.</p>
    <div style="background-color: #F4F8FA; border-left: 4px solid {PRIMARY_BLUE}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Patient Name:</strong> {recipient_name}</p>
        <p style="margin: 0 0 6px 0;"><strong>Membership Number:</strong> {membership_num}</p>
        <p style="margin: 0;"><strong>Account Status:</strong> Pending Administrator Verification</p>
    </div>
    <p>Our administration team is reviewing your CellMed membership details. You will receive an email once your account is fully activated.</p>
    """
    html = render_nectacare_html(
        title="Welcome to NectaCare",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Visit NectaConsult",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [user.email], html)


def send_patient_activation_email(user, profile):
    """Send email when administrator approves pending registration."""
    if not user.email:
        return
    subject = "Account Activated - NectaCare Telehealth"
    recipient_name = user.get_full_name() or user.username
    
    content = f"""
    <p>Great news! Your NectaCare account registration has been <strong>approved and activated</strong> by our administration team.</p>
    <div style="background-color: #E8F8F5; border-left: 4px solid #2ECC71; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; color: #1E8449;"><strong>Status:</strong> Active & Verified</p>
        <p style="margin: 0; color: #1E8449;">You now have full access to schedule virtual consultations with NectaCare doctors.</p>
    </div>
    <p>Click the button below to log in and start booking appointments.</p>
    """
    html = render_nectacare_html(
        title="Your Account is Now Active!",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Log In Now",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [user.email], html)


def send_patient_rejection_email(user, profile, reason):
    """Send email when administrator rejects registration."""
    if not user.email:
        return
    subject = "NectaCare Account Registration Update"
    recipient_name = user.get_full_name() or user.username
    
    content = f"""
    <p>We are writing to inform you regarding your account registration on NectaCare.</p>
    <div style="background-color: #FDEDEC; border-left: 4px solid #E74C3C; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; color: #C0392B;"><strong>Registration Status:</strong> Could Not Be Approved</p>
        <p style="margin: 0; color: #C0392B;"><strong>Reason:</strong> {reason or 'Details mismatch or membership inactive'}</p>
    </div>
    <p>If you believe this is an error or require assistance updating your CellMed membership records, please contact our support team at <strong>support@nectacare.co.za</strong> or call +27 800 632 822.</p>
    """
    html = render_nectacare_html(
        title="Account Registration Update",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Contact Support",
        button_url="mailto:support@nectacare.co.za"
    )
    _send_email_async(subject, [user.email], html)


# ==========================================
# 2. Appointment Booking Emails
# ==========================================

def send_appointment_booked_patient_email(appointment):
    """Send confirmation to patient when an appointment request is submitted."""
    patient_user = appointment.patient.user
    if not patient_user.email:
        return
    
    subject = f"Appointment Request Submitted - Ref #{appointment.id}"
    recipient_name = patient_user.get_full_name() or patient_user.username
    doctor_name = appointment.doctor.title or f"Dr. {appointment.doctor.user.get_full_name()}"
    specialty = appointment.doctor.specialty or "General Practitioner"
    
    content = f"""
    <p>Your appointment request has been successfully submitted and is awaiting confirmation.</p>
    <div style="background-color: #F4F8FA; border-left: 4px solid {PRIMARY_BLUE}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Reference Number:</strong> NC-APP-{appointment.id}</p>
        <p style="margin: 0 0 6px 0;"><strong>Doctor:</strong> {doctor_name}</p>
        <p style="margin: 0 0 6px 0;"><strong>Specialty:</strong> {specialty}</p>
        <p style="margin: 0 0 6px 0;"><strong>Date:</strong> {appointment.date}</p>
        <p style="margin: 0 0 6px 0;"><strong>Time Slot:</strong> {appointment.time_label}</p>
        <p style="margin: 0;"><strong>Consultation Type:</strong> Video Telehealth</p>
    </div>
    <p>You will receive a notification once the doctor accepts the appointment.</p>
    """
    html = render_nectacare_html(
        title="Appointment Request Submitted",
        recipient_name=recipient_name,
        content_html=content,
        button_text="View Appointment Details",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [patient_user.email], html)


def send_appointment_booked_doctor_email(appointment):
    """Send email to doctor informing them of a new appointment request."""
    doctor_user = appointment.doctor.user
    if not doctor_user.email:
        return
    
    subject = f"New Consultation Request - Patient {appointment.patient.user.get_full_name()}"
    recipient_name = appointment.doctor.title or f"Dr. {doctor_user.get_full_name()}"
    patient_name = appointment.patient.user.get_full_name() or appointment.patient.user.username
    
    content = f"""
    <p>You have received a new consultation request on NectaCare.</p>
    <div style="background-color: #FFF9E6; border-left: 4px solid {SECONDARY_YELLOW}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Patient Name:</strong> {patient_name}</p>
        <p style="margin: 0 0 6px 0;"><strong>Reason:</strong> {appointment.reason or 'General Consultation'}</p>
        <p style="margin: 0 0 6px 0;"><strong>Requested Date:</strong> {appointment.date}</p>
        <p style="margin: 0;"><strong>Time Slot:</strong> {appointment.time_label}</p>
    </div>
    <p>Please log in to your dashboard to review and confirm or reschedule this appointment.</p>
    """
    html = render_nectacare_html(
        title="New Consultation Request Received",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Review Appointment",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [doctor_user.email], html)


# ==========================================
# 3. Appointment Approval / Rejection Emails
# ==========================================

def send_appointment_approved_email(appointment):
    """Send appointment confirmation email to patient when doctor accepts."""
    patient_user = appointment.patient.user
    if not patient_user.email:
        return
    
    subject = f"Appointment Confirmed - Dr. {appointment.doctor.user.last_name} ({appointment.date})"
    recipient_name = patient_user.get_full_name() or patient_user.username
    doctor_name = appointment.doctor.title or f"Dr. {appointment.doctor.user.get_full_name()}"
    
    content = f"""
    <p>Good news! Your upcoming consultation has been <strong>accepted and confirmed</strong> by {doctor_name}.</p>
    <div style="background-color: #E8F8F5; border-left: 4px solid #2ECC71; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Doctor:</strong> {doctor_name} ({appointment.doctor.specialty or 'General Practitioner'})</p>
        <p style="margin: 0 0 6px 0;"><strong>Date:</strong> {appointment.date}</p>
        <p style="margin: 0 0 6px 0;"><strong>Time:</strong> {appointment.time_label}</p>
        <p style="margin: 0;"><strong>Status:</strong> Confirmed</p>
    </div>
    <p>Please ensure you are logged into your NectaCare account 5 minutes before your scheduled appointment time.</p>
    """
    html = render_nectacare_html(
        title="Appointment Confirmed!",
        recipient_name=recipient_name,
        content_html=content,
        button_text="View Scheduled Appointment",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [patient_user.email], html)


def send_appointment_rejected_email(appointment, reason=""):
    """Send email to patient when appointment is declined."""
    patient_user = appointment.patient.user
    if not patient_user.email:
        return
    
    subject = f"Appointment Request Declined - Ref #{appointment.id}"
    recipient_name = patient_user.get_full_name() or patient_user.username
    doctor_name = appointment.doctor.title or f"Dr. {appointment.doctor.user.get_full_name()}"
    
    content = f"""
    <p>We regret to inform you that your requested appointment with <strong>{doctor_name}</strong> for <strong>{appointment.date} ({appointment.time_label})</strong> could not be scheduled.</p>
    <div style="background-color: #FDEDEC; border-left: 4px solid #E74C3C; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0; color: #C0392B;"><strong>Status:</strong> Declined</p>
        <p style="margin: 0; color: #C0392B;"><strong>Reason:</strong> {reason or 'Doctor unavailable at the requested time slot'}</p>
    </div>
    <p>We encourage you to log in and select another available time slot or doctor.</p>
    """
    html = render_nectacare_html(
        title="Appointment Request Update",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Select New Time Slot",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [patient_user.email], html)


# ==========================================
# 4. Appointment Reminders
# ==========================================

def send_appointment_reminder_email(appointment, timeframe):
    """Send reminder email 24h or 1h before appointment."""
    patient_user = appointment.patient.user
    if not patient_user.email:
        return
    
    timeframe_label = "24 Hours" if timeframe == '24h' else "1 Hour"
    subject = f"Reminder: Consultation in {timeframe_label} with {appointment.doctor.title or 'your Doctor'}"
    recipient_name = patient_user.get_full_name() or patient_user.username
    doctor_name = appointment.doctor.title or f"Dr. {appointment.doctor.user.get_full_name()}"
    
    content = f"""
    <p>This is a quick reminder that your virtual consultation is scheduled in <strong>{timeframe_label}</strong>.</p>
    <div style="background-color: #F4F8FA; border-left: 4px solid {PRIMARY_BLUE}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Doctor:</strong> {doctor_name}</p>
        <p style="margin: 0 0 6px 0;"><strong>Date:</strong> {appointment.date}</p>
        <p style="margin: 0 0 6px 0;"><strong>Time Slot:</strong> {appointment.time_label}</p>
        <p style="margin: 0;"><strong>Preparation:</strong> Ensure a stable internet connection, camera, and quiet environment.</p>
    </div>
    <p>Click below to join the consultation room directly when your time slot arrives.</p>
    """
    html = render_nectacare_html(
        title=f"Upcoming Consultation Reminder ({timeframe_label})",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Join Consultation Room",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [patient_user.email], html)


# ==========================================
# 5. Consultation Started & Completed Emails
# ==========================================

def send_consultation_started_email(appointment):
    """Send email when doctor starts consultation."""
    patient_user = appointment.patient.user
    if not patient_user.email:
        return
    
    subject = f"Consultation Started - Join Dr. {appointment.doctor.user.last_name} Now"
    recipient_name = patient_user.get_full_name() or patient_user.username
    doctor_name = appointment.doctor.title or f"Dr. {appointment.doctor.user.get_full_name()}"
    
    content = f"""
    <p><strong>{doctor_name}</strong> has started your scheduled consultation room.</p>
    <p style="font-size: 16px; margin: 20px 0;">Please click the button below to join the live video consultation immediately.</p>
    """
    html = render_nectacare_html(
        title="Your Consultation Has Started!",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Enter Live Consultation",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [patient_user.email], html)


def send_consultation_completed_email(appointment, has_prescription=False):
    """Send summary email when doctor completes consultation."""
    patient_user = appointment.patient.user
    if not patient_user.email:
        return
    
    subject = f"Consultation Summary Available - Dr. {appointment.doctor.user.last_name}"
    recipient_name = patient_user.get_full_name() or patient_user.username
    doctor_name = appointment.doctor.title or f"Dr. {appointment.doctor.user.get_full_name()}"
    
    rx_text = "<p style='margin: 8px 0 0 0; color: #1C75BC;'><strong>Prescription:</strong> A new prescription was issued during this consultation.</p>" if has_prescription else ""
    
    content = f"""
    <p>Your telehealth consultation with <strong>{doctor_name}</strong> on <strong>{appointment.date}</strong> has been successfully completed.</p>
    <div style="background-color: #F4F8FA; border-left: 4px solid {PRIMARY_BLUE}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Status:</strong> Consultation Completed</p>
        <p style="margin: 0;"><strong>Medical Records & Notes:</strong> Consultation notes have been updated in your profile.</p>
        {rx_text}
    </div>
    <p>You can access your medical records, doctor's notes, and prescription details anytime from your dashboard.</p>
    """
    html = render_nectacare_html(
        title="Consultation Completed",
        recipient_name=recipient_name,
        content_html=content,
        button_text="View Medical Records",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [patient_user.email], html)


# ==========================================
# 6. Prescription Created Email
# ==========================================

def send_prescription_created_email(prescription):
    """Send email when doctor issues a prescription."""
    patient_user = prescription.patient.user
    if not patient_user.email:
        return
    
    subject = "New Prescription Issued - NectaCare"
    recipient_name = patient_user.get_full_name() or patient_user.username
    doctor_name = prescription.doctor.title or f"Dr. {prescription.doctor.user.get_full_name()}"
    
    content = f"""
    <p>A new prescription has been issued for you by <strong>{doctor_name}</strong>.</p>
    <div style="background-color: #FFF9E6; border-left: 4px solid {SECONDARY_YELLOW}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Title:</strong> {prescription.title}</p>
        <p style="margin: 0 0 6px 0;"><strong>Medication:</strong> {prescription.medication}</p>
        <p style="margin: 0 0 6px 0;"><strong>Dosage:</strong> {prescription.dosage}</p>
        <p style="margin: 0;"><strong>Notes:</strong> {prescription.renewal_note or 'Follow dosage instructions as directed.'}</p>
    </div>
    <p>Your medication details are ready to view. You can view, download, or print your official prescription from the NectaCare portal.</p>
    """
    html = render_nectacare_html(
        title="New Prescription Issued",
        recipient_name=recipient_name,
        content_html=content,
        button_text="View & Print Prescription",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [patient_user.email], html)


# ==========================================
# 7. Password Management Emails
# ==========================================

def send_password_reset_email(user, token_code, expires_in_minutes=60):
    """Send secure password reset link to user."""
    if not user.email:
        return
    
    subject = "Security Alert: Password Reset Request - NectaCare"
    recipient_name = user.get_full_name() or user.username
    reset_url = f"http://localhost:5173/?reset_token={token_code}&username={user.username}"
    
    content = f"""
    <p>We received a request to reset the password for your NectaCare account (Username: <strong>{user.username}</strong>).</p>
    <p>Click the button below to set a new password. This reset link will expire in <strong>{expires_in_minutes} minutes</strong>.</p>
    <div style="background-color: #FDEDEC; border-left: 4px solid #E74C3C; padding: 15px; border-radius: 4px; margin: 20px 0; font-size: 13px; color: #C0392B;">
        <strong>Security Warning:</strong> If you did not request a password reset, please ignore this email or contact support immediately. Never share your password or reset link with anyone.
    </div>
    """
    html = render_nectacare_html(
        title="Reset Your Password",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Reset Password Now",
        button_url=reset_url
    )
    _send_email_async(subject, [user.email], html)


def send_password_changed_email(user):
    """Send confirmation email after password update."""
    if not user.email:
        return
    
    subject = "Account Security: Password Successfully Updated"
    recipient_name = user.get_full_name() or user.username
    
    content = f"""
    <p>This email confirms that the password for your NectaCare account (<strong>{user.username}</strong>) was successfully updated.</p>
    <div style="background-color: #E8F8F5; border-left: 4px solid #2ECC71; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0; color: #1E8449;">Your password has been changed securely. If you made this change, no further action is required.</p>
    </div>
    <p>If you did not perform this change, please contact NectaCare Security immediately at <strong>support@nectacare.co.za</strong>.</p>
    """
    html = render_nectacare_html(
        title="Password Updated Successfully",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Go to NectaCare",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [user.email], html)


# ==========================================
# 8. Doctor & Admin Account Emails
# ==========================================

def send_doctor_account_created_email(user, temp_password):
    """Send credentials to newly created doctor account."""
    if not user.email:
        return
    
    subject = "Welcome to NectaCare - Your Doctor Account Credentials"
    recipient_name = f"Dr. {user.get_full_name()}" if user.get_full_name() else user.username
    
    content = f"""
    <p>An administrator has created a doctor practitioner account for you on the NectaCare Telehealth platform.</p>
    <div style="background-color: #F4F8FA; border-left: 4px solid {PRIMARY_BLUE}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Username:</strong> {user.username}</p>
        <p style="margin: 0 0 6px 0;"><strong>Temporary Password:</strong> <code style="background: #E2E8F0; padding: 2px 6px; border-radius: 4px; font-weight: bold;">{temp_password}</code></p>
        <p style="margin: 0;"><strong>Requirement:</strong> You will be prompted to set a new password upon your first login.</p>
    </div>
    <p>Please click below to log in and set up your consultation availability.</p>
    """
    html = render_nectacare_html(
        title="Doctor Account Created",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Log In to Doctor Portal",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [user.email], html)


def send_admin_new_patient_email(admin_emails, patient_profile):
    """Notify administrators of a new patient registration."""
    if not admin_emails:
        return
    
    subject = f"Admin Alert: New Patient Registration - {patient_profile.user.get_full_name()}"
    patient_name = patient_profile.user.get_full_name() or patient_profile.user.username
    
    content = f"""
    <p>A new patient has registered on NectaCare and requires CellMed membership verification.</p>
    <div style="background-color: #FFF9E6; border-left: 4px solid {SECONDARY_YELLOW}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Patient Name:</strong> {patient_name}</p>
        <p style="margin: 0 0 6px 0;"><strong>Membership Number:</strong> {patient_profile.medical_aid_number}</p>
        <p style="margin: 0 0 6px 0;"><strong>Email:</strong> {patient_profile.user.email or 'N/A'}</p>
        <p style="margin: 0;"><strong>Phone:</strong> {patient_profile.phone or 'N/A'}</p>
    </div>
    <p>Please review and verify their benefit status in the Administrator Dashboard.</p>
    """
    html = render_nectacare_html(
        title="New Patient Pending Verification",
        recipient_name="Administrator",
        content_html=content,
        button_text="Open Admin Dashboard",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, admin_emails, html)


def send_admin_new_doctor_email(admin_emails, doctor_profile):
    """Notify administrators when a new doctor account is registered."""
    if not admin_emails:
        return
    
    subject = f"Admin Alert: New Doctor Practitioner Account - {doctor_profile.title}"
    doc_name = doctor_profile.title or doctor_profile.user.get_full_name() or doctor_profile.user.username
    
    content = f"""
    <p>A new doctor account has been registered on the NectaCare platform.</p>
    <div style="background-color: #F4F8FA; border-left: 4px solid {PRIMARY_BLUE}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Doctor Name:</strong> {doc_name}</p>
        <p style="margin: 0 0 6px 0;"><strong>Specialty:</strong> {doctor_profile.specialty or 'General Practitioner'}</p>
        <p style="margin: 0 0 6px 0;"><strong>Email (OTP):</strong> {doctor_profile.user.email or 'N/A'}</p>
        <p style="margin: 0;"><strong>Phone:</strong> {doctor_profile.phone or 'N/A'}</p>
    </div>
    """
    html = render_nectacare_html(
        title="New Doctor Account Created",
        recipient_name="Administrator",
        content_html=content,
        button_text="Open Admin Dashboard",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, admin_emails, html)


def send_admin_appointment_request_email(admin_emails, appointment):
    """Notify administrators when a new appointment is booked."""
    if not admin_emails:
        return
    
    subject = f"Admin Alert: New Appointment Request - Patient {appointment.patient.user.get_full_name()}"
    
    content = f"""
    <p>A new consultation request has been submitted on the platform.</p>
    <div style="background-color: #F4F8FA; border-left: 4px solid {PRIMARY_BLUE}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>Patient:</strong> {appointment.patient.user.get_full_name()} ({appointment.patient.medical_aid_number})</p>
        <p style="margin: 0 0 6px 0;"><strong>Doctor:</strong> {appointment.doctor.title}</p>
        <p style="margin: 0 0 6px 0;"><strong>Date & Time:</strong> {appointment.date} at {appointment.time_label}</p>
        <p style="margin: 0;"><strong>Reason:</strong> {appointment.reason}</p>
    </div>
    """
    html = render_nectacare_html(
        title="New Appointment Request",
        recipient_name="Administrator",
        content_html=content,
        button_text="Open Admin Dashboard",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, admin_emails, html)


# ==========================================
# 9. Security & System Admin Emails
# ==========================================

def send_sysadmin_critical_error_email(sysadmin_emails, error_message, details=""):
    """Notify system administrators of critical backend errors."""
    if not sysadmin_emails:
        return
    
    subject = "CRITICAL ALERT: System Error Occurred - NectaCare Platform"
    
    content = f"""
    <p>A critical system exception was recorded on the NectaConsult backend server.</p>
    <div style="background-color: #FDEDEC; border-left: 4px solid #E74C3C; padding: 15px; border-radius: 4px; margin: 20px 0; font-family: monospace; font-size: 13px;">
        <p style="margin: 0 0 6px 0; color: #C0392B;"><strong>Error Message:</strong> {error_message}</p>
        <p style="margin: 0; color: #7F8C8D; white-space: pre-wrap;"><strong>Details:</strong> {details[:500]}</p>
    </div>
    <p>Please inspect system logs and audit trails immediately.</p>
    """
    html = render_nectacare_html(
        title="Critical System Error",
        recipient_name="System Administrator",
        content_html=content,
        button_text="View Audit Trails",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, sysadmin_emails, html)


def send_security_new_device_login_email(user, user_agent, ip_address):
    """Send security alert when login occurs from a new device."""
    if not user.email:
        return
    
    subject = "Security Alert: New Device Login Detected"
    recipient_name = user.get_full_name() or user.username
    
    content = f"""
    <p>We detected a new login to your NectaCare account (<strong>{user.username}</strong>) from an unrecognized device or browser.</p>
    <div style="background-color: #FFF9E6; border-left: 4px solid {SECONDARY_YELLOW}; padding: 15px; border-radius: 4px; margin: 20px 0;">
        <p style="margin: 0 0 6px 0;"><strong>IP Address:</strong> {ip_address or 'Unknown'}</p>
        <p style="margin: 0;"><strong>Browser/Device:</strong> {user_agent[:80] if user_agent else 'Unknown Browser'}</p>
    </div>
    <p>If this was you, you can safely disregard this message. If you did not perform this login, please change your password immediately.</p>
    """
    html = render_nectacare_html(
        title="New Device Login Detected",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Secure My Account",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [user.email], html)


def send_security_failed_login_email(user, attempt_count, ip_address):
    """Send security notification when multiple failed login attempts are detected."""
    if not user.email:
        return
    
    subject = "Security Alert: Multiple Failed Login Attempts"
    recipient_name = user.get_full_name() or user.username
    
    content = f"""
    <p>We detected <strong>{attempt_count} consecutive failed login attempts</strong> for your NectaCare account (<strong>{user.username}</strong>).</p>
    <div style="background-color: #FDEDEC; border-left: 4px solid #E74C3C; padding: 15px; border-radius: 4px; margin: 20px 0; font-size: 14px; color: #C0392B;">
        <p style="margin: 0 0 6px 0;"><strong>Failed Attempts:</strong> {attempt_count}</p>
        <p style="margin: 0;"><strong>IP Address:</strong> {ip_address or 'Unknown'}</p>
    </div>
    <p>If you forgot your password, please click below to reset it securely.</p>
    """
    html = render_nectacare_html(
        title="Multiple Failed Login Attempts",
        recipient_name=recipient_name,
        content_html=content,
        button_text="Reset Password",
        button_url="http://localhost:5173"
    )
    _send_email_async(subject, [user.email], html)


def send_patient_otp_email(user, otp_code):
    """Send login verification OTP code to patient's registered email address."""
    print(f"\n==========================================")
    print(f"[LOGIN VERIFICATION CODE] User: {user.username} ({user.email}) | Code: {otp_code}")
    print(f"==========================================\n")
    if not user.email:
        return
    
    subject = "Your NectaCare Login Verification Code"
    recipient_name = user.get_full_name() or user.username
    
    content = f"""
    <p>You are attempting to sign in to your NectaCare patient account.</p>
    <p>Please enter the following 6-digit verification code to complete your login:</p>
    
    <div style="text-align: center; margin: 25px 0;">
        <div style="display: inline-block; background-color: #F0F4F8; border: 2px dashed {PRIMARY_BLUE}; padding: 14px 28px; border-radius: 8px; font-size: 28px; font-weight: 800; letter-spacing: 6px; color: {PRIMARY_BLUE};">
            {otp_code}
        </div>
    </div>
    
    <p style="font-size: 13px; color: #64748B;">This code is valid for 10 minutes. For your security, do not share this code with anyone.</p>
    """
    html = render_nectacare_html(
        title="Login Verification Code",
        recipient_name=recipient_name,
        content_html=content
    )
    _send_email_async(subject, [user.email], html)

