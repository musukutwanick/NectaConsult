from django.contrib.auth.models import User
from django.db import models

class Profile(models.Model):
    ROLE_CHOICES = [
        ('doctor', 'Doctor'),
        ('patient', 'Patient'),
        ('admin', 'Admin'),
        ('sysadmin', 'System Admin'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    title = models.CharField(max_length=120, blank=True)
    specialty = models.CharField(max_length=120, blank=True)
    plan = models.CharField(max_length=120, blank=True)
    insurer = models.CharField(max_length=120, blank=True)
    id_number = models.CharField(max_length=50, blank=True)
    date_joined = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    medical_aid_number = models.CharField(max_length=50, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    is_verified = models.BooleanField(default=True)
    has_benefits = models.BooleanField(default=True)
    medical_aid_status = models.CharField(max_length=50, default='Active')

    otp_code = models.CharField(max_length=6, blank=True)
    otp_created_at = models.DateTimeField(null=True, blank=True)
    profile_pic = models.TextField(blank=True)
    weight = models.CharField(max_length=20, blank=True)
    height = models.CharField(max_length=20, blank=True)
    blood_type = models.CharField(max_length=20, blank=True)
    allergies = models.TextField(blank=True)
    chronic_conditions = models.TextField(blank=True)
    emergency_contact = models.CharField(max_length=100, blank=True)
    change_password_on_next_login = models.BooleanField(default=False)
    signature_data = models.TextField(blank=True, default='')
    doctor_registration_number = models.CharField(max_length=100, blank=True, default='')
    doctor_qualifications = models.CharField(max_length=200, blank=True, default='')
    clinic_address = models.TextField(blank=True, default='')

    def __str__(self) -> str:
        return f'{self.user.get_full_name()} ({self.role})'



class AvailabilitySlot(models.Model):
    doctor = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='availability_slots')
    day = models.CharField(max_length=20)
    hours = models.CharField(max_length=40)
    is_off = models.BooleanField(default=False)


class Appointment(models.Model):
    STATUS_CHOICES = [
        ('upcoming', 'Upcoming'),
        ('booked', 'Booked'),
        ('verified', 'Verified'),
        ('start', 'Start'),
        ('done', 'Done'),
        ('cancelled', 'Cancelled'),
        ('rejected', 'Rejected'),
    ]

    patient = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='patient_appointments', db_index=True)
    doctor = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='doctor_appointments', db_index=True)
    reason = models.CharField(max_length=200)
    time_label = models.CharField(max_length=40, db_index=True)
    date = models.DateField(null=True, blank=True, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='upcoming', db_index=True)
    timezone = models.CharField(max_length=100, default='Africa/Johannesburg')
    rejection_reason = models.TextField(blank=True, default='')
    reminder_24h_sent = models.BooleanField(default=False)
    reminder_1h_sent = models.BooleanField(default=False)

    class Meta:
        indexes = [
            models.Index(fields=['doctor', 'date', 'status']),
            models.Index(fields=['patient', 'date']),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['doctor', 'date', 'time_label'],
                condition=~models.Q(status='cancelled'),
                name='unique_active_doctor_appointment_slot'
            )
        ]


class Prescription(models.Model):
    appointment = models.ForeignKey(Appointment, on_delete=models.SET_NULL, null=True, blank=True, related_name='prescriptions')
    patient = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='prescriptions', db_index=True)
    doctor = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='issued_prescriptions', db_index=True)
    title = models.CharField(max_length=200, default='Prescription')
    medication = models.CharField(max_length=200, blank=True)
    dosage = models.CharField(max_length=100, blank=True)
    renewal_note = models.CharField(max_length=200, blank=True)
    status = models.CharField(max_length=50, default='Ready for review', db_index=True)
    drugs_json = models.TextField(blank=True, default='[]')
    patient_address = models.TextField(blank=True, default='')
    patient_age = models.CharField(max_length=20, blank=True, default='')
    doctor_registration_number = models.CharField(max_length=100, blank=True, default='')
    doctor_qualifications = models.CharField(max_length=200, blank=True, default='')
    doctor_address = models.TextField(blank=True, default='')
    doctor_signature = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'created_at']),
        ]



class ConsultationNote(models.Model):
    doctor = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='notes')
    patient = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='patient_notes')
    text = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class ChatThread(models.Model):
    doctor = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='doctor_threads')
    patient = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='patient_threads')
    is_doctor_typing = models.BooleanField(default=False)
    is_patient_typing = models.BooleanField(default=False)
    last_doctor_active = models.DateTimeField(null=True, blank=True)
    last_patient_active = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('doctor', 'patient')


class ChatMessage(models.Model):
    thread = models.ForeignKey(ChatThread, on_delete=models.CASCADE, related_name='messages')
    sender = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='sent_messages')
    body = models.TextField()
    sent_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)


class MedicalRecord(models.Model):
    patient = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='medical_records', db_index=True)
    record_type = models.CharField(max_length=100, db_index=True)
    file_path = models.CharField(max_length=255, blank=True)
    file_name = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['patient', 'record_type']),
            models.Index(fields=['created_at']),
        ]


class Notification(models.Model):
    user = models.ForeignKey(Profile, on_delete=models.CASCADE, related_name='notifications', db_index=True)
    message = models.TextField()
    status = models.CharField(max_length=20, default='unread', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)


class AuditTrail(models.Model):
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, db_index=True)
    action = models.CharField(max_length=255, db_index=True)
    details = models.TextField(blank=True)
    timestamp = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['user', 'timestamp']),
            models.Index(fields=['action', 'timestamp']),
        ]

    def __str__(self):
        return f"{self.user} - {self.action} at {self.timestamp}"


class CellMedMember(models.Model):
    membership_number = models.CharField(max_length=50, unique=True, db_index=True)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    date_of_birth = models.DateField(null=True, blank=True)
    insurer = models.CharField(max_length=120, blank=True)
    plan = models.CharField(max_length=120, blank=True)
    id_number = models.CharField(max_length=50, blank=True)
    date_joined = models.DateField(null=True, blank=True)
    phone = models.CharField(max_length=40, blank=True)
    email = models.CharField(max_length=120, blank=True, db_index=True)
    address = models.TextField(blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['membership_number', 'email']),
        ]

    def __str__(self):
        return f"{self.membership_number} - {self.first_name} {self.last_name}"




class PasswordResetToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='password_reset_tokens')
    token = models.CharField(max_length=100, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    is_used = models.BooleanField(default=False)

    def __str__(self):
        return f"Password Reset Token for {self.user.username}"


class UserDevice(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='known_devices')
    user_agent = models.TextField()
    user_agent_hash = models.CharField(max_length=64)
    ip_address = models.CharField(max_length=50, blank=True)
    last_login = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('user', 'user_agent_hash')

    def __str__(self):
        return f"{self.user.username} device ({self.ip_address})"


class FailedLoginAttempt(models.Model):
    username = models.CharField(max_length=150)
    ip_address = models.CharField(max_length=50, blank=True)
    attempt_count = models.IntegerField(default=1)
    last_attempt = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.username} - {self.attempt_count} failed attempts from {self.ip_address}"

