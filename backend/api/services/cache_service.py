from django.core.cache import cache
from ..models import Profile
from ..serializers import ProfileSerializer

DOCTORS_CACHE_KEY = "nectaconsult_doctors_list"
CACHE_TTL = 300  # 5 minutes

def get_cached_doctors():
    """
    Returns list of doctors from cache or populates cache from database.
    """
    cached_data = cache.get(DOCTORS_CACHE_KEY)
    if cached_data is not None:
        return cached_data

    doctors = Profile.objects.filter(role='doctor').select_related('user').order_by('user__first_name')
    serialized = ProfileSerializer(doctors, many=True).data
    cache.set(DOCTORS_CACHE_KEY, serialized, CACHE_TTL)
    return serialized


def invalidate_doctors_cache():
    """
    Invalidates doctors cache when doctor profile or availability changes.
    """
    cache.delete(DOCTORS_CACHE_KEY)
