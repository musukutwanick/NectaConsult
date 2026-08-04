from datetime import timedelta
import re
from django.utils import timezone
from django.contrib.auth.models import User
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from rest_framework.authtoken.models import Token
from ..models import FailedLoginAttempt, Profile

MAX_FAILED_LOGIN_ATTEMPTS = 5
LOCKOUT_DURATION_MINUTES = 15

def check_password_complexity(password: str) -> tuple[bool, str]:
    """
    Validates password complexity against policy:
    - At least 8 characters
    - At least one uppercase letter
    - At least one lowercase letter
    - At least one number
    - At least one special character
    """
    if len(password) < 8:
        return False, "Password must be at least 8 characters long."
    if not re.search(r'[A-Z]', password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r'[a-z]', password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r'[0-9]', password):
        return False, "Password must contain at least one number."
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};:\'",.<>/?\\|]', password):
        return False, "Password must contain at least one special character."
    
    try:
        validate_password(password)
    except ValidationError as e:
        return False, "; ".join(e.messages)
        
    return True, ""


def is_account_locked(username: str, ip_address: str = "") -> tuple[bool, str]:
    """
    Checks if account/IP is locked out due to excessive failed attempts.
    """
    attempt = FailedLoginAttempt.objects.filter(username=username).first()
    if not attempt:
        return False, ""
        
    if attempt.attempt_count >= MAX_FAILED_LOGIN_ATTEMPTS:
        cutoff = timezone.now() - timedelta(minutes=LOCKOUT_DURATION_MINUTES)
        if attempt.last_attempt > cutoff:
            remaining = int((attempt.last_attempt + timedelta(minutes=LOCKOUT_DURATION_MINUTES) - timezone.now()).total_seconds() / 60) + 1
            return True, f"Account locked due to multiple failed login attempts. Please try again in {remaining} minutes."
        else:
            # Lockout expired, reset
            attempt.attempt_count = 0
            attempt.save()
            
    return False, ""


def record_failed_login(username: str, ip_address: str = ""):
    """
    Increments failed login counter for username.
    """
    attempt, created = FailedLoginAttempt.objects.get_or_create(
        username=username,
        defaults={'ip_address': ip_address, 'attempt_count': 1}
    )
    if not created:
        attempt.attempt_count += 1
        attempt.ip_address = ip_address
        attempt.save()


def reset_failed_login(username: str):
    """
    Resets failed login count on successful login.
    """
    FailedLoginAttempt.objects.filter(username=username).delete()


def revoke_user_auth_tokens(user: User):
    """
    Revokes and deletes DRF auth tokens for secure logout and password reset.
    """
    Token.objects.filter(user=user).delete()
