from datetime import date
from django.test import TestCase
from django.contrib.auth.models import User
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework.test import APIClient
from rest_framework import status

from api.models import Profile, Appointment, CellMedMember, MedicalRecord, FailedLoginAttempt
from api.services.auth_service import check_password_complexity, is_account_locked, record_failed_login, reset_failed_login
from api.services.appointment_service import book_appointment_atomic, DoubleBookingError
from api.services.document_service import validate_uploaded_file, save_secure_medical_document
from django.core.exceptions import ValidationError


class SecurityAndScalabilityTestCase(TestCase):
    def setUp(self):
        self.client = APIClient()

        # Create Patient User & Profile
        self.patient_user = User.objects.create_user(
            username='cm-10001',
            email='patient@cellmed.co.za',
            password='Password123!'
        )
        self.patient_profile = Profile.objects.create(
            user=self.patient_user,
            role='patient',
            title='Test Patient',
            medical_aid_number='CM-10001',
            medical_aid_status='Active',
            has_benefits=True
        )

        # Create Doctor User & Profile
        self.doctor_user = User.objects.create_user(
            username='doctor_smith',
            email='doctor@nectacare.co.zw',
            password='Password123!'
        )
        self.doctor_profile = Profile.objects.create(
            user=self.doctor_user,
            role='doctor',
            title='Dr. Smith',
            specialty='Cardiology'
        )

    def test_password_complexity(self):
        """Test password complexity rules"""
        is_valid, msg = check_password_complexity("weak")
        self.assertFalse(is_valid)
        self.assertIn("at least 8 characters", msg)

        is_valid, msg = check_password_complexity("NoSpecial123")
        self.assertFalse(is_valid)

        is_valid, msg = check_password_complexity("StrongPass123!")
        self.assertTrue(is_valid)

    def test_account_lockout(self):
        """Test rate limiting / account lockout after consecutive failed logins"""
        username = "test_lockout_user"
        for _ in range(5):
            record_failed_login(username, "127.0.0.1")

        is_locked, msg = is_account_locked(username, "127.0.0.1")
        self.assertTrue(is_locked)
        self.assertIn("Account locked", msg)

        reset_failed_login(username)
        is_locked, msg = is_account_locked(username, "127.0.0.1")
        self.assertFalse(is_locked)

    def test_double_booking_prevention(self):
        """Test double booking prevention using atomic transaction service"""
        booking_date = "2026-09-01"
        time_slot = "09:00 - 09:30"

        # Book initial appointment
        appointment = book_appointment_atomic(
            patient_profile=self.patient_profile,
            doctor_id=self.doctor_profile.id,
            date_str=booking_date,
            time_label=time_slot,
            reason="Checkup"
        )
        self.assertIsNotNone(appointment)

        # Attempt to book exact same slot again -> Expect DoubleBookingError
        with self.assertRaises(DoubleBookingError):
            book_appointment_atomic(
                patient_profile=self.patient_profile,
                doctor_id=self.doctor_profile.id,
                date_str=booking_date,
                time_label=time_slot,
                reason="Second Attempt"
            )

    def test_secure_file_upload_validation(self):
        """Test file upload validation against prohibited extensions (.exe, .php)"""
        bad_file = SimpleUploadedFile("malicious.exe", b"binary content", content_type="application/octet-stream")
        with self.assertRaises(ValidationError):
            validate_uploaded_file(bad_file)

        good_file = SimpleUploadedFile("medical_report.pdf", b"%PDF-1.4 content", content_type="application/pdf")
        # Should pass validation without throwing error
        validate_uploaded_file(good_file)

    def test_api_versioning_and_auth(self):
        """Test /api/v1/ versioned API routing"""
        response = self.client.get('/api/v1/doctors/')
        # Without auth token, should return 401 Unauthorized
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # Authenticate with token
        self.client.force_authenticate(user=self.patient_user)
        response = self.client.get('/api/v1/doctors/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
