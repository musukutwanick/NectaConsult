from django.contrib.auth.hashers import make_password
from django.db import migrations


def seed_demo_data(apps, schema_editor):
    User = apps.get_model('auth', 'User')
    Profile = apps.get_model('api', 'Profile')
    AvailabilitySlot = apps.get_model('api', 'AvailabilitySlot')
    Appointment = apps.get_model('api', 'Appointment')
    Prescription = apps.get_model('api', 'Prescription')
    ConsultationNote = apps.get_model('api', 'ConsultationNote')
    ChatThread = apps.get_model('api', 'ChatThread')
    ChatMessage = apps.get_model('api', 'ChatMessage')

    doctor_user, _ = User.objects.update_or_create(
        username='dr.moyo',
        defaults={
            'first_name': 'Daniel',
            'last_name': 'Moyo',
            'email': 'daniel.moyo@nectacare.local',
            'is_staff': True,
            'password': make_password('password123'),
        },
    )
    patient_user, _ = User.objects.update_or_create(
        username='lebo.mokoena',
        defaults={
            'first_name': 'Lebo',
            'last_name': 'Mokoena',
            'email': 'lebo.mokoena@nectacare.local',
            'password': make_password('password123'),
        },
    )

    doctor_profile, _ = Profile.objects.update_or_create(
        user=doctor_user,
        defaults={
            'role': 'doctor',
            'title': 'Dr. Daniel Moyo',
            'specialty': 'Cardiologist',
            'plan': '',
            'phone': '+27 82 555 1100',
        },
    )
    patient_profile, _ = Profile.objects.update_or_create(
        user=patient_user,
        defaults={
            'role': 'patient',
            'title': 'Lebo Mokoena',
            'specialty': '',
            'plan': 'CellMed Gold',
            'phone': '+27 82 555 0101',
        },
    )

    AvailabilitySlot.objects.filter(doctor=doctor_profile).delete()
    AvailabilitySlot.objects.bulk_create([
        AvailabilitySlot(doctor=doctor_profile, day='Monday', hours='08:00 - 16:00', is_off=False),
        AvailabilitySlot(doctor=doctor_profile, day='Tuesday', hours='08:00 - 16:00', is_off=False),
        AvailabilitySlot(doctor=doctor_profile, day='Wednesday', hours='10:00 - 18:00', is_off=False),
        AvailabilitySlot(doctor=doctor_profile, day='Thursday', hours='08:00 - 16:00', is_off=False),
        AvailabilitySlot(doctor=doctor_profile, day='Friday', hours='08:00 - 14:00', is_off=False),
        AvailabilitySlot(doctor=doctor_profile, day='Saturday', hours='Off', is_off=True),
    ])

    Appointment.objects.filter(doctor=doctor_profile, patient=patient_profile).delete()
    Appointment.objects.bulk_create([
        Appointment(patient=patient_profile, doctor=doctor_profile, reason='Follow-up consultation', time_label='14:30', status='start'),
        Appointment(patient=patient_profile, doctor=doctor_profile, reason='Skin rash review', time_label='15:15', status='start'),
        Appointment(patient=patient_profile, doctor=doctor_profile, reason='Blood pressure check', time_label='16:00', status='start'),
        Appointment(patient=patient_profile, doctor=doctor_profile, reason='Prescription renewal', time_label='11:00', status='done'),
    ])

    Prescription.objects.update_or_create(
        patient=patient_profile,
        doctor=doctor_profile,
        title='Blood pressure medication',
        defaults={'renewal_note': 'Renewal available until Friday', 'status': 'Ready for review'},
    )

    ConsultationNote.objects.update_or_create(
        doctor=doctor_profile,
        patient=patient_profile,
        defaults={'text': 'Quick note for next patient'},
    )

    thread, _ = ChatThread.objects.get_or_create(doctor=doctor_profile, patient=patient_profile)
    if not thread.messages.exists():
        ChatMessage.objects.bulk_create([
            ChatMessage(thread=thread, sender=doctor_profile, body='Good morning Lebo. How have you been feeling this week?'),
            ChatMessage(thread=thread, sender=patient_profile, body='I have been okay, but my blood pressure was a little high yesterday.'),
            ChatMessage(thread=thread, sender=doctor_profile, body='Thanks. Please keep logging your readings and I will review them in today\'s consult.'),
        ])


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0001_initial'),
        ('auth', '0012_alter_user_first_name_max_length'),
    ]

    operations = [
        migrations.RunPython(seed_demo_data, migrations.RunPython.noop),
    ]
