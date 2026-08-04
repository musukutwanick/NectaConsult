from django.contrib import admin

from .models import Appointment, AvailabilitySlot, ChatMessage, ChatThread, ConsultationNote, Profile, Prescription

admin.site.register(Profile)
admin.site.register(Appointment)
admin.site.register(AvailabilitySlot)
admin.site.register(Prescription)
admin.site.register(ConsultationNote)
admin.site.register(ChatThread)
admin.site.register(ChatMessage)
