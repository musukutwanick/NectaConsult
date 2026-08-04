import logging
from concurrent.futures import ThreadPoolExecutor
from django.contrib.auth.models import User
from ..models import AuditTrail, Notification, Profile
from .. import email_service

logger = logging.getLogger(__name__)
executor = ThreadPoolExecutor(max_workers=5)

def run_in_background(func, *args, **kwargs):
    """
    Submits a task to background worker thread pool to return API response immediately.
    """
    executor.submit(_safe_execute, func, *args, **kwargs)


def _safe_execute(func, *args, **kwargs):
    try:
        func(*args, **kwargs)
    except Exception as e:
        logger.error(f"Background task failed: {e}", exc_info=True)


def dispatch_appointment_booked_notifications(appointment):
    """
    Background worker function to dispatch appointment booking emails/SMS.
    """
    def _task():
        # Patient notification
        Notification.objects.create(
            user=appointment.patient,
            message=f"Appointment booked with Dr. {appointment.doctor.user.get_full_name()} for {appointment.date} at {appointment.time_label}."
        )
        # Doctor notification
        Notification.objects.create(
            user=appointment.doctor,
            message=f"New appointment booked by {appointment.patient.user.get_full_name()} for {appointment.date} at {appointment.time_label}."
        )
        # Email notifications via MS Graph / SMTP
        if appointment.patient.user.email:
            email_service.send_email_notification(
                to_email=appointment.patient.user.email,
                subject="Appointment Confirmation - NectaConsult",
                body=f"Hello {appointment.patient.user.first_name},\n\nYour appointment with Dr. {appointment.doctor.user.get_full_name()} on {appointment.date} at {appointment.time_label} has been created.\n\nReason: {appointment.reason}\n\nThank you,\nNectaConsult Team"
            )

    run_in_background(_task)


def log_audit_trail_async(user: User, action: str, details: str = ""):
    """
    Asynchronously logs audit trail records.
    """
    def _task():
        AuditTrail.objects.create(
            user=user if user and user.is_authenticated else None,
            action=action,
            details=details
        )

    run_in_background(_task)
