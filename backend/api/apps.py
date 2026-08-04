import os
import time
import threading
from django.apps import AppConfig

class ApiConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'api'

    def ready(self):
        # Run background reminder scheduler thread only in main process
        if os.environ.get('RUN_MAIN') == 'true' or not os.environ.get('RUN_MAIN'):
            def reminder_loop():
                time.sleep(10) # Initial wait for app startup
                while True:
                    try:
                        from django.core.management import call_command
                        call_command('send_appointment_reminders')
                    except Exception as e:
                        print(f"[REMINDER SCHEDULER LOOP ERROR] {e}")
                    time.sleep(300) # Check every 5 minutes

            thread = threading.Thread(target=reminder_loop)
            thread.daemon = True
            thread.start()
