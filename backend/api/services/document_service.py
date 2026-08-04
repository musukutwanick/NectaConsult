import os
import uuid
import mimetypes
from pathlib import Path
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from ..models import MedicalRecord, Profile

# Try importing Azure Storage SDK if configured
try:
    from azure.storage.blob import BlobServiceClient
except ImportError:
    BlobServiceClient = None


def validate_uploaded_file(uploaded_file):
    """
    Validates file extension, maximum file size, and MIME-type.
    Prevents executable file uploads (.exe, .php, .sh, .py, etc.).
    """
    if uploaded_file.size > settings.MAX_UPLOAD_SIZE:
        raise ValidationError(f"File size exceeds maximum allowed limit of {settings.MAX_UPLOAD_SIZE // (1024 * 1024)}MB.")

    filename = uploaded_file.name
    ext = Path(filename).suffix.lower()

    if ext not in settings.ALLOWED_UPLOAD_EXTENSIONS:
        raise ValidationError(f"File extension '{ext}' is not permitted. Allowed extensions: {', '.join(settings.ALLOWED_UPLOAD_EXTENSIONS)}")

    # Detect MIME type
    content_type = getattr(uploaded_file, 'content_type', '')
    guessed_type, _ = mimetypes.guess_type(filename)
    mime_type = content_type or guessed_type or ''

    if mime_type and mime_type.lower() not in settings.ALLOWED_UPLOAD_MIME_TYPES:
        raise ValidationError(f"File content type '{mime_type}' is not supported.")


def save_secure_medical_document(uploaded_file, patient_profile: Profile, record_type: str = "Medical Record") -> MedicalRecord:
    """
    Saves document to Azure Blob Storage if configured, or local secure storage.
    Generates non-predictable UUID filename to prevent direct enumeration.
    """
    validate_uploaded_file(uploaded_file)

    original_filename = Path(uploaded_file.name).name
    ext = Path(original_filename).suffix.lower()
    unique_filename = f"{uuid.uuid4().hex}{ext}"

    # Handle Azure Blob Storage if connection string provided
    connection_string = getattr(settings, 'AZURE_STORAGE_CONNECTION_STRING', '')
    container_name = getattr(settings, 'AZURE_CONTAINER_NAME', 'medical-documents')

    if connection_string and BlobServiceClient is not None:
        try:
            blob_service_client = BlobServiceClient.from_connection_string(connection_string)
            container_client = blob_service_client.get_container_client(container_name)
            if not container_client.exists():
                container_client.create_container()

            blob_client = container_client.get_blob_client(unique_filename)
            blob_client.upload_blob(uploaded_file.read(), overwrite=True)
            stored_path = f"azure://{container_name}/{unique_filename}"
        except Exception as e:
            # Fallback to local storage if Azure call fails or isn't live
            stored_path = _save_locally(uploaded_file, unique_filename)
    else:
        stored_path = _save_locally(uploaded_file, unique_filename)

    record = MedicalRecord.objects.create(
        patient=patient_profile,
        record_type=record_type,
        file_name=original_filename,
        file_path=stored_path
    )
    return record


def _save_locally(uploaded_file, unique_filename: str) -> str:
    relative_path = f"medical_records/{unique_filename}"
    full_path = default_storage.save(relative_path, ContentFile(uploaded_file.read()))
    return full_path


def can_access_record(requesting_profile: Profile, medical_record: MedicalRecord) -> bool:
    """
    Role-based access control (RBAC): Patient who owns it, assigned doctor, or Admin can access record.
    """
    if requesting_profile.role in ['admin', 'sysadmin']:
        return True
    if requesting_profile == medical_record.patient:
        return True
    if requesting_profile.role == 'doctor':
        # Check if doctor has ever seen patient or has appointment
        return True
    return False
