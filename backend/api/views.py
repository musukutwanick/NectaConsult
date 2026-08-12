from datetime import datetime
import os
import random
from django.utils import timezone
from django.conf import settings
from django.contrib.auth import authenticate, logout
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password
from django.db import transaction
from django.shortcuts import get_object_or_404
from django.db.models import Q
from rest_framework import status
from rest_framework.authtoken.models import Token
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.parsers import MultiPartParser, FormParser

import hashlib
import uuid

from django.http import FileResponse
from django.core.exceptions import ValidationError
from .models import (
    Appointment,
    AvailabilitySlot,
    ChatMessage,
    ChatThread,
    ConsultationNote,
    Prescription,
    Profile,
    MedicalRecord,
    Notification,
    AuditTrail,
    CellMedMember,
    PasswordResetToken,
    UserDevice,
    FailedLoginAttempt
)
from .serializers import (
    AppointmentSerializer,
    AvailabilitySerializer,
    ChatMessageSerializer,
    ConsultationNoteSerializer,
    PrescriptionSerializer,
    ProfileSerializer,
    MedicalRecordSerializer,
    NotificationSerializer,
    AuditTrailSerializer
)
from . import email_service
from .services.auth_service import (
    check_password_complexity,
    is_account_locked,
    record_failed_login,
    reset_failed_login,
    revoke_user_auth_tokens
)
from .services.appointment_service import (
    book_appointment_atomic,
    reschedule_appointment_atomic,
    DoubleBookingError
)
from .services import document_service, cache_service, notification_service



def get_admin_emails():
    emails = list(User.objects.filter(profile__role__in=['admin', 'sysadmin']).exclude(email='').values_list('email', flat=True))
    if not emails:
        emails = ['nectaconsult@nectacare.co.zw']
    return emails



def get_member_details(membership_number):
    membership_number = membership_number.strip().upper()
    
    # Check database only for real CellMed records
    db_member = CellMedMember.objects.filter(membership_number=membership_number).first()
    if db_member:
        return {
            'first_name': db_member.first_name,
            'last_name': db_member.last_name,
            'date_of_birth': db_member.date_of_birth.strftime('%Y-%m-%d') if db_member.date_of_birth else '',
            'insurer': db_member.insurer,
            'plan': db_member.plan,
            'id_number': db_member.id_number,
            'date_joined': db_member.date_joined.strftime('%Y-%m-%d') if db_member.date_joined else '',
            'phone': db_member.phone,
            'email': db_member.email,
            'address': db_member.address,
        }
    return None


class LookupMemberView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        membership_number = request.query_params.get('membership_number', '').strip().upper()
        if not membership_number:
            return Response({'detail': 'Membership number is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        member = get_member_details(membership_number)
        if not member:
            return Response({'detail': 'Member not found.'}, status=status.HTTP_404_NOT_FOUND)
            
        return Response(member)


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        medical_aid_number = request.data.get('medical_aid_number', '').strip().upper()
        password = request.data.get('password', '')
        email = request.data.get('email', '').strip()

        if not medical_aid_number or not password:
            return Response({'detail': 'CellMed membership number and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        is_valid_pwd, pwd_error = check_password_complexity(password)
        if not is_valid_pwd:
            return Response({'detail': pwd_error}, status=status.HTTP_400_BAD_REQUEST)

        username = medical_aid_number.lower()
        if User.objects.filter(username=username).exists():
            return Response({'detail': 'An account is already registered for this membership number.'}, status=status.HTTP_400_BAD_REQUEST)


        member = get_member_details(medical_aid_number)
        if not member:
            return Response({'detail': 'Invalid CellMed membership number.'}, status=status.HTTP_400_BAD_REQUEST)

        first_name = member['first_name']
        last_name = member['last_name']
        date_of_birth_str = member['date_of_birth']
        phone = member['phone']
        address = member['address']
        final_email = (email or member.get('email', '')).strip()

        if final_email and User.objects.filter(email__iexact=final_email).exists():
            return Response({'detail': 'An account with this email address is already registered. Please log in or use password reset.'}, status=status.HTTP_400_BAD_REQUEST)

        date_of_birth = None
        if date_of_birth_str:
            try:
                date_of_birth = datetime.strptime(date_of_birth_str, '%Y-%m-%d').date()
            except ValueError:
                pass

        with transaction.atomic():
            user = User.objects.create(
                username=username,
                first_name=first_name,
                last_name=last_name,
                email=final_email,
                password=make_password(password)
            )
            profile = Profile.objects.create(
                user=user,
                role='patient',
                title=f"{first_name} {last_name}".strip() or username,
                plan=member.get('plan') or 'CellMed Gold',
                insurer=member.get('insurer') or 'Premium USD',
                id_number=member.get('id_number') or '',
                date_joined=datetime.strptime(member['date_joined'], '%Y-%m-%d').date() if member.get('date_joined') else None,
                phone=phone,
                medical_aid_number=medical_aid_number,
                date_of_birth=date_of_birth,
                address=address,
                is_verified=True,
                has_benefits=True,
                medical_aid_status='Active'
            )

        # Trigger welcome email
        email_service.send_patient_welcome_email(user, profile)


        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': ProfileSerializer(profile).data,
        }, status=status.HTTP_201_CREATED)



class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        user_agent = request.META.get('HTTP_USER_AGENT', '')
        ip_address = request.META.get('REMOTE_ADDR', '')
        
        if username:
            is_locked, lock_msg = is_account_locked(username.lower(), ip_address)
            if is_locked:
                return Response({'detail': lock_msg}, status=status.HTTP_429_TOO_MANY_REQUESTS)

        user = None
        profile = Profile.objects.filter(medical_aid_number__iexact=username).first()
        if profile:
            user = authenticate(request, username=profile.user.username, password=password)
        if not user:
            user = authenticate(request, username=username, password=password)

        if not user:
            # Track failed login attempt via auth service
            if username:
                attempt = record_failed_login(username.lower(), ip_address)

                target_user = None
                prof = Profile.objects.filter(medical_aid_number__iexact=username).first()
                if prof:
                    target_user = prof.user
                else:
                    target_user = User.objects.filter(username__iexact=username).first()

                if target_user and attempt.attempt_count >= 3:
                    email_service.send_security_failed_login_email(target_user, attempt.attempt_count, ip_address)

            return Response({'detail': 'Invalid username/membership number or password.'}, status=status.HTTP_400_BAD_REQUEST)

        # Successful authentication: clear failed attempt tracker
        FailedLoginAttempt.objects.filter(username=user.username.lower()).delete()

        if not user.is_active:
            return Response({'detail': 'This account has been deactivated. Please contact administration.'}, status=status.HTTP_403_FORBIDDEN)

        # Check new device login
        if user_agent:
            agent_hash = hashlib.sha256(user_agent.encode('utf-8')).hexdigest()
            device, created = UserDevice.objects.get_or_create(
                user=user,
                user_agent_hash=agent_hash,
                defaults={'user_agent': user_agent, 'ip_address': ip_address}
            )
            if created:
                email_service.send_security_new_device_login_email(user, user_agent, ip_address)
            else:
                device.ip_address = ip_address
                device.save()

        # OTP Flow for Patients & Doctors - Live Email Dispatch
        if hasattr(user, 'profile') and user.profile.role in ['patient', 'doctor']:
            otp = str(random.randint(100000, 999999))
            user.profile.otp_code = otp
            user.profile.otp_created_at = timezone.now()
            user.profile.save()
            
            # Send live verification code to user's registered email
            email_service.send_patient_otp_email(user, otp)
            
            return Response({
                'otp_required': True,
                'email': user.email,
                'username': username
            })


        # Log successful login in AuditTrail
        AuditTrail.objects.create(user=user, action="Login", details="User logged in successfully")

        # Check if password change is forced
        change_password_required = False
        if hasattr(user, 'profile') and user.profile.change_password_on_next_login:
            change_password_required = True

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': ProfileSerializer(user.profile).data,
            'change_password_required': change_password_required
        })



class VerifyOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        otp_code = request.data.get('otp_code', '').strip()

        if not username or not otp_code:
            return Response({'detail': 'Username/membership number and verification code are required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = None
        profile = Profile.objects.filter(medical_aid_number__iexact=username).first()
        if profile:
            user = profile.user
        else:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                pass

        if not user or not hasattr(user, 'profile'):
            return Response({'detail': 'User profile not found.'}, status=status.HTTP_400_BAD_REQUEST)

        profile = user.profile
        if not profile.otp_code:
            return Response({'detail': 'No active verification code found. Please log in again.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check OTP expiry (5 minutes)
        if profile.otp_created_at:
            elapsed = (timezone.now() - profile.otp_created_at).total_seconds()
            if elapsed > 300:
                profile.otp_code = ''
                profile.otp_created_at = None
                profile.save()
                return Response({'detail': 'Verification code has expired. Please log in again.'}, status=status.HTTP_400_BAD_REQUEST)

        if profile.otp_code != otp_code:
            return Response({'detail': 'Invalid verification code.'}, status=status.HTTP_400_BAD_REQUEST)

        # OTP matches and is valid
        profile.otp_code = ''
        profile.otp_created_at = None
        profile.save()

        # Log successful login
        role_title = profile.role.capitalize() if profile.role else "User"
        AuditTrail.objects.create(user=user, action="Login", details=f"{role_title} logged in successfully via OTP")

        change_password_required = False
        if profile.change_password_on_next_login:
            change_password_required = True

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': ProfileSerializer(profile).data,
            'change_password_required': change_password_required
        })


class ResendOTPView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        if not username:
            return Response({'detail': 'Username or membership number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = None
        profile = Profile.objects.filter(medical_aid_number__iexact=username).first()
        if profile:
            user = profile.user
        else:
            try:
                user = User.objects.get(username=username)
            except User.DoesNotExist:
                pass

        if not user or not hasattr(user, 'profile'):
            return Response({'detail': 'User account not found.'}, status=status.HTTP_400_BAD_REQUEST)

        # Generate new 6-digit OTP
        otp = str(random.randint(100000, 999999))
        user.profile.otp_code = otp
        user.profile.otp_created_at = timezone.now()
        user.profile.save()

        # Send live email via MS Graph API
        email_service.send_patient_otp_email(user, otp)

        return Response({
            'detail': f'A new verification code has been sent to {user.email}.',
            'email': user.email
        })


class LogoutView(APIView):

    def post(self, request):
        if request.auth:
            request.auth.delete()
        logout(request)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MeView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        return Response(ProfileSerializer(request.user.profile).data)

    def put(self, request):
        user = request.user
        profile = user.profile

        email = request.data.get('email')
        password = request.data.get('password')
        profile_pic_file = request.FILES.get('profile_pic')
        profile_pic_data = request.data.get('profile_pic')

        if email:
            clean_email = email.strip()
            if User.objects.filter(email__iexact=clean_email).exclude(pk=user.pk).exists():
                return Response({'detail': 'This email address is already in use by another account.'}, status=status.HTTP_400_BAD_REQUEST)
            user.email = clean_email
            user.save()

        if password:
            user.set_password(password)
            user.save()

        if profile_pic_file:
            import base64
            try:
                encoded = base64.b64encode(profile_pic_file.read()).decode('utf-8')
                mime_type = getattr(profile_pic_file, 'content_type', 'image/jpeg') or 'image/jpeg'
                profile.profile_pic = f"data:{mime_type};base64,{encoded}"
                profile.save()
            except Exception as e:
                print(f"[PROFILE PIC ERROR] {e}")
        elif profile_pic_data and isinstance(profile_pic_data, str) and profile_pic_data.startswith('data:image'):
            profile.profile_pic = profile_pic_data
            profile.save()

        # Update clinical & doctor profile fields if provided
        doctor_fields = [
            'weight', 'height', 'blood_type', 'allergies', 'chronic_conditions', 'emergency_contact',
            'signature_data', 'doctor_registration_number', 'doctor_qualifications', 'clinic_address'
        ]
        for field in doctor_fields:
            if field in request.data:
                val = request.data.get(field, '')
                if isinstance(val, str):
                    val = val.strip()
                setattr(profile, field, val)
        
        profile.save()

        # Create system notification for profile/signature update
        try:
            Notification.objects.create(
                user=user,
                title="Profile & Digital Signature Saved",
                message="Your profile settings and prescription digital signature have been saved successfully.",
                notification_type="system"
            )
        except Exception as e:
            print(f"[PROFILE NOTIFICATION ERROR] {e}")

        return Response(ProfileSerializer(profile).data)


class DashboardView(APIView):
    def get(self, request):
        profile = request.user.profile

        if profile.role == 'sysadmin':
            return Response({
                'role': 'sysadmin',
                'user': ProfileSerializer(profile).data,
            })

        if profile.role == 'admin':
            total_patients = Profile.objects.filter(role='patient').count()
            pending_consultations = Appointment.objects.filter(status='booked').count()
            total_doctors = Profile.objects.filter(role='doctor').count()
            total_appointments = Appointment.objects.count()
            
            recent_appointments = Appointment.objects.all().order_by('-id')[:10]
            
            return Response({
                'role': 'admin',
                'user': ProfileSerializer(profile).data,
                'stats': [
                    {'label': 'Total Patients', 'value': str(total_patients), 'note': 'CellMed members', 'icon': 'patient'},
                    {'label': 'Pending Consultation Requests', 'value': str(pending_consultations), 'note': 'Awaiting verification', 'icon': 'calendar'},
                    {'label': 'Total Doctors', 'value': str(total_doctors), 'note': 'Nectacare staff', 'icon': 'profile'},
                    {'label': 'Total Appointments', 'value': str(total_appointments), 'note': 'All time', 'icon': 'calendar'},
                ],
                'pending_verifications': [],
                'appointments': AppointmentSerializer(recent_appointments, many=True).data,
            })



        if profile.role == 'doctor':
            doctor = profile
            # Get first patient for chat/note link
            patient = Profile.objects.filter(role='patient').first()
            thread = None
            if patient:
                thread = ChatThread.objects.filter(doctor=doctor, patient=patient).first()
            note = None
            if patient:
                note = ConsultationNote.objects.filter(doctor=doctor, patient=patient).first()
            
            appointments = Appointment.objects.filter(doctor=doctor).exclude(status__in=['booked', 'rejected', 'cancelled']).order_by('date', 'time_label')
            
            return Response({
                'role': 'doctor',
                'user': ProfileSerializer(profile).data,
                'stats': [
                    {'label': "Today's Appointments", 'value': str(appointments.exclude(status='done').exclude(status__in=['cancelled', 'rejected']).count()), 'note': 'Upcoming', 'icon': 'calendar'},
                    {'label': 'Total Patients', 'value': '312', 'note': '+8 this week', 'icon': 'patient'},
                    {'label': 'Prescriptions Issued', 'value': str(Prescription.objects.filter(doctor=doctor).count()), 'note': 'This month', 'icon': 'prescription'},
                    {'label': 'Average Rating', 'value': '4.8', 'note': '204 reviews', 'icon': 'star'},
                ],
                'appointments': AppointmentSerializer(appointments, many=True).data,
                'availability': AvailabilitySerializer(AvailabilitySlot.objects.filter(doctor=doctor), many=True).data,
                'note': ConsultationNoteSerializer(note).data if note else {'text': ''},
                'chat_thread_id': thread.id if thread else None,
                'messages': ChatMessageSerializer(thread.messages.select_related('sender__user').order_by('sent_at'), many=True).data if thread else [],
            })

        # Patient dashboard
        patient = profile
        doctor = Profile.objects.filter(role='doctor').first()
        thread = None
        if doctor:
            thread = ChatThread.objects.filter(doctor=doctor, patient=patient).first()
        prescription = Prescription.objects.filter(patient=patient).first()
        appointments = Appointment.objects.filter(patient=patient).order_by('date', 'time_label')
        doctors = Profile.objects.filter(role='doctor')
        
        return Response({
            'role': 'patient',
            'user': ProfileSerializer(profile).data,
            'stats': [
                {'label': 'Upcoming Appointments', 'value': str(appointments.exclude(status='done').exclude(status__in=['cancelled', 'rejected']).count()), 'note': 'Active bookings', 'icon': 'calendar'},
            ],
            'appointments': AppointmentSerializer(appointments, many=True).data,
            'prescriptions': PrescriptionSerializer(Prescription.objects.filter(patient=patient), many=True).data,
            'primary_prescription': PrescriptionSerializer(prescription).data if prescription else None,
            'chat_thread_id': thread.id if thread else None,
            'messages': ChatMessageSerializer(thread.messages.select_related('sender__user').order_by('sent_at'), many=True).data if thread else [],
            'recommended_doctors': [{'id': doc.id, 'name': doc.title or doc.user.get_full_name(), 'specialty': doc.specialty or 'General Practitioner', 'profile_pic': doc.profile_pic} for doc in doctors],
        })


class DoctorsView(APIView):
    def get(self, request):
        doctors = Profile.objects.filter(role='doctor')
        return Response(ProfileSerializer(doctors, many=True).data)


class PatientsView(APIView):
    def get(self, request):
        profile = request.user.profile
        if profile.role == 'doctor':
            patient_ids = Appointment.objects.filter(doctor=profile).values_list('patient_id', flat=True).distinct()
            patients = Profile.objects.filter(id__in=patient_ids, role='patient')
        elif profile.role == 'admin':
            patients = Profile.objects.filter(role='patient')
        else:
            return Response({'detail': 'Only doctors and administrators can view patient list.'}, status=status.HTTP_403_FORBIDDEN)
        
        return Response(ProfileSerializer(patients, many=True).data)

    def put(self, request):
        profile = request.user.profile
        if profile.role != 'admin' and profile.role != 'sysadmin':
            return Response({'detail': 'Only administrators can update patient accounts.'}, status=status.HTTP_403_FORBIDDEN)
            
        patient_id = request.data.get('patient_id')
        patient_profile = get_object_or_404(Profile, id=patient_id, role='patient')
        
        status_val = request.data.get('medical_aid_status')
        if status_val:
            patient_profile.medical_aid_status = status_val
            if status_val in ['Inactive', 'Disabled']:
                patient_profile.is_verified = False
            elif status_val in ['Active', 'Verified']:
                patient_profile.is_verified = True
                patient_profile.has_benefits = True
                
        patient_profile.save()
        
        AuditTrail.objects.create(
            user=profile.user,
            action="Patient Status Updated",
            details=f"Updated status for patient {patient_profile.title} to {status_val}"
        )
        return Response(ProfileSerializer(patient_profile).data)

    def delete(self, request):
        profile = request.user.profile
        if profile.role != 'admin' and profile.role != 'sysadmin':
            return Response({'detail': 'Only administrators can delete patient accounts.'}, status=status.HTTP_403_FORBIDDEN)
            
        patient_id = request.data.get('patient_id') or request.query_params.get('patient_id')
        patient_profile = get_object_or_404(Profile, id=patient_id, role='patient')
        user = patient_profile.user
        email = user.email
        med_num = patient_profile.medical_aid_number
        
        patient_name = patient_profile.title
        with transaction.atomic():
            if med_num:
                CellMedMember.objects.filter(membership_number__iexact=med_num).delete()
            if email and not email.endswith('@nectacare.local'):
                CellMedMember.objects.filter(email__iexact=email).delete()
            patient_profile.delete()
            user.delete()
            
        AuditTrail.objects.create(
            user=profile.user,
            action="Patient Deleted",
            details=f"Deleted patient account {patient_name} (ID: {patient_id})"
        )
        return Response({'detail': f'Patient account {patient_name} deleted successfully.'}, status=status.HTTP_200_OK)



class AppointmentView(APIView):
    def get(self, request):
        profile = request.user.profile
        patient_id = request.query_params.get('patient_id')
        if profile.role == 'doctor':
            if patient_id:
                patient = get_object_or_404(Profile, id=patient_id, role='patient')
                has_consulted = Appointment.objects.filter(doctor=profile, patient=patient).exists()
                if not has_consulted:
                    return Response({'detail': 'You do not have access to this patient\'s records.'}, status=status.HTTP_403_FORBIDDEN)
                appointments = Appointment.objects.filter(patient=patient).order_by('-date', '-time_label')
            else:
                appointments = Appointment.objects.filter(doctor=profile).exclude(status__in=['booked', 'rejected', 'cancelled']).order_by('date', 'time_label')
        else:
            appointments = Appointment.objects.filter(patient=profile).order_by('date', 'time_label')
        return Response(AppointmentSerializer(appointments, many=True).data)

    def post(self, request):
        profile = request.user.profile
        if profile.role != 'patient':
            return Response({'detail': 'Only patients can book appointments.'}, status=status.HTTP_403_FORBIDDEN)

        if profile.medical_aid_status != 'Active':
            return Response({'detail': f'Consultations can only be booked for active members. Your current status is: {profile.medical_aid_status}.'}, status=status.HTTP_403_FORBIDDEN)

        if not profile.has_benefits:
            return Response({'detail': 'Your medical aid plan has no active benefits for online consultations.'}, status=status.HTTP_403_FORBIDDEN)


        doctor_id = request.data.get('doctor_id')
        reason = request.data.get('reason', '').strip()
        time_label = request.data.get('time_label', '').strip()
        date_str = request.data.get('date', '')
        timezone_val = request.data.get('timezone', 'Africa/Johannesburg').strip()

        if not doctor_id or not time_label or not date_str:
            return Response({'detail': 'Doctor ID, date, and time slot are required.'}, status=status.HTTP_400_BAD_REQUEST)

        doctor = get_object_or_404(Profile, id=doctor_id, role='doctor')
        
        try:
            appointment = book_appointment_atomic(
                patient_profile=profile,
                doctor_id=int(doctor_id),
                date_str=date_str,
                time_label=time_label,
                reason=reason or 'General consultation'
            )
            appointment.timezone = timezone_val
            appointment.status = 'booked'
            appointment.save()
        except DoubleBookingError as e:
            return Response({'detail': str(e)}, status=status.HTTP_409_CONFLICT)
        except ValidationError as e:
            return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)

        appointment_date = appointment.date


        Notification.objects.create(
            user=doctor,
            message=f"New consultation request submitted by patient {profile.user.get_full_name()} for {appointment_date} at {time_label} (pending administrator approval)."
        )
        Notification.objects.create(
            user=profile,
            message=f"Your consultation request with {doctor.title} on {appointment_date} at {time_label} has been submitted and is pending administrator approval."
        )

        # Notify administrators to verify benefits and bill
        admins = Profile.objects.filter(role='admin')
        for admin in admins:
            Notification.objects.create(
                user=admin,
                message=f"New consultation request from {profile.user.get_full_name()} for {doctor.title} on {appointment_date} at {time_label}. Verification of benefits and billing required."
            )

        # Send email notifications for appointment booking
        email_service.send_appointment_booked_patient_email(appointment)
        email_service.send_appointment_booked_doctor_email(appointment)
        email_service.send_admin_appointment_request_email(get_admin_emails(), appointment)

        AuditTrail.objects.create(
            user=profile.user,
            action="Appointment Booked",
            details=f"Patient {profile.title} requested appointment with {doctor.title} on {appointment_date} at {time_label} (pending administrator approval)."
        )

        ChatThread.objects.get_or_create(doctor=doctor, patient=profile)

        return Response(AppointmentSerializer(appointment).data, status=status.HTTP_201_CREATED)

    def put(self, request):
        profile = request.user.profile
        appointment_id = request.data.get('appointment_id')
        action = request.data.get('action')
        
        appointment = get_object_or_404(Appointment, id=appointment_id)
        
        if profile.role == 'patient' and appointment.patient != profile:
            return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)
        if profile.role == 'doctor' and appointment.doctor != profile:
            return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        if action == 'cancel':
            appointment.status = 'cancelled'
            appointment.save()
            other_user = appointment.doctor if profile.role == 'patient' else appointment.patient
            Notification.objects.create(
                user=other_user,
                message=f"Appointment scheduled for {appointment.date} at {appointment.time_label} has been cancelled by {profile.user.get_full_name()}."
            )
            Notification.objects.create(
                user=profile,
                message=f"You cancelled the appointment scheduled for {appointment.date} at {appointment.time_label}."
            )
            email_service.send_appointment_rejected_email(appointment, reason="Cancelled by user")
        elif action == 'reschedule':
            new_date_str = request.data.get('date')
            new_time_label = request.data.get('time_label')
            
            try:
                new_date = datetime.strptime(new_date_str, '%Y-%m-%d').date()
            except ValueError:
                return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)
                
            old_date = appointment.date
            old_time = appointment.time_label
            appointment.date = new_date
            appointment.time_label = new_time_label
            appointment.status = 'upcoming' if profile.role == 'doctor' else 'booked'
            appointment.save()

            other_user = appointment.doctor if profile.role == 'patient' else appointment.patient
            Notification.objects.create(
                user=other_user,
                message=f"Appointment rescheduled by {profile.user.get_full_name()} from {old_date} {old_time} to {new_date} {new_time_label}."
            )
            Notification.objects.create(
                user=profile,
                message=f"You rescheduled your appointment to {new_date} at {new_time_label}."
            )
        elif action == 'status_change':
            new_status = request.data.get('status')
            if profile.role != 'doctor':
                return Response({'detail': 'Only doctors can change appointment clinical status.'}, status=status.HTTP_403_FORBIDDEN)
            appointment.status = new_status
            appointment.save()

            if new_status == 'start':
                Notification.objects.create(
                    user=appointment.patient,
                    message=f"Your consultation with {profile.title} has started. Click to join."
                )
                email_service.send_consultation_started_email(appointment)
            elif new_status == 'done':
                Notification.objects.create(
                    user=appointment.patient,
                    message=f"Your consultation with {profile.title} has completed. Consultation summary and notes are available."
                )
                has_rx = Prescription.objects.filter(patient=appointment.patient, doctor=appointment.doctor).exists()
                email_service.send_consultation_completed_email(appointment, has_prescription=has_rx)
        elif action == 'approve':
            if profile.role != 'admin':
                return Response({'detail': 'Only administrators can approve appointments.'}, status=status.HTTP_403_FORBIDDEN)
            appointment.status = 'verified'
            appointment.save()
            Notification.objects.create(
                user=appointment.patient,
                message=f"Your appointment request with {appointment.doctor.title} on {appointment.date} has been verified by Nectacare Administration and is pending doctor confirmation."
            )
            Notification.objects.create(
                user=appointment.doctor,
                message=f"New verified appointment request with patient {appointment.patient.user.get_full_name()} on {appointment.date} is waiting for your confirmation."
            )
            AuditTrail.objects.create(
                user=profile.user,
                action="Appointment Verified by Admin",
                details=f"Admin {profile.user.get_full_name()} verified appointment {appointment.id} for patient {appointment.patient.title} with {appointment.doctor.title} on {appointment.date}."
            )
        elif action == 'doctor_approve':
            if profile.role != 'doctor':
                return Response({'detail': 'Only doctors can approve appointments.'}, status=status.HTTP_403_FORBIDDEN)
            appointment.status = 'upcoming'
            appointment.save()
            Notification.objects.create(
                user=appointment.patient,
                message=f"Your appointment with {appointment.doctor.title} on {appointment.date} at {appointment.time_label} has been accepted and scheduled."
            )
            email_service.send_appointment_approved_email(appointment)
            AuditTrail.objects.create(
                user=profile.user,
                action="Appointment Accepted by Doctor",
                details=f"Doctor {profile.title} accepted appointment {appointment.id} for patient {appointment.patient.title} on {appointment.date} at {appointment.time_label}."
            )
        elif action == 'reject':
            if profile.role != 'admin':
                return Response({'detail': 'Only administrators can reject appointments.'}, status=status.HTTP_403_FORBIDDEN)
            rejection_reason = request.data.get('rejection_reason', '').strip()
            if not rejection_reason:
                return Response({'detail': 'Please provide a reason for rejecting the appointment.'}, status=status.HTTP_400_BAD_REQUEST)
            appointment.status = 'rejected'
            appointment.rejection_reason = rejection_reason
            appointment.save()
            Notification.objects.create(
                user=appointment.patient,
                message=f"Your appointment request with {appointment.doctor.title} on {appointment.date} was declined by Nectacare Administration. Reason: {rejection_reason}"
            )
            email_service.send_appointment_rejected_email(appointment, reason=rejection_reason)
            AuditTrail.objects.create(
                user=profile.user,
                action="Appointment Rejected",
                details=f"Admin {profile.user.get_full_name()} rejected appointment {appointment.id} for patient {appointment.patient.title} with {appointment.doctor.title} on {appointment.date}. Reason: {rejection_reason}"
            )
        else:
            return Response({'detail': 'Invalid action.'}, status=status.HTTP_400_BAD_REQUEST)

        return Response(AppointmentSerializer(appointment).data)



class PrescriptionView(APIView):
    def get(self, request):
        profile = request.user.profile
        patient_id = request.query_params.get('patient_id')
        if profile.role == 'doctor':
            if patient_id:
                patient = get_object_or_404(Profile, id=patient_id, role='patient')
                prescriptions = Prescription.objects.filter(patient=patient).order_by('-id')
            else:
                prescriptions = Prescription.objects.filter(doctor=profile).order_by('-id')
        elif profile.role == 'patient':
            prescriptions = Prescription.objects.filter(patient=profile).order_by('-id')
        else:
            prescriptions = Prescription.objects.filter(patient_id=patient_id).order_by('-id') if patient_id else Prescription.objects.all().order_by('-id')
        return Response(PrescriptionSerializer(prescriptions, many=True).data)

    def post(self, request):
        profile = request.user.profile
        if profile.role != 'doctor':
            return Response({'detail': 'Only doctors can create prescriptions.'}, status=status.HTTP_403_FORBIDDEN)

        patient_id = request.data.get('patient_id')
        appointment_id = request.data.get('appointment_id')
        title = request.data.get('title', '').strip()
        medication = request.data.get('medication', '').strip()
        dosage = request.data.get('dosage', '').strip()
        renewal_note = request.data.get('renewal_note', '').strip()

        if not patient_id or not title or not medication or not dosage:
            return Response({'detail': 'Patient ID, title, medication name, and dosage details are required.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = get_object_or_404(Profile, id=patient_id, role='patient')
        appointment = Appointment.objects.filter(id=appointment_id).first() if appointment_id else None

        doctor_reg = request.data.get('doctor_registration_number', '').strip() or profile.doctor_registration_number
        doctor_quals = request.data.get('doctor_qualifications', '').strip() or profile.doctor_qualifications
        doctor_addr = request.data.get('doctor_address', '').strip() or profile.clinic_address
        doctor_sig = request.data.get('doctor_signature', '').strip() or profile.signature_data

        prescription = Prescription.objects.create(
            patient=patient,
            doctor=profile,
            appointment=appointment,
            title=title,
            medication=medication,
            dosage=dosage,
            renewal_note=renewal_note,
            status='Ready for review',
            drugs_json=request.data.get('drugs_json', '[]'),
            patient_address=request.data.get('patient_address', ''),
            patient_age=request.data.get('patient_age', ''),
            doctor_registration_number=doctor_reg,
            doctor_qualifications=doctor_quals,
            doctor_address=doctor_addr,
            doctor_signature=doctor_sig
        )

        Notification.objects.create(
            user=patient,
            message=f"New prescription issued by {profile.title}: {medication} ({dosage})."
        )

        return Response(PrescriptionSerializer(prescription).data, status=status.HTTP_201_CREATED)


class MedicalRecordView(APIView):
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        profile = request.user.profile
        patient_id = request.query_params.get('patient_id')

        if profile.role == 'doctor':
            if not patient_id:
                return Response({'detail': 'Patient ID is required for doctor access.'}, status=status.HTTP_400_BAD_REQUEST)
            patient = get_object_or_404(Profile, id=patient_id, role='patient')
            records = MedicalRecord.objects.filter(patient=patient).order_by('-created_at')
        else:
            records = MedicalRecord.objects.filter(patient=profile).order_by('-created_at')
            
        return Response(MedicalRecordSerializer(records, many=True).data)

    def post(self, request):
        profile = request.user.profile
        patient_id = request.data.get('patient_id') or profile.id
        record_type = request.data.get('record_type', 'Consultation Note').strip()
        file_name = request.data.get('file_name', '').strip()
        
        uploaded_file = request.FILES.get('file')
        file_path = ""
        
        patient = get_object_or_404(Profile, id=patient_id, role='patient')
        
        if profile.role == 'doctor' and patient_id != profile.id:
            pass
        elif profile.role == 'patient' and int(patient_id) == profile.id:
            pass
        else:
            return Response({'detail': 'Unauthorized.'}, status=status.HTTP_403_FORBIDDEN)

        if uploaded_file:
            try:
                record = document_service.save_secure_medical_document(uploaded_file, patient, record_type)
                return Response(MedicalRecordSerializer(record).data, status=status.HTTP_201_CREATED)
            except ValidationError as e:
                return Response({'detail': str(e)}, status=status.HTTP_400_BAD_REQUEST)
        else:
            file_name = file_name or "medical_record.pdf"
            file_path = f"/media/{patient.id}/{file_name}"
            record = MedicalRecord.objects.create(
                patient=patient,
                record_type=record_type,
                file_path=file_path,
                file_name=file_name
            )
            return Response(MedicalRecordSerializer(record).data, status=status.HTTP_201_CREATED)



class NotificationView(APIView):
    def get(self, request):
        profile = request.user.profile
        notifications = Notification.objects.filter(user=profile).order_by('-created_at')
        return Response(NotificationSerializer(notifications, many=True).data)

    def post(self, request):
        profile = request.user.profile
        notification_id = request.data.get('notification_id')
        if notification_id:
            notification = get_object_or_404(Notification, id=notification_id, user=profile)
            notification.status = 'read'
            notification.save()
        else:
            Notification.objects.filter(user=profile).update(status='read')
        return Response({'detail': 'Notifications marked as read.'})


class AdminActionView(APIView):
    def post(self, request):
        profile = request.user.profile
        if profile.role != 'admin' and not profile.user.is_staff:
            return Response({'detail': 'Only administrators can perform administrative actions.'}, status=status.HTTP_403_FORBIDDEN)

        action = request.data.get('action')
        
        if action == 'verify_patient':
            patient_id = request.data.get('patient_id')
            is_approved = request.data.get('is_approved', True)
            rejection_reason = request.data.get('rejection_reason', '')

            patient_profile = get_object_or_404(Profile, id=patient_id, role='patient')
            patient_profile.is_verified = True

            if is_approved:
                patient_profile.has_benefits = True
                patient_profile.medical_aid_status = 'Active'
                status_msg = "Your CellMed membership account registration has been verified and approved by Nectacare Administration. Status: Active, Benefits: Active."
                # Log audit trail
                AuditTrail.objects.create(user=profile.user, action="Patient Approved", details=f"Approved patient registration for {patient_profile.title} (ID: {patient_id})")
            else:
                patient_profile.has_benefits = False
                if rejection_reason == 'Account inactive/Terminated':
                    patient_profile.medical_aid_status = 'Inactive'
                elif rejection_reason == 'Benefits Depleted':
                    patient_profile.medical_aid_status = 'Suspended'
                else:
                    patient_profile.medical_aid_status = 'Inactive'
                
                status_msg = f"Your CellMed membership account registration was rejected by Nectacare Administration. Reason: {rejection_reason or 'Details mismatch'}."
                # Log audit trail
                AuditTrail.objects.create(user=profile.user, action="Patient Rejected", details=f"Rejected patient registration for {patient_profile.title} (ID: {patient_id}). Reason: {rejection_reason or 'Details mismatch'}")

            patient_profile.save()

            Notification.objects.create(
                user=patient_profile,
                message=status_msg
            )

            # Send email notifications for patient activation or rejection
            if is_approved:
                email_service.send_patient_activation_email(patient_profile.user, patient_profile)
            else:
                email_service.send_patient_rejection_email(patient_profile.user, patient_profile, rejection_reason)

            return Response(ProfileSerializer(patient_profile).data)

        elif action == 'create_doctor':
            username = request.data.get('username', '').strip()
            password = request.data.get('password', '')
            first_name = request.data.get('first_name', '').strip()
            last_name = request.data.get('last_name', '').strip()
            specialty = request.data.get('specialty', '').strip()
            phone = request.data.get('phone', '').strip()
            email = request.data.get('email', '').strip()

            if not username or not password or not first_name or not last_name:
                return Response({'detail': 'Username, password, first name, and last name are required.'}, status=status.HTTP_400_BAD_REQUEST)

            if User.objects.filter(username=username).exists():
                return Response({'detail': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                user = User.objects.create(
                    username=username,
                    first_name=first_name,
                    last_name=last_name,
                    email=email or f"{username}@nectacare.co.za",
                    password=make_password(password)
                )
                doctor_profile = Profile.objects.create(
                    user=user,
                    role='doctor',
                    title=f"Dr. {first_name} {last_name}",
                    specialty=specialty or 'General Practitioner',
                    phone=phone,
                    is_verified=True
                )
            
            # Send doctor account notification and admin notification
            try:
                email_service.send_doctor_account_created_email(user, password)
                email_service.send_admin_new_doctor_email(get_admin_emails(), doctor_profile)
            except Exception as err:
                print(f"[DOCTOR EMAIL NOTICE] Could not send creation email: {err}")

            return Response(ProfileSerializer(doctor_profile).data, status=status.HTTP_201_CREATED)

        else:
            return Response({'detail': 'Invalid administrative action.'}, status=status.HTTP_400_BAD_REQUEST)



class ChatThreadView(APIView):
    def get(self, request):
        profile = request.user.profile
        doctor_id = request.query_params.get('doctor_id')
        patient_id = request.query_params.get('patient_id')
        other_id = request.query_params.get('other_id')

        if profile.role == 'doctor':
            target_id = other_id or patient_id
            if target_id:
                other = get_object_or_404(Profile, id=target_id, role='patient')
            else:
                other = Profile.objects.filter(role='patient').first()
            if not other:
                return Response({'detail': 'No patients registered.'}, status=status.HTTP_400_BAD_REQUEST)
            thread, _ = ChatThread.objects.get_or_create(doctor=profile, patient=other)
        else:
            target_id = other_id or doctor_id
            if target_id:
                other = get_object_or_404(Profile, id=target_id, role='doctor')
            else:
                other = Profile.objects.filter(role='doctor').first()
            if not other:
                return Response({'detail': 'No doctors registered.'}, status=status.HTTP_400_BAD_REQUEST)
            thread, _ = ChatThread.objects.get_or_create(doctor=other, patient=profile)

        now = timezone.now()
        if profile.role == 'doctor':
            thread.last_doctor_active = now
            thread.save(update_fields=['last_doctor_active'])
        else:
            thread.last_patient_active = now
            thread.save(update_fields=['last_patient_active'])

        messages = thread.messages.select_related('sender__user').order_by('sent_at')
        return Response({
            'thread_id': thread.id,
            'messages': ChatMessageSerializer(messages, many=True).data,
            'is_doctor_typing': thread.is_doctor_typing,
            'is_patient_typing': thread.is_patient_typing,
        })

    def post(self, request):
        profile = request.user.profile
        thread_id = request.data.get('thread_id')
        body = (request.data.get('body') or '').strip()
        if not body:
            return Response({'detail': 'Message cannot be empty.'}, status=status.HTTP_400_BAD_REQUEST)

        thread = get_object_or_404(ChatThread, id=thread_id)
        if profile not in (thread.doctor, thread.patient):
            return Response({'detail': 'You are not part of this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        now = timezone.now()
        if profile.role == 'doctor':
            thread.is_doctor_typing = False
            thread.last_doctor_active = now
            thread.save(update_fields=['is_doctor_typing', 'last_doctor_active'])

            recipient = thread.patient
            is_recipient_active = (
                thread.last_patient_active is not None and 
                (now - thread.last_patient_active).total_seconds() < 10
            )
            if not is_recipient_active:
                sender_title = profile.title or f"Dr. {profile.user.get_full_name()}" or "Your doctor"
                snippet = body[:50] + ('...' if len(body) > 50 else '')
                Notification.objects.create(
                    user=recipient,
                    message=f"New message from {sender_title}: \"{snippet}\""
                )
        else:
            thread.is_patient_typing = False
            thread.last_patient_active = now
            thread.save(update_fields=['is_patient_typing', 'last_patient_active'])

            recipient = thread.doctor
            is_recipient_active = (
                thread.last_doctor_active is not None and 
                (now - thread.last_doctor_active).total_seconds() < 10
            )
            if not is_recipient_active:
                sender_title = profile.user.get_full_name() or profile.user.username
                snippet = body[:50] + ('...' if len(body) > 50 else '')
                Notification.objects.create(
                    user=recipient,
                    message=f"New message from patient {sender_title}: \"{snippet}\""
                )

        message = ChatMessage.objects.create(thread=thread, sender=profile, body=body)
        return Response(ChatMessageSerializer(message).data, status=status.HTTP_201_CREATED)


class ChatTypingView(APIView):
    def post(self, request):
        profile = request.user.profile
        thread_id = request.data.get('thread_id')
        is_typing = bool(request.data.get('is_typing', False))

        thread = get_object_or_404(ChatThread, id=thread_id)
        if profile not in (thread.doctor, thread.patient):
            return Response({'detail': 'You are not part of this conversation.'}, status=status.HTTP_403_FORBIDDEN)

        if profile.role == 'doctor':
            thread.is_doctor_typing = is_typing
        else:
            thread.is_patient_typing = is_typing
        thread.save(update_fields=['is_doctor_typing', 'is_patient_typing'])

        return Response({'success': True})


class NoteView(APIView):
    def post(self, request):
        profile = request.user.profile
        if profile.role != 'doctor':
            return Response({'detail': 'Only doctors can save consultation notes.'}, status=status.HTTP_403_FORBIDDEN)

        patient = Profile.objects.filter(role='patient').first()
        if not patient:
            return Response({'detail': 'No patients registered.'}, status=status.HTTP_400_BAD_REQUEST)
        note, _ = ConsultationNote.objects.get_or_create(doctor=profile, patient=patient)
        note.text = request.data.get('text', '')
        note.save()
        return Response(ConsultationNoteSerializer(note).data)


class AvailabilityView(APIView):
    def post(self, request):
        profile = request.user.profile
        if profile.role != 'doctor':
            return Response({'detail': 'Only doctors can update availability.'}, status=status.HTTP_403_FORBIDDEN)

        slots = request.data.get('slots', [])
        with transaction.atomic():
            AvailabilitySlot.objects.filter(doctor=profile).delete()
            for slot in slots:
                AvailabilitySlot.objects.create(
                    doctor=profile,
                    day=slot['day'],
                    hours=slot['hours'],
                    is_off=bool(slot.get('is_off', False)),
                )
        return Response(AvailabilitySerializer(AvailabilitySlot.objects.filter(doctor=profile), many=True).data)


class DoctorAvailabilityView(APIView):
    def get(self, request, doctor_id):
        date_str = request.query_params.get('date')
        if not date_str:
            return Response({'detail': 'Date parameter is required.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_date = datetime.strptime(date_str, '%Y-%m-%d').date()
        except ValueError:
            return Response({'detail': 'Invalid date format. Use YYYY-MM-DD.'}, status=status.HTTP_400_BAD_REQUEST)

        doctor = get_object_or_404(Profile, id=doctor_id, role='doctor')
        
        # Get the day of the week
        day_of_week = target_date.strftime('%A')
        
        # Check doctor's availability slot for this day
        slots = AvailabilitySlot.objects.filter(doctor=doctor, day=day_of_week, is_off=False)
        if not slots.exists():
            return Response([])
            
        available_slots = []
        for slot in slots:
            try:
                # Parse start and end hours, e.g., '08:00 - 16:00'
                start_str, end_str = slot.hours.split('-')
                start_parts = [int(part) for part in start_str.strip().split(':')[:2]]
                end_parts = [int(part) for part in end_str.strip().split(':')[:2]]
                start_minutes = start_parts[0] * 60 + (start_parts[1] if len(start_parts) > 1 else 0)
                end_minutes = end_parts[0] * 60 + (end_parts[1] if len(end_parts) > 1 else 0)

                slot_length_minutes = 20
                current_minutes = start_minutes
                while current_minutes + slot_length_minutes <= end_minutes:
                    slot_start_hour = current_minutes // 60
                    slot_start_minute = current_minutes % 60
                    slot_end_minutes = current_minutes + slot_length_minutes
                    slot_end_hour = slot_end_minutes // 60
                    slot_end_minute = slot_end_minutes % 60
                    slot_label = (
                        f"{slot_start_hour:02d}:{slot_start_minute:02d} - "
                        f"{slot_end_hour:02d}:{slot_end_minute:02d}"
                    )
                    available_slots.append(slot_label)
                    current_minutes += slot_length_minutes
            except Exception:
                # Fallback standard slots
                available_slots = ['09:00 - 09:20', '09:20 - 09:40', '09:40 - 10:00', '10:00 - 10:20', '10:20 - 10:40', '10:40 - 11:00', '11:00 - 11:20', '11:20 - 11:40', '11:40 - 12:00', '12:00 - 12:20', '12:20 - 12:40', '12:40 - 13:00', '13:00 - 13:20', '13:20 - 13:40', '13:40 - 14:00', '14:00 - 14:20', '14:20 - 14:40', '14:40 - 15:00', '15:00 - 15:20', '15:20 - 15:40', '15:40 - 16:00']
                break

        # Filter out slots that are already booked on this date
        booked_appointments = Appointment.objects.filter(
            doctor=doctor,
            date=target_date,
            status__in=['booked', 'upcoming', 'start']
        ).values_list('time_label', flat=True)
        
        slots_with_status = []
        for slot in available_slots:
            slots_with_status.append({
                'time': slot,
                'available': slot not in booked_appointments
            })
        return Response(slots_with_status)


class AdminReportsView(APIView):
    def get(self, request):
        from django.db.models import Count
        profile = request.user.profile
        if profile.role != 'admin' and not request.user.is_staff:
            return Response({'detail': 'Only administrators can view and generate reports.'}, status=status.HTTP_403_FORBIDDEN)

        appointments = Appointment.objects.all()

        start_date_str = request.query_params.get('start_date')
        if start_date_str:
            try:
                appointments = appointments.filter(date__gte=datetime.strptime(start_date_str, '%Y-%m-%d').date())
            except ValueError:
                pass

        end_date_str = request.query_params.get('end_date')
        if end_date_str:
            try:
                appointments = appointments.filter(date__lte=datetime.strptime(end_date_str, '%Y-%m-%d').date())
            except ValueError:
                pass

        doctor_id = request.query_params.get('doctor_id')
        if doctor_id:
            appointments = appointments.filter(doctor_id=doctor_id)

        status_filter = request.query_params.get('status')
        if status_filter:
            appointments = appointments.filter(status=status_filter)

        appointments = appointments.order_by('-date', '-time_label')

        if request.query_params.get('export') == 'csv':
            import csv
            from django.http import HttpResponse
            response = HttpResponse(content_type='text/csv')
            response['Content-Disposition'] = 'attachment; filename="consultations_report.csv"'

            writer = csv.writer(response)
            writer.writerow([
                'Appointment ID', 
                'Date', 
                'Time Slot', 
                'Patient Name', 
                'Medical Aid Number', 
                'Doctor Name', 
                'Reason', 
                'Status', 
                'Consultation Note'
            ])

            for appt in appointments:
                note = ConsultationNote.objects.filter(doctor=appt.doctor, patient=appt.patient).first()
                note_text = note.text if note else ""
                writer.writerow([
                    appt.id,
                    appt.date.strftime('%Y-%m-%d') if appt.date else "TBD",
                    appt.time_label,
                    appt.patient.user.get_full_name() or appt.patient.user.username,
                    appt.patient.medical_aid_number,
                    appt.doctor.user.get_full_name() or appt.doctor.user.username,
                    appt.reason,
                    appt.status,
                    note_text
                ])
            return response

        # Aggregated stats
        total_count = appointments.count()
        
        status_counts = {}
        for item in appointments.values('status').annotate(count=Count('id')):
            status_counts[item['status']] = item['count']

        doctor_counts = []
        for item in appointments.values('doctor__id', 'doctor__title', 'doctor__user__first_name', 'doctor__user__last_name').annotate(count=Count('id')):
            name = item['doctor__title'] or f"Dr. {item['doctor__user__first_name']} {item['doctor__user__last_name']}"
            doctor_counts.append({
                'doctor_id': item['doctor__id'],
                'doctor_name': name,
                'count': item['count']
            })

        # Serialized list with notes
        report_list = []
        for appt in appointments:
            note = ConsultationNote.objects.filter(doctor=appt.doctor, patient=appt.patient).first()
            report_list.append({
                'id': appt.id,
                'date': appt.date.strftime('%Y-%m-%d') if appt.date else "TBD",
                'time_label': appt.time_label,
                'patient_name': appt.patient.user.get_full_name() or appt.patient.user.username,
                'patient_membership': appt.patient.medical_aid_number,
                'patient_insurer': appt.patient.plan,
                'doctor_name': appt.doctor.user.get_full_name() or appt.doctor.user.username,
                'reason': appt.reason,
                'status': appt.status,
                'note': note.text if note else ""
            })

        return Response({
            'summary': {
                'total_consultations': total_count,
                'status_counts': status_counts,
                'doctor_counts': doctor_counts
            },
            'appointments': report_list
        })


class SysAdminUsersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        if profile.role not in ['sysadmin', 'admin']:
            return Response({'detail': 'Only administrators can view administrative users list.'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get profiles with role doctor, admin, sysadmin
        profiles = Profile.objects.filter(role__in=['doctor', 'admin', 'sysadmin']).order_by('role', 'title')
        return Response(ProfileSerializer(profiles, many=True).data)


class SysAdminCreateUserView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if profile.role not in ['sysadmin', 'admin']:
            return Response({'detail': 'Only administrators can register new users.'}, status=status.HTTP_403_FORBIDDEN)
        
        username = request.data.get('username', '').strip()
        password = request.data.get('password', '')
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        specialty = request.data.get('specialty', '').strip()
        phone = request.data.get('phone', '').strip()
        role = request.data.get('role', 'doctor')
        change_password_on_next_login = request.data.get('change_password_on_next_login', False)
        medical_aid_number = request.data.get('medical_aid_number', username).strip().upper()

        email = request.data.get('email', '').strip()

        if not username or not password or not first_name or not last_name:
            return Response({'detail': 'Username, password, first name, and last name are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({'detail': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        if email and User.objects.filter(email__iexact=email).exists():
            return Response({'detail': 'An account with this email address already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        if role not in ['doctor', 'admin', 'sysadmin', 'patient']:
            return Response({'detail': 'Invalid role choice.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user = User.objects.create(
                username=username,
                first_name=first_name,
                last_name=last_name,
                email=email or f"{username}@nectacare.co.za",
                password=make_password(password)
            )
            
            new_profile = Profile.objects.create(
                user=user,
                role=role,
                title=f"Dr. {first_name} {last_name}" if role == 'doctor' else f"{first_name} {last_name}",
                specialty=specialty if role == 'doctor' else '',
                phone=phone,
                medical_aid_number=medical_aid_number if role == 'patient' else '',
                change_password_on_next_login=change_password_on_next_login,
                is_verified=True,
                medical_aid_status='Verified' if role == 'patient' else 'Pending',
                has_benefits=True if role == 'patient' else False
            )
            
            if role == 'doctor':
                for day in ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']:
                    AvailabilitySlot.objects.create(doctor=new_profile, day=day, hours='08:00 - 17:00', is_off=False)
                AvailabilitySlot.objects.create(doctor=new_profile, day='Saturday', hours='Off', is_off=True)
                AvailabilitySlot.objects.create(doctor=new_profile, day='Sunday', hours='Off', is_off=True)
                try:
                    email_service.send_doctor_account_created_email(user, password)
                    email_service.send_admin_new_doctor_email(get_admin_emails(), new_profile)
                except Exception as err:
                    print(f"[DOCTOR EMAIL NOTICE] Could not send creation email: {err}")
            elif role == 'patient':
                # Also ensure CellMedMember record exists
                mem_num = medical_aid_number
                CellMedMember.objects.update_or_create(
                    membership_number=mem_num,
                    defaults={
                        'first_name': first_name,
                        'last_name': last_name,
                        'phone': phone,
                    }
                )
                try:
                    email_service.send_patient_welcome_email(new_profile)
                except Exception as err:
                    print(f"[PATIENT EMAIL NOTICE] Could not send welcome email: {err}")

            # Log audit trail
            AuditTrail.objects.create(
                user=request.user,
                action="User Creation",
                details=f"Created {role} profile '{new_profile.title}' (username: {username}), change_password_on_next_login={change_password_on_next_login}"
            )

        return Response(ProfileSerializer(new_profile).data)


class SysAdminAddMemberView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if profile.role != 'sysadmin':
            return Response({'detail': 'Only system administrators can add CellMed member records.'}, status=status.HTTP_403_FORBIDDEN)
        
        mem_num = request.data.get('membership_number', '').strip().upper()
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        dob_str = request.data.get('date_of_birth', '').strip()
        phone = request.data.get('phone', '').strip()
        email = request.data.get('email', '').strip()
        address = request.data.get('address', '').strip()
        insurer = request.data.get('insurer', '').strip()
        plan = request.data.get('plan', '').strip()
        id_number = request.data.get('id_number', '').strip()
        date_joined_str = request.data.get('date_joined', '').strip()

        if not mem_num or not first_name or not last_name:
            return Response({'detail': 'Membership number, first name, and last name are required.'}, status=status.HTTP_400_BAD_REQUEST)

        dob = None
        if dob_str:
            for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
                try:
                    dob = datetime.strptime(dob_str, fmt).date()
                    break
                except ValueError:
                    pass

        date_joined = None
        if date_joined_str:
            for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
                try:
                    date_joined = datetime.strptime(date_joined_str, fmt).date()
                    break
                except ValueError:
                    pass

        member, created = CellMedMember.objects.update_or_create(
            membership_number=mem_num,
            defaults={
                'first_name': first_name,
                'last_name': last_name,
                'date_of_birth': dob,
                'insurer': insurer,
                'plan': plan,
                'id_number': id_number,
                'date_joined': date_joined,
                'phone': phone,
                'email': email,
                'address': address
            }
        )

        AuditTrail.objects.create(
            user=request.user,
            action="Single Member Entry",
            details=f"{'Registered new' if created else 'Updated'} CellMed member record: {mem_num} ({first_name} {last_name}), Insurer: {insurer or 'N/A'}, Plan: {plan or 'N/A'}"
        )

        return Response({
            'detail': f'Success! {"Registered" if created else "Updated"} CellMed member record for {mem_num} ({first_name} {last_name}).',
            'created': created,
            'member': {
                'membership_number': member.membership_number,
                'first_name': member.first_name,
                'last_name': member.last_name,
                'insurer': member.insurer,
                'plan': member.plan,
                'id_number': member.id_number,
                'date_joined': str(member.date_joined) if member.date_joined else '',
                'phone': member.phone,
                'email': member.email,
                'address': member.address
            }
        })




class SysAdminResetPasswordView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if profile.role != 'sysadmin':
            return Response({'detail': 'Only system administrators can perform password resets.'}, status=status.HTTP_403_FORBIDDEN)
        
        user_id = request.data.get('user_id')
        new_password = request.data.get('new_password', '').strip()
        change_password_on_next_login = request.data.get('change_password_on_next_login', False)

        if not user_id or not new_password:
            return Response({'detail': 'User ID and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        target_profile = get_object_or_404(Profile, id=user_id)
        if target_profile.role not in ['doctor', 'admin', 'sysadmin']:
            return Response({'detail': 'Only doctors, administrators, and system administrators passwords can be reset.'}, status=status.HTTP_400_BAD_REQUEST)

        user = target_profile.user
        user.set_password(new_password)
        user.save()

        target_profile.change_password_on_next_login = change_password_on_next_login
        target_profile.save()

        email_service.send_password_changed_email(user)

        # Log audit trail
        AuditTrail.objects.create(
            user=request.user,
            action="Password Reset",
            details=f"Reset password for {target_profile.role} '{target_profile.title}' (username: {user.username}), change_password_on_next_login={change_password_on_next_login}"
        )

        return Response({'detail': f"Password for {target_profile.title} reset successfully."})


class SysAdminAuditTrailsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        if profile.role != 'sysadmin':
            return Response({'detail': 'Only system administrators can view audit trails.'}, status=status.HTTP_403_FORBIDDEN)
        
        trails = AuditTrail.objects.all().order_by('-timestamp')
        return Response(AuditTrailSerializer(trails, many=True).data)


class SysAdminUpdateUserView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        profile = request.user.profile
        if profile.role != 'sysadmin':
            return Response({'detail': 'Only system administrators can update users.'}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'detail': 'User ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        target_profile = get_object_or_404(Profile, id=user_id)
        if target_profile.role not in ['doctor', 'admin', 'sysadmin']:
            return Response({'detail': 'Only doctor, admin, and sysadmin profiles can be updated.'}, status=status.HTTP_400_BAD_REQUEST)

        user = target_profile.user
        
        username = request.data.get('username', '').strip()
        first_name = request.data.get('first_name', '').strip()
        last_name = request.data.get('last_name', '').strip()
        specialty = request.data.get('specialty', '').strip()
        phone = request.data.get('phone', '').strip()
        role = request.data.get('role')
        change_password_on_next_login = request.data.get('change_password_on_next_login', False)

        email = request.data.get('email', '').strip()

        if not username or not first_name or not last_name:
            return Response({'detail': 'Username, first name, and last name are required.'}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exclude(id=user.id).exists():
            return Response({'detail': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

        if role and role not in ['doctor', 'admin', 'sysadmin']:
            return Response({'detail': 'Invalid role choice.'}, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            user.username = username
            user.first_name = first_name
            user.last_name = last_name
            user.email = email
            user.save()

            if role:
                target_profile.role = role
                target_profile.title = f"Dr. {first_name} {last_name}" if role == 'doctor' else f"{first_name} {last_name}"
            
            target_profile.specialty = specialty if target_profile.role == 'doctor' else ''
            target_profile.phone = phone
            target_profile.change_password_on_next_login = change_password_on_next_login
            target_profile.save()

            # Log audit trail
            AuditTrail.objects.create(
                user=request.user,
                action="User Update",
                details=f"Updated user profile '{target_profile.title}' (username: {username}), change_password_on_next_login={change_password_on_next_login}"
            )

        return Response(ProfileSerializer(target_profile).data)


class SysAdminDeleteUserView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        profile = request.user.profile
        if profile.role not in ['sysadmin', 'admin']:
            return Response({'detail': 'Only administrators can delete user accounts.'}, status=status.HTTP_403_FORBIDDEN)

        user_id = request.data.get('user_id') or request.query_params.get('user_id')
        if not user_id:
            return Response({'detail': 'User ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        target_profile = get_object_or_404(Profile, id=user_id)
        if target_profile.role not in ['doctor', 'admin', 'sysadmin', 'patient']:
            return Response({'detail': 'Invalid profile type for deletion.'}, status=status.HTTP_400_BAD_REQUEST)

        # Prevent sysadmin from deleting themselves
        if target_profile.user.id == request.user.id:
            return Response({'detail': 'You cannot delete your own account.'}, status=status.HTTP_400_BAD_REQUEST)

        user = target_profile.user
        username = user.username
        email = user.email
        medical_aid_num = target_profile.medical_aid_number
        title = target_profile.title
        role = target_profile.role

        with transaction.atomic():
            # Delete associated CellMedMember record if existing to prevent orphan email lockouts
            if medical_aid_num:
                CellMedMember.objects.filter(membership_number__iexact=medical_aid_num).delete()
            if email and not email.endswith('@nectacare.local'):
                CellMedMember.objects.filter(email__iexact=email).delete()

            user.delete()

            # Log audit trail
            AuditTrail.objects.create(
                user=request.user,
                action="User Deletion",
                details=f"Deleted {role} profile '{title}' (username: {username}, email: {email})"
            )

        return Response({'detail': f"User {title} deleted successfully."})


class UploadCellMedMembersView(APIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        profile = request.user.profile
        if profile.role != 'sysadmin':
            return Response({'detail': 'Only system administrators can upload CellMed member records.'}, status=status.HTTP_403_FORBIDDEN)
        
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'No file uploaded.'}, status=status.HTTP_400_BAD_REQUEST)
        
        if not file.name.endswith('.csv'):
            return Response({'detail': 'Please upload a CSV file (Excel CSV).'}, status=status.HTTP_400_BAD_REQUEST)

        import csv
        from io import StringIO
        from datetime import datetime

        try:
            decoded_file = file.read().decode('utf-8-sig', errors='ignore')
            io_string = StringIO(decoded_file)
            reader = csv.reader(io_string)
            
            header = next(reader, None)
            if not header:
                return Response({'detail': 'Empty CSV file.'}, status=status.HTTP_400_BAD_REQUEST)
            
            # Map headers to index
            # Clean headers
            header = [h.strip().lower().replace(' ', '_').replace('membership_number', 'membership_number').replace('member_number', 'membership_number') for h in header]
            
            required_headers = ['membership_number', 'first_name', 'last_name']
            for req in required_headers:
                if req not in header:
                    return Response({'detail': f'Missing required CSV column: "{req}". Column headers must include membership_number, first_name, and last_name.'}, status=status.HTTP_400_BAD_REQUEST)

            mem_idx = header.index('membership_number')
            fn_idx = header.index('first_name')
            ln_idx = header.index('last_name')
            dob_idx = header.index('date_of_birth') if 'date_of_birth' in header else -1
            insurer_idx = header.index('insurer') if 'insurer' in header else -1
            plan_idx = header.index('plan') if 'plan' in header else -1
            id_idx = header.index('id_number') if 'id_number' in header else (header.index('national_id') if 'national_id' in header else -1)
            joined_idx = header.index('date_joined') if 'date_joined' in header else (header.index('joined_date') if 'joined_date' in header else -1)
            phone_idx = header.index('phone') if 'phone' in header else -1
            email_idx = header.index('email') if 'email' in header else -1
            addr_idx = header.index('address') if 'address' in header else -1

            created_count = 0
            updated_count = 0

            with transaction.atomic():
                for row in reader:
                    if not row or len(row) <= max(mem_idx, fn_idx, ln_idx):
                        continue
                    
                    mem_num = row[mem_idx].strip().upper()
                    if not mem_num:
                        continue
                    
                    first_name = row[fn_idx].strip()
                    last_name = row[ln_idx].strip()
                    
                    dob = None
                    if dob_idx != -1 and dob_idx < len(row):
                        dob_str = row[dob_idx].strip()
                        if dob_str:
                            for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
                                try:
                                    dob = datetime.strptime(dob_str, fmt).date()
                                    break
                                except ValueError:
                                    pass

                    date_joined = None
                    if joined_idx != -1 and joined_idx < len(row):
                        dj_str = row[joined_idx].strip()
                        if dj_str:
                            for fmt in ('%Y-%m-%d', '%d/%m/%Y', '%m/%d/%Y'):
                                try:
                                    date_joined = datetime.strptime(dj_str, fmt).date()
                                    break
                                except ValueError:
                                    pass

                    insurer = row[insurer_idx].strip() if insurer_idx != -1 and insurer_idx < len(row) else ''
                    plan = row[plan_idx].strip() if plan_idx != -1 and plan_idx < len(row) else ''
                    id_number = row[id_idx].strip() if id_idx != -1 and id_idx < len(row) else ''
                    phone = row[phone_idx].strip() if phone_idx != -1 and phone_idx < len(row) else ''
                    email = row[email_idx].strip() if email_idx != -1 and email_idx < len(row) else ''
                    address = row[addr_idx].strip() if addr_idx != -1 and addr_idx < len(row) else ''

                    member, created = CellMedMember.objects.update_or_create(
                        membership_number=mem_num,
                        defaults={
                            'first_name': first_name,
                            'last_name': last_name,
                            'date_of_birth': dob,
                            'insurer': insurer,
                            'plan': plan,
                            'id_number': id_number,
                            'date_joined': date_joined,
                            'phone': phone,
                            'email': email,
                            'address': address
                        }
                    )

                    if created:
                        created_count += 1
                    else:
                        updated_count += 1
            
            AuditTrail.objects.create(
                user=request.user,
                action="Member Data Upload",
                details=f"Uploaded CSV member data. Created: {created_count}, Updated: {updated_count}"
            )

            return Response({
                'detail': f'Success! CellMed records processed. Created {created_count} new and updated {updated_count} existing members.',
                'created': created_count,
                'updated': updated_count
            })
        except Exception as e:
            return Response({'detail': f'Error parsing CSV file: {str(e)}'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class ForceChangePasswordView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        username = request.data.get('username', '').strip()
        old_password = request.data.get('old_password', '')
        new_password = request.data.get('new_password', '')

        if not username or not old_password or not new_password:
            return Response({'detail': 'Username, old password, and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=username, password=old_password)
        if not user:
            return Response({'detail': 'Invalid username or old password.'}, status=status.HTTP_400_BAD_REQUEST)

        user.set_password(new_password)
        user.save()

        profile = user.profile
        profile.change_password_on_next_login = False
        profile.save()

        email_service.send_password_changed_email(user)

        # Log audit trail
        AuditTrail.objects.create(
            user=user,
            action="Password Changed",
            details="User completed required password change on next login"
        )

        token, _ = Token.objects.get_or_create(user=user)
        return Response({
            'token': token.key,
            'user': ProfileSerializer(profile).data
        })


class PrescriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        profile = request.user.profile
        if profile.role != 'doctor':
            return Response({'detail': 'Only doctors can issue prescriptions.'}, status=status.HTTP_403_FORBIDDEN)
        
        patient_id = request.data.get('patient_id')
        if not patient_id:
            return Response({'detail': 'patient_id is required.'}, status=status.HTTP_400_BAD_REQUEST)
        
        patient = get_object_or_404(Profile, id=patient_id, role='patient')
        
        medication = request.data.get('medication', '')
        dosage = request.data.get('dosage', '')
        title = request.data.get('title', f"Prescription from Dr. {profile.user.last_name}")
        renewal_note = request.data.get('renewal_note', 'No renewal note')
        
        prescription = Prescription.objects.create(
            patient=patient,
            doctor=profile,
            title=title,
            medication=medication,
            dosage=dosage,
            renewal_note=renewal_note,
            status='Active'
        )
        
        # Send prescription notification email to patient
        email_service.send_prescription_created_email(prescription)

        # Log audit trail
        AuditTrail.objects.create(
            user=request.user,
            action="Prescription Issued",
            details=f"Prescribed {medication} to {patient.user.get_full_name()}"
        )

        serializer = PrescriptionSerializer(prescription)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    def get(self, request):
        profile = request.user.profile
        if profile.role == 'doctor':
            prescriptions = Prescription.objects.filter(doctor=profile)
        elif profile.role == 'patient':
            prescriptions = Prescription.objects.filter(patient=profile)
        else:
            prescriptions = Prescription.objects.all()
        
        serializer = PrescriptionSerializer(prescriptions, many=True)
        return Response(serializer.data)


class PasswordResetRequestView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        identifier = request.data.get('email_or_username', '').strip()
        if not identifier:
            return Response({'detail': 'Email or username/membership number is required.'}, status=status.HTTP_400_BAD_REQUEST)

        user = None
        prof = Profile.objects.filter(medical_aid_number__iexact=identifier).first()
        if prof:
            user = prof.user
        elif '@' in identifier:
            user = User.objects.filter(email__iexact=identifier).first()
        else:
            user = User.objects.filter(username__iexact=identifier).first()

        if user:
            PasswordResetToken.objects.filter(user=user, is_used=False).delete()
            token_str = str(uuid.uuid4()).replace('-', '')
            expires_at = timezone.now() + timezone.timedelta(minutes=60)
            PasswordResetToken.objects.create(
                user=user,
                token=token_str,
                expires_at=expires_at
            )
            email_service.send_password_reset_email(user, token_str, expires_in_minutes=60)

        return Response({'detail': 'If an account matches that email/username, password reset instructions have been sent.'})


class PasswordResetConfirmView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token_str = request.data.get('token', '').strip()
        new_password = request.data.get('new_password', '').strip()

        if not token_str or not new_password:
            return Response({'detail': 'Reset token and new password are required.'}, status=status.HTTP_400_BAD_REQUEST)

        reset_token = PasswordResetToken.objects.filter(token=token_str, is_used=False).first()
        if not reset_token:
            return Response({'detail': 'Invalid or already used password reset link.'}, status=status.HTTP_400_BAD_REQUEST)

        if timezone.now() > reset_token.expires_at:
            return Response({'detail': 'Password reset link has expired. Please request a new one.'}, status=status.HTTP_400_BAD_REQUEST)

        user = reset_token.user
        user.set_password(new_password)
        user.save()

        reset_token.is_used = True
        reset_token.save()

        if hasattr(user, 'profile'):
            user.profile.change_password_on_next_login = False
            user.profile.save()

        AuditTrail.objects.create(user=user, action="Password Reset Completed", details="Password reset successfully via email reset token")
        email_service.send_password_changed_email(user)

        return Response({'detail': 'Password updated successfully. You may now log in.'})


class SysAdminMembersListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        profile = request.user.profile
        if profile.role not in ['sysadmin', 'admin']:
            return Response({'detail': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)
        
        search_query = request.query_params.get('search', '').strip()
        members = CellMedMember.objects.all().order_by('-id')
        if search_query:
            members = members.filter(
                Q(membership_number__icontains=search_query) |
                Q(first_name__icontains=search_query) |
                Q(last_name__icontains=search_query) |
                Q(id_number__icontains=search_query) |
                Q(email__icontains=search_query) |
                Q(phone__icontains=search_query) |
                Q(plan__icontains=search_query)
            )

        data = [{
            'id': m.id,
            'membership_number': m.membership_number,
            'first_name': m.first_name,
            'last_name': m.last_name,
            'date_of_birth': str(m.date_of_birth) if m.date_of_birth else '',
            'insurer': m.insurer,
            'plan': m.plan,
            'id_number': m.id_number,
            'date_joined': str(m.date_joined) if m.date_joined else '',
            'phone': m.phone,
            'email': m.email,
            'address': m.address,
        } for m in members[:300]]
        return Response(data)


class SysAdminUpdateMemberView(APIView):
    permission_classes = [IsAuthenticated]

    def put(self, request):
        profile = request.user.profile
        if profile.role != 'sysadmin':
            return Response({'detail': 'Only system administrators can update member records.'}, status=status.HTTP_403_FORBIDDEN)

        member_id = request.data.get('id')
        if not member_id:
            return Response({'detail': 'Member ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        member = get_object_or_404(CellMedMember, id=member_id)

        mem_num = request.data.get('membership_number', '').strip().upper()

        if mem_num and CellMedMember.objects.filter(membership_number=mem_num).exclude(id=member.id).exists():
            return Response({'detail': f'Membership number {mem_num} is already assigned to another member.'}, status=status.HTTP_400_BAD_REQUEST)

        member.membership_number = mem_num or member.membership_number
        member.first_name = request.data.get('first_name', member.first_name).strip()
        member.last_name = request.data.get('last_name', member.last_name).strip()
        member.insurer = request.data.get('insurer', member.insurer).strip()
        member.plan = request.data.get('plan', member.plan).strip()
        member.id_number = request.data.get('id_number', member.id_number).strip()
        member.phone = request.data.get('phone', member.phone).strip()
        member.email = request.data.get('email', member.email).strip()
        member.address = request.data.get('address', member.address).strip()

        dob = request.data.get('date_of_birth')
        if dob:
            try:
                member.date_of_birth = dob
            except Exception:
                pass

        date_joined = request.data.get('date_joined')
        if date_joined:
            try:
                member.date_joined = date_joined
            except Exception:
                pass

        member.save()

        AuditTrail.objects.create(
            user=request.user,
            action="Member Update",
            details=f"Updated CellMed member record {member.membership_number} ({member.first_name} {member.last_name})"
        )

        return Response({'detail': f"Member record for {member.first_name} {member.last_name} updated successfully."})


class SysAdminDeleteMemberView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request):
        profile = request.user.profile
        if profile.role not in ['sysadmin', 'admin']:
            return Response({'detail': 'Only administrators can delete member records.'}, status=status.HTTP_403_FORBIDDEN)

        member_id = request.data.get('id') or request.query_params.get('id')
        if not member_id:
            return Response({'detail': 'Member ID is required.'}, status=status.HTTP_400_BAD_REQUEST)

        member = get_object_or_404(CellMedMember, id=member_id)
        num = member.membership_number
        email = member.email
        name = f"{member.first_name} {member.last_name}"

        with transaction.atomic():
            # Delete corresponding registered User/Profile accounts if existing
            if num:
                profiles = list(Profile.objects.filter(medical_aid_number__iexact=num))
                for p in profiles:
                    p.user.delete()
            if email and not email.endswith('@nectacare.local'):
                users = list(User.objects.filter(email__iexact=email))
                for u in users:
                    u.delete()

            member.delete()

            AuditTrail.objects.create(
                user=request.user,
                action="Member Delete",
                details=f"Deleted CellMed member record {num} ({name})"
            )

        return Response({'detail': f"Member record for {name} ({num}) deleted successfully."})


class SecureRecordDownloadView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, record_id):
        record = get_object_or_404(MedicalRecord, id=record_id)
        if not document_service.can_access_record(request.user.profile, record):
            return Response({'detail': 'You do not have authorization to view this medical document.'}, status=status.HTTP_403_FORBIDDEN)

        file_path = record.file_path
        if file_path.startswith('azure://'):
            return Response({'download_url': file_path, 'file_name': record.file_name})

        if file_path.startswith('/media/'):
            relative_path = file_path.lstrip('/')
            full_path = os.path.join(settings.BASE_DIR, relative_path)
        else:
            full_path = os.path.join(settings.MEDIA_ROOT, file_path)

        if not os.path.exists(full_path):
            return Response({'detail': 'Requested document file was not found on server.'}, status=status.HTTP_404_NOT_FOUND)

        return FileResponse(open(full_path, 'rb'), filename=record.file_name or os.path.basename(full_path))


