from datetime import datetime, timedelta
from django.core.management.base import BaseCommand
from django.utils import timezone
from api.models import Appointment
from api.email_service import send_appointment_reminder_email

class Command(BaseCommand):
    help = 'Sends automated email reminders for upcoming consultations (24h and 1h before).'

    def handle(self, *args, **options):
        now = timezone.now()
        today = now.date()
        tomorrow = today + timedelta(days=1)

        self.stdout.write(f"Checking for appointment reminders at {now}...")

        # 1. Check 24-hour reminders
        # Appointments scheduled for tomorrow where status is 'upcoming' or 'booked' or 'verified'
        appts_24h = Appointment.objects.filter(
            date=tomorrow,
            status__in=['upcoming', 'booked', 'verified'],
            reminder_24h_sent=False
        )
        count_24h = 0
        for appt in appts_24h:
            send_appointment_reminder_email(appt, '24h')
            appt.reminder_24h_sent = True
            appt.save(update_fields=['reminder_24h_sent'])
            count_24h += 1

        # 2. Check 1-hour reminders
        # Appointments scheduled for today where reminder_1h_sent is False
        appts_1h = Appointment.objects.filter(
            date=today,
            status__in=['upcoming', 'booked', 'verified'],
            reminder_1h_sent=False
        )
        count_1h = 0
        for appt in appts_1h:
            # Parse time_label e.g. "09:00 - 10:00" or "14:30"
            try:
                start_str = appt.time_label.split('-')[0].strip()
                h, m = map(int, start_str.split(':'))
                appt_dt = timezone.make_aware(datetime.combine(today, datetime.min.time().replace(hour=h, minute=m)))
                diff_minutes = (appt_dt - now).total_seconds() / 60.0
                
                # If within 75 minutes of start time (or past time today if missed)
                if 0 <= diff_minutes <= 75:
                    send_appointment_reminder_email(appt, '1h')
                    appt.reminder_1h_sent = True
                    appt.save(update_fields=['reminder_1h_sent'])
                    count_1h += 1
            except Exception as e:
                # If time parsing fails, send reminder if for today
                send_appointment_reminder_email(appt, '1h')
                appt.reminder_1h_sent = True
                appt.save(update_fields=['reminder_1h_sent'])
                count_1h += 1

        self.stdout.write(self.style.SUCCESS(f"Successfully processed reminders: {count_24h} (24h), {count_1h} (1h)."))
