from datetime import datetime
from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from ..models import Appointment, Profile, AvailabilitySlot

class DoubleBookingError(Exception):
    pass

def book_appointment_atomic(patient_profile: Profile, doctor_id: int, date_str: str, time_label: str, reason: str) -> Appointment:
    """
    Atomically checks doctor availability and books an appointment using database transaction locking.
    Guarantees no two patients can double-book the same doctor slot simultaneously.
    """
    try:
        booking_date = datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        raise ValidationError("Invalid date format. Expected YYYY-MM-DD.")

    with transaction.atomic():
        # Lock doctor profile and existing active appointments using select_for_update()
        doctor_profile = Profile.objects.select_for_update().filter(id=doctor_id, role='doctor').first()
        if not doctor_profile:
            raise ValidationError("Selected doctor profile was not found.")

        # Check for existing active appointment on the exact same doctor, date, and time slot
        existing_appointment = Appointment.objects.select_for_update().filter(
            doctor=doctor_profile,
            date=booking_date,
            time_label=time_label
        ).exclude(status='cancelled').first()

        if existing_appointment:
            raise DoubleBookingError(f"Doctor slot at {time_label} on {date_str} has already been booked by another patient.")

        # Create new appointment within transaction
        try:
            appointment = Appointment.objects.create(
                patient=patient_profile,
                doctor=doctor_profile,
                date=booking_date,
                time_label=time_label,
                reason=reason,
                status='upcoming'
            )
            return appointment
        except IntegrityError:
            raise DoubleBookingError(f"Doctor slot at {time_label} on {date_str} was booked concurrently by another user.")


def reschedule_appointment_atomic(appointment_id: int, requesting_user_profile: Profile, new_date_str: str, new_time_label: str) -> Appointment:
    """
    Atomically reschedules an appointment to a new slot while preventing double booking.
    """
    try:
        new_date = datetime.strptime(new_date_str, '%Y-%m-%d').date()
    except ValueError:
        raise ValidationError("Invalid date format. Expected YYYY-MM-DD.")

    with transaction.atomic():
        appointment = Appointment.objects.select_for_update().filter(id=appointment_id).first()
        if not appointment:
            raise ValidationError("Appointment not found.")

        # Verify permissions: must be patient, assigned doctor, or admin
        if requesting_user_profile.role not in ['admin', 'sysadmin']:
            if appointment.patient != requesting_user_profile and appointment.doctor != requesting_user_profile:
                raise ValidationError("You do not have permission to modify this appointment.")

        # Check if destination slot is occupied
        conflict = Appointment.objects.select_for_update().filter(
            doctor=appointment.doctor,
            date=new_date,
            time_label=new_time_label
        ).exclude(id=appointment.id).exclude(status='cancelled').first()

        if conflict:
            raise DoubleBookingError(f"Target slot at {new_time_label} on {new_date_str} is already booked.")

        appointment.date = new_date
        appointment.time_label = new_time_label
        appointment.save()
        return appointment
