from django.contrib.auth.models import User
from rest_framework import serializers

from .models import Appointment, AvailabilitySlot, ChatMessage, ConsultationNote, Prescription, Profile, MedicalRecord, Notification, AuditTrail


class UserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'first_name', 'last_name', 'email', 'full_name']

    def get_full_name(self, obj):
        return obj.get_full_name() or obj.username


class AppointmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.user.get_full_name', read_only=True)
    patient_id = serializers.IntegerField(source='patient.id', read_only=True)
    doctor_id = serializers.IntegerField(source='doctor.id', read_only=True)
    patient_membership = serializers.CharField(source='patient.medical_aid_number', read_only=True)
    patient_insurer = serializers.CharField(source='patient.plan', read_only=True)

    class Meta:
        model = Appointment
        fields = ['id', 'patient_name', 'doctor_name', 'patient_id', 'doctor_id', 'reason', 'time_label', 'date', 'status', 'patient_membership', 'patient_insurer', 'timezone', 'rejection_reason']


class AvailabilitySerializer(serializers.ModelSerializer):
    class Meta:
        model = AvailabilitySlot
        fields = ['id', 'day', 'hours', 'is_off']


class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer()
    availability_slots = AvailabilitySerializer(many=True, read_only=True)

    class Meta:
        model = Profile
        fields = [
            'id', 'role', 'title', 'specialty', 'plan', 'insurer', 'id_number', 'date_joined', 'phone', 
            'medical_aid_number', 'date_of_birth', 'address', 'is_verified', 'has_benefits', 'medical_aid_status', 
            'profile_pic', 'user', 'weight', 'height', 'blood_type', 'allergies', 'chronic_conditions', 
            'emergency_contact', 'change_password_on_next_login', 'availability_slots',
            'signature_data', 'doctor_registration_number', 'doctor_qualifications', 'clinic_address'
        ]



class PrescriptionSerializer(serializers.ModelSerializer):
    patient_name = serializers.CharField(source='patient.user.get_full_name', read_only=True)
    doctor_name = serializers.CharField(source='doctor.user.get_full_name', read_only=True)
    patient_id = serializers.IntegerField(source='patient.id', read_only=True)
    doctor_id = serializers.IntegerField(source='doctor.id', read_only=True)
    appointment = serializers.PrimaryKeyRelatedField(queryset=Appointment.objects.all(), required=False, allow_null=True)

    doctor_registration_number = serializers.SerializerMethodField()
    doctor_qualifications = serializers.SerializerMethodField()
    doctor_address = serializers.SerializerMethodField()
    doctor_signature = serializers.SerializerMethodField()

    def get_doctor_registration_number(self, obj):
        return obj.doctor_registration_number or (obj.doctor.doctor_registration_number if obj.doctor else '')

    def get_doctor_qualifications(self, obj):
        return obj.doctor_qualifications or (obj.doctor.doctor_qualifications if obj.doctor else '')

    def get_doctor_address(self, obj):
        return obj.doctor_address or (obj.doctor.clinic_address if obj.doctor else '')

    def get_doctor_signature(self, obj):
        return obj.doctor_signature or (obj.doctor.signature_data if obj.doctor else '')

    class Meta:
        model = Prescription
        fields = [
            'id', 'appointment', 'title', 'medication', 'dosage', 'renewal_note', 'status', 
            'patient_name', 'doctor_name', 'patient_id', 'doctor_id',
            'drugs_json', 'patient_address', 'patient_age', 'doctor_registration_number', 
            'doctor_qualifications', 'doctor_address', 'doctor_signature', 'created_at'
        ]



class ConsultationNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConsultationNote
        fields = ['id', 'text', 'updated_at']


class ChatMessageSerializer(serializers.ModelSerializer):
    sender_name = serializers.CharField(source='sender.user.get_full_name', read_only=True)
    sender_role = serializers.CharField(source='sender.role', read_only=True)

    class Meta:
        model = ChatMessage
        fields = ['id', 'sender_name', 'sender_role', 'body', 'sent_at', 'is_read']


class MedicalRecordSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicalRecord
        fields = ['id', 'patient', 'record_type', 'file_path', 'file_name', 'created_at']


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = ['id', 'message', 'status', 'created_at']


class AuditTrailSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source='user.username', read_only=True)
    user_fullname = serializers.CharField(source='user.get_full_name', read_only=True)

    class Meta:
        model = AuditTrail
        fields = ['id', 'username', 'user_fullname', 'action', 'details', 'timestamp']
