import { useState, useEffect, useRef } from 'react';
import { api, displayName } from '../api';

const TIMEZONES = [
  'Africa/Johannesburg',
  'Africa/Harare',
  'Africa/Nairobi',
  'Africa/Lagos',
  'Europe/London',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Kolkata',
  'Asia/Dubai',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'UTC'
];

export default function Appointments({ token, role, onRefreshDashboard, autoOpenBook, onCloseBookModal, onStartConsultation, showToast }) {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [openMenuId, setOpenMenuId] = useState(null);


  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (!event.target.closest || !event.target.closest('.action-menu-container')) {
        setOpenMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);



  function renderDoctorAvatar(doc, size = 36) {
    if (!doc) return null;
    const name = doc.title || (doc.user ? `${doc.user.first_name || ''} ${doc.user.last_name || ''}` : 'Doctor');
    const profilePic = doc.profile_pic || doc.user?.profile?.profile_pic;
    
    // Extract initials
    const initials = name.replace('Dr. ', '').split(' ').filter(Boolean).map(n => n[0]).join('').substring(0, 2).toUpperCase() || 'DR';
    
    return (
      <div style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: '#ffffff',
        border: '1.5px solid #ffbf47',
        color: '#12213d',
        display: 'grid',
        placeItems: 'center',
        fontSize: `${Math.max(11, Math.round(size * 0.38))}px`,
        fontWeight: '800',
        flexShrink: 0,
        boxShadow: '0 2px 6px rgba(255, 191, 71, 0.22)',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}>
        {profilePic ? (
          <img
            src={profilePic}
            alt={name}
            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
            onError={(e) => { e.target.style.display = 'none'; }}
          />
        ) : (
          initials
        )}
      </div>
    );
  }
  
  // Patient booking form states
  const [bookingForm, setBookingForm] = useState({
    doctor_id: '',
    reason: '',
    date: '',
    time_label: '',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  });
  const [selectedDoctorSlots, setSelectedDoctorSlots] = useState([]);
  const [showBookModal, setShowBookModal] = useState(false);
  const [searchDoctorQuery, setSearchDoctorQuery] = useState('');
  
  // Reschedule form states
  const [rescheduleForm, setRescheduleForm] = useState({
    appointment_id: '',
    date: '',
    time_label: '',
  });
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  const weekdaysHeader = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    return { firstDay, totalDays, year, month };
  };

  function isDoctorAvailableOnDay(dateString, doctorObj) {
    if (!doctorObj) return false;
    
    const dateParts = dateString.split('-');
    const year = Number(dateParts[0]);
    const month = Number(dateParts[1]) - 1;
    const day = Number(dateParts[2]);
    const dateObj = new Date(year, month, day);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (dateObj < today) {
      return false;
    }

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdayName = weekdays[dateObj.getDay()];
    
    const slots = doctorObj.availability_slots || [];
    if (slots.length === 0) {
      return dateObj.getDay() >= 1 && dateObj.getDay() <= 5;
    }
    
    const activeSlot = slots.find(s => s.day === weekdayName);
    return activeSlot ? !activeSlot.is_off : false;
  }

  function getDoctorNextAvailable(doctorObj) {
    if (!doctorObj) return { text: 'Available today', dateStr: '', timeSlot: '' };

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const slots = doctorObj.availability_slots || [];
    const today = new Date();
    const currentHour = today.getHours();

    for (let offset = 0; offset < 14; offset++) {
      const candidate = new Date(today);
      candidate.setDate(today.getDate() + offset);

      const year = candidate.getFullYear();
      const month = String(candidate.getMonth() + 1).padStart(2, '0');
      const day = String(candidate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayName = weekdays[candidate.getDay()];

      let isOff = false;
      let hoursStr = '08:00 - 17:00';

      if (slots.length > 0) {
        const activeSlot = slots.find((s) => s.day === dayName);
        if (!activeSlot || activeSlot.is_off) {
          isOff = true;
        } else {
          hoursStr = activeSlot.hours || '08:00 - 17:00';
        }
      } else {
        if (candidate.getDay() === 0 || candidate.getDay() === 6) {
          isOff = true;
        }
      }

      if (!isOff) {
        const parts = hoursStr.split('-');
        const startHourStr = parts[0]?.trim() || '08:00';
        const endHourStr = parts[1]?.trim() || '17:00';

        let startH = parseInt(startHourStr.split(':')[0], 10) || 8;
        const endH = parseInt(endHourStr.split(':')[0], 10) || 17;

        // Skip past hours for today
        if (offset === 0) {
          if (currentHour >= startH) {
            startH = currentHour + 1;
          }
          if (startH >= endH) {
            continue; // Day is past working hours, check tomorrow
          }
        }

        // Filter booked appointments for this doctor on this day
        if (appointments && appointments.length > 0) {
          const docAppts = appointments.filter((a) => {
            const matchesDoc = (a.doctor_id && String(a.doctor_id) === String(doctorObj.id)) ||
                               (a.doctor && String(a.doctor) === String(doctorObj.id)) ||
                               (a.doctor_name && doctorObj.user && a.doctor_name.includes(doctorObj.user.last_name || ''));
            const matchesDate = a.date === dateStr || (a.appointment_date && a.appointment_date.startsWith(dateStr));
            const notCancelled = a.status !== 'cancelled' && a.status !== 'rejected';
            return matchesDoc && matchesDate && notCancelled;
          });

          // Skip booked time slots
          while (startH < endH) {
            const slotPrefix = `${String(startH).padStart(2, '0')}:00`;
            const isBooked = docAppts.some((a) => {
              const timeVal = a.time_label || a.time || '';
              return timeVal.includes(slotPrefix);
            });
            if (!isBooked) {
              break;
            }
            startH++;
          }

          if (startH >= endH) {
            continue; // All slots booked out for this day, try next candidate day
          }
        }

        const slotTimeDisplay = `${String(startH).padStart(2, '0')}:00`;
        const firstSlotLabel = `${String(startH).padStart(2, '0')}:00 - ${String(startH + 1).padStart(2, '0')}:00`;

        let labelText = '';
        if (offset === 0) {
          labelText = `Available Today (${slotTimeDisplay})`;
        } else if (offset === 1) {
          labelText = `Tomorrow (${slotTimeDisplay})`;
        } else {
          labelText = `${dayName} (${slotTimeDisplay})`;
        }

        return { text: labelText, dateStr, timeSlot: firstSlotLabel };
      }
    }
    return { text: 'Fully booked / Schedule unavailable', dateStr: '', timeSlot: '' };
  }

  function getDoctorScheduleSummary(doctorObj) {
    if (!doctorObj) return 'Mon – Fri (08:00 - 17:00)';
    const slots = doctorObj.availability_slots || [];
    if (slots.length === 0) return 'Mon – Fri (08:00 - 17:00)';
    
    const activeSlots = slots.filter((s) => !s.is_off);
    if (activeSlots.length === 0) return 'Schedule unavailable';
    
    const dayMap = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri', Saturday: 'Sat', Sunday: 'Sun' };
    const daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    
    const sortedActiveDays = daysOrder.filter((d) => activeSlots.some((s) => s.day === d));
    const hours = activeSlots[0]?.hours || '08:00 - 17:00';

    if (sortedActiveDays.length === 5 && sortedActiveDays.every((d, i) => d === daysOrder[i])) {
      return `Mon – Fri (${hours})`;
    }
    if (sortedActiveDays.length === 6 && sortedActiveDays.every((d, i) => d === daysOrder[i])) {
      return `Mon – Sat (${hours})`;
    }
    if (sortedActiveDays.length === 7) {
      return `Every day (${hours})`;
    }
    
    const shortDays = sortedActiveDays.map((d) => dayMap[d] || d).join(', ');
    return `${shortDays} (${hours})`;
  }

  async function autoSelectNextAvailable(doc) {
    if (!doc) return;
    const next = getDoctorNextAvailable(doc);
    if (next.dateStr) {
      setBookingForm((prev) => ({
        ...prev,
        doctor_id: doc.id.toString(),
        date: next.dateStr,
        time_label: next.timeSlot,
      }));
      setCalendarMonth(new Date(next.dateStr.replace(/-/g, '/')));
      try {
        const freeSlots = await api.getDoctorAvailability(token, doc.id, next.dateStr);
        setSelectedDoctorSlots(freeSlots);
        const firstAvailable = freeSlots.find((s) => s.available);
        if (firstAvailable) {
          setBookingForm((prev) => ({
            ...prev,
            time_label: firstAvailable.time,
          }));
        }
      } catch (err) {
        console.error('Failed auto fetching availability', err);
      }
    }
  }

  function handleOpenBooking(doctor) {
    const targetDoc = doctor || (doctors.length > 0 ? doctors[0] : null);
    setBookingForm({
      doctor_id: targetDoc ? targetDoc.id.toString() : '',
      reason: '',
      date: '',
      time_label: '',
    });
    setSelectedDoctorSlots([]);
    setShowBookModal(true);
    if (targetDoc) {
      autoSelectNextAvailable(targetDoc);
    }
  }

  function handleDoctorChange(doctorId) {
    const doc = doctors.find((d) => d.id.toString() === doctorId.toString());
    if (doc) {
      autoSelectNextAvailable(doc);
    } else {
      setBookingForm((prev) => ({ ...prev, doctor_id: '', date: '', time_label: '' }));
      setSelectedDoctorSlots([]);
    }
  }

  useEffect(() => {
    loadAppointments();
    if (role === 'patient') {
      loadDoctors();
    }
  }, []);

  useEffect(() => {
    if (autoOpenBook && role === 'patient') {
      setShowBookModal(true);
      if (onCloseBookModal) {
        onCloseBookModal();
      }
    }
  }, [autoOpenBook, role]);

  async function loadAppointments() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getAppointments(token);
      setAppointments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDoctors() {
    try {
      const data = await api.getDoctors(token);
      setDoctors(data);
    } catch (err) {
      console.error('Failed to load doctors list', err);
    }
  }

  async function fetchAvailability(doctorId, date) {
    if (!doctorId || !date) {
      setSelectedDoctorSlots([]);
      return;
    }
    try {
      const freeSlots = await api.getDoctorAvailability(token, doctorId, date);
      setSelectedDoctorSlots(freeSlots);
    } catch (err) {
      setError(err.message || 'Failed to fetch doctor availability.');
      setSelectedDoctorSlots([]);
    }
  }

  function handleDoctorChange(doctorId) {
    const updatedForm = { ...bookingForm, doctor_id: doctorId, date: '', time_label: '' };
    setBookingForm(updatedForm);
    setSelectedDoctorSlots([]);
  }

  function handleDateChange(date) {
    const updatedForm = { ...bookingForm, date: date, time_label: '' };
    setBookingForm(updatedForm);
    fetchAvailability(updatedForm.doctor_id, date);
  }

  async function handleBookSubmit(e) {
    e.preventDefault();
    setError('');
    if (!bookingForm.doctor_id || !bookingForm.date || !bookingForm.time_label) {
      setError('Please select a doctor, date, and time slot.');
      return;
    }

    try {
      await api.bookAppointment(token, bookingForm);
      setShowBookModal(false);
      setBookingForm({ doctor_id: '', reason: '', date: '', time_label: '', timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC' });
      await loadAppointments();
      if (onRefreshDashboard) onRefreshDashboard();
      if (showToast) showToast('Appointment sent for approval', 'success');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCancel(appointmentId) {
    if (!window.confirm('Are you sure you want to cancel this appointment?')) return;
    setError('');
    try {
      await api.cancelAppointment(token, appointmentId);
      await loadAppointments();
      if (onRefreshDashboard) onRefreshDashboard();
      if (showToast) showToast('Appointment cancelled successfully', 'success');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDoctorApprove(appointmentId) {
    setError('');
    try {
      await api.doctorApproveAppointment(token, appointmentId);
      await loadAppointments();
      if (onRefreshDashboard) onRefreshDashboard();
      if (showToast) showToast('Appointment accepted successfully', 'success');
    } catch (err) {
      setError(err.message);
    }
  }

  function openReschedule(appointment) {
    setRescheduleForm({
      appointment_id: appointment.id,
      date: appointment.date || '',
      time_label: appointment.time_label || '',
    });
    setShowRescheduleModal(true);
  }

  async function handleRescheduleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      await api.rescheduleAppointment(
        token, 
        rescheduleForm.appointment_id, 
        rescheduleForm.date, 
        rescheduleForm.time_label
      );
      setShowRescheduleModal(false);
      await loadAppointments();
      if (onRefreshDashboard) onRefreshDashboard();
      if (showToast) showToast('Appointment rescheduled successfully', 'success');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleStatusChange(appointmentId, nextStatus) {
    setError('');
    try {
      await api.updateAppointmentStatus(token, appointmentId, nextStatus);
      await loadAppointments();
      if (onRefreshDashboard) onRefreshDashboard();
      if (showToast) {
        if (nextStatus === 'start') {
          showToast('Consultation started', 'success');
        } else if (nextStatus === 'done') {
          showToast('Consultation completed successfully', 'success');
        }
      }
    } catch (err) {
      setError(err.message);
    }
  }

  const selectedDocObj = doctors.find(d => String(d.id) === String(bookingForm.doctor_id));
  const { firstDay, totalDays, year, month } = getDaysInMonth(calendarMonth);

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarDays.push(d);
  }

  const handlePrevMonth = () => {
    setCalendarMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCalendarMonth(new Date(year, month + 1, 1));
  };

  return (
    <div className="appointments-page-container" style={{ position: 'relative' }}>
      {role === 'patient' ? (
        <>
          {/* Breadcrumbs */}
          <div className="appointments-breadcrumbs">
            Dashboard &rsaquo; <span>Appointments</span>
          </div>

          {/* Heading */}
          <div className="appointments-hero-section">
            <h1 className="appointments-hero-title">Book a consultation</h1>
            <p className="appointments-hero-sub">Choose a doctor, then pick a time that works for you.</p>
          </div>

          {/* Search bar & filter row */}
          <div className="appointments-search-row">
            <div className="appointments-search-box">
              <span className="search-icon-span">
                <i className="fa-solid fa-magnifying-glass"></i>
              </span>
              <input
                type="search"
                placeholder="Search doctors, specialties..."
                value={searchDoctorQuery}
                onChange={(e) => setSearchDoctorQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Doctors Card Grid */}
          <div className="appointments-doctors-grid">
            {doctors
              .filter((doc) => {
                const query = searchDoctorQuery.toLowerCase();
                const name = (doc.title || doc.user.full_name || '').toLowerCase();
                const specialty = (doc.specialty || '').toLowerCase();
                return name.includes(query) || specialty.includes(query);
              })
              .map((doc) => {
                const initials = doc.title
                  ? doc.title.replace('Dr. ', '').split(' ').map((n) => n[0]).join('').toUpperCase()
                  : 'DR';

                const nextAvailable = getDoctorNextAvailable(doc);

                return (
                  <div key={doc.id} className="doctor-card-panel" onClick={() => handleOpenBooking(doc)}>
                    <div className="doctor-card-inner">
                      <div className="doctor-avatar-circle">
                        {(doc.profile_pic || doc.user?.profile?.profile_pic) ? (
                          <img
                            src={doc.profile_pic || doc.user?.profile?.profile_pic}
                            alt={doc.title || doc.user?.full_name}
                            style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }}
                            onError={(e) => { e.target.style.display = 'none'; }}
                          />
                        ) : (
                          initials
                        )}
                      </div>
                      <div className="doctor-card-info">
                        <h3>{doc.title || doc.user.full_name}</h3>
                        <p className="doctor-card-specialty">{doc.specialty || 'General Practitioner'}</p>
                        <p className="doctor-card-availability">
                          <span className="dot-green">●</span> {getDoctorScheduleSummary(doc)}
                        </p>
                        <p style={{ fontSize: '0.78rem', color: '#6b7280', margin: '-4px 0 12px 0' }}>
                          Next available: <strong>{nextAvailable.text}</strong>
                        </p>
                        <button
                          type="button"
                          className="doctor-book-btn-primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenBooking(doc);
                          }}
                        >
                          Book now &rarr;
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>

          {error && <p className="form-message form-error" style={{ marginTop: '20px' }}>{error}</p>}

          {/* List of booked/scheduled appointments */}
          <div style={{ marginTop: '48px', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '16px', color: 'var(--text)' }}>
              My Scheduled Consultations
            </h2>
            
            {loading ? (
              <p>Loading appointments...</p>
            ) : (
              <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ background: 'rgba(29,44,72,0.04)', borderBottom: '1px solid var(--border)' }}>
                      <th style={{ padding: '16px' }}>Doctor</th>
                      <th style={{ padding: '16px' }}>Reason</th>
                      <th style={{ padding: '16px' }}>Date</th>
                      <th style={{ padding: '16px' }}>Time</th>
                      <th style={{ padding: '16px' }}>Status</th>
                      <th style={{ padding: '16px' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                          No appointments scheduled.
                        </td>
                      </tr>
                    ) : (
                      appointments.map((appointment) => (
                        <tr key={appointment.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '16px', fontWeight: '600' }}>
                            {appointment.doctor_name}
                          </td>
                          <td style={{ padding: '16px' }}>{appointment.reason}</td>
                          <td style={{ padding: '16px' }}>{appointment.date || 'TBD'}</td>
                          <td style={{ padding: '16px' }}>{appointment.time_label} {appointment.timezone && <span style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'block' }}>({appointment.timezone})</span>}</td>
                          <td style={{ padding: '16px' }}>
                            {appointment.status === 'booked' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>
                                <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px', fontSize: '12px', color: '#0f172a' }}></i>
                                PENDING
                              </span>
                            ) : appointment.status === 'verified' ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>
                                <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px', fontSize: '12px', color: '#0f172a' }}></i>
                                PENDING DOCTOR
                              </span>
                            ) : (
                              <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>
                                {appointment.status}
                              </span>
                            )}

                            {appointment.rejection_reason && (
                              <span style={{ fontSize: '11px', color: '#ef4444', display: 'block', marginTop: '4px' }}>
                                Reason: {appointment.rejection_reason}
                              </span>
                            )}
                          </td>

                          <td style={{ padding: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {appointment.status === 'start' && (
                              <button
                                type="button"
                                className="cta-button"
                                style={{
                                  background: '#10b981',
                                  color: 'white',
                                  fontWeight: 'bold',
                                  padding: '8px 14px',
                                  borderRadius: '8px',
                                  fontSize: '13px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
                                }}
                                onClick={() => onStartConsultation && onStartConsultation(appointment)}
                              >
                                <i className="fa-solid fa-video"></i>
                                Join Consultation &rarr;
                              </button>
                            )}
                            {appointment.status !== 'cancelled' && appointment.status !== 'done' && appointment.status !== 'start' && (
                              <>
                                <button type="button" className="mini-button" onClick={() => openReschedule(appointment)}>
                                  Reschedule
                                </button>
                                <button type="button" className="mini-button" style={{ opacity: 0.75 }} onClick={() => handleCancel(appointment.id)}>
                                  Cancel
                                </button>
                              </>
                            )}
                          </td>

                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        // Doctor Schedule List view
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <div>
              <h1 style={{ margin: 0 }}>Appointment Scheduling</h1>
              <p style={{ color: 'var(--muted)', margin: '4px 0 0 0' }}>
                Review patient consultation schedules.
              </p>
            </div>
          </div>

          {error && <p className="form-message form-error">{error}</p>}

          {loading ? (
            <p>Loading appointments...</p>
          ) : (
            <div className="panel" style={{ padding: '0', overflow: 'visible' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ background: 'rgba(29,44,72,0.04)', borderBottom: '1px solid var(--border)' }}>
                    <th style={{ padding: '16px' }}>Patient</th>
                    <th style={{ padding: '16px' }}>Reason</th>
                    <th style={{ padding: '16px' }}>Date</th>
                    <th style={{ padding: '16px' }}>Time</th>
                    <th style={{ padding: '16px' }}>Status</th>
                    <th style={{ padding: '16px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                        No appointments scheduled.
                      </td>
                    </tr>
                  ) : (
                    appointments.map((appointment) => (
                      <tr key={appointment.id} style={{ borderBottom: '1px solid var(--border)', position: 'relative', zIndex: openMenuId === appointment.id ? 100 : 1 }}>

                        <td style={{ padding: '16px', fontWeight: '600' }}>
                          {appointment.patient_name}
                        </td>
                        <td style={{ padding: '16px' }}>{appointment.reason}</td>
                        <td style={{ padding: '16px' }}>{appointment.date || 'TBD'}</td>
                        <td style={{ padding: '16px' }}>{appointment.time_label} {appointment.timezone && <span style={{ fontSize: '11.5px', color: 'var(--muted)', display: 'block' }}>({appointment.timezone})</span>}</td>
                        <td style={{ padding: '16px' }}>
                          {appointment.status === 'booked' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>
                              <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px', fontSize: '12px', color: '#0f172a' }}></i>
                              PENDING
                            </span>
                          ) : appointment.status === 'verified' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', color: '#0f172a', fontWeight: 700, fontSize: '13px' }}>
                              <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px', fontSize: '12px', color: '#0f172a' }}></i>
                              PENDING APPROVAL
                            </span>
                          ) : (
                            <span style={{ color: '#0f172a', fontWeight: 700, fontSize: '13px', textTransform: 'uppercase' }}>
                              {appointment.status}
                            </span>
                          )}
                        </td>

                        <td style={{ padding: '16px', position: 'relative' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            {/* Primary Join Chat button when active or not cancelled/done */}
                            {appointment.status !== 'cancelled' && appointment.status !== 'done' && (
                              <button
                                type="button"
                                className="cta-button compact"
                                style={{
                                  background: '#10b981',
                                  color: 'white',
                                  fontWeight: 'bold',
                                  padding: '6px 14px',
                                  borderRadius: '8px',
                                  fontSize: '13px',
                                  border: 'none',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  boxShadow: '0 2px 8px rgba(16, 185, 129, 0.3)'
                                }}
                                onClick={async () => {
                                  if (appointment.status !== 'start') {
                                    await handleStatusChange(appointment.id, 'start');
                                  }
                                  if (onStartConsultation) onStartConsultation(appointment);
                                }}
                              >
                                <i className="fa-solid fa-video"></i>
                                Join Chat &rarr;
                              </button>
                            )}

                            {/* 3-Dotted Lines Options Menu (⋮) */}
                            {appointment.status !== 'cancelled' && appointment.status !== 'done' && (
                              <div className="action-menu-container" style={{ position: 'relative' }}>

                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(openMenuId === appointment.id ? null : appointment.id);
                                  }}
                                  style={{
                                    background: 'none',
                                    border: '1px solid var(--border)',
                                    borderRadius: '8px',
                                    width: '34px',
                                    height: '34px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    color: '#475569',
                                    fontSize: '16px',
                                    transition: 'background 0.15s'
                                  }}
                                  title="More options"
                                >
                                  <i className="fa-solid fa-ellipsis-vertical"></i>
                                </button>

                                {openMenuId === appointment.id && (
                                  <div style={{
                                    position: 'absolute',
                                    left: 'calc(100% + 8px)',
                                    top: '0px',
                                    background: '#ffffff',
                                    border: '1px solid var(--border)',
                                    borderRadius: '10px',
                                    boxShadow: '0 10px 25px rgba(0,0,0,0.18)',
                                    zIndex: 1000,
                                    minWidth: '160px',
                                    padding: '6px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '2px'
                                  }}>

                                    {appointment.status === 'verified' && (
                                      <button
                                        type="button"
                                        onMouseDown={(e) => e.stopPropagation()}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDoctorApprove(appointment.id);
                                          setOpenMenuId(null);
                                        }}
                                        style={{
                                          display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                          padding: '8px 12px', background: 'none', border: 'none', borderRadius: '6px',
                                          cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#10b981'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                      >
                                        <i className="fa-solid fa-check" style={{ width: '16px' }}></i> Accept
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleStatusChange(appointment.id, 'done');
                                        setOpenMenuId(null);
                                      }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                        padding: '8px 12px', background: 'none', border: 'none', borderRadius: '6px',
                                        cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#0f172a'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                      <i className="fa-solid fa-circle-check" style={{ color: '#10b981', width: '16px' }}></i> Mark as Done
                                    </button>

                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openReschedule(appointment);
                                        setOpenMenuId(null);
                                      }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                        padding: '8px 12px', background: 'none', border: 'none', borderRadius: '6px',
                                        cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#0f172a'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                      <i className="fa-solid fa-calendar-days" style={{ color: '#3b82f6', width: '16px' }}></i> Reschedule
                                    </button>

                                    <button
                                      type="button"
                                      onMouseDown={(e) => e.stopPropagation()}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleCancel(appointment.id);
                                        setOpenMenuId(null);
                                      }}
                                      style={{
                                        display: 'flex', alignItems: 'center', gap: '8px', width: '100%',
                                        padding: '8px 12px', background: 'none', border: 'none', borderRadius: '6px',
                                        cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: '#ef4444'
                                      }}
                                      onMouseEnter={(e) => e.currentTarget.style.background = '#fef2f2'}
                                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                                    >
                                      <i className="fa-solid fa-ban" style={{ width: '16px' }}></i> Cancel
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>

                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Book Appointment Side Drawer (Slide-out panel) */}
      {showBookModal && (
        <div className="drawer-overlay">
          {/* Overlay click area to close */}
          <div 
            style={{ position: 'absolute', inset: 0, zIndex: -1 }} 
            onClick={() => setShowBookModal(false)}
          />
          <div className="drawer-panel">
            {/* Header */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center', 
              padding: '20px 24px', 
              borderBottom: '1px solid var(--border)', 
              background: '#f8fafc' 
            }}>
              <h3 style={{ marginTop: 0, margin: 0, fontSize: '1.25rem', fontWeight: '800', color: 'var(--text)' }}>
                Book New Consultation
              </h3>
              <button 
                onClick={() => setShowBookModal(false)} 
                style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer', color: 'var(--muted)' }}
              >
                ×
              </button>
            </div>
            
            {/* Scrollable Form Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
              {error && (
                <div className="auth3-error-box" style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-circle-exclamation"></i>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleBookSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Select Doctor */}
                <div ref={dropdownRef} style={{ display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                  <label style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                    Select Healthcare Professional
                  </label>
                  
                  {/* Dropdown Trigger */}
                  <div 
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: '12px',
                      border: '1.5px solid var(--border)',
                      background: 'white',
                      fontSize: '14.5px',
                      color: 'var(--text)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none',
                      transition: 'all 0.15s ease',
                      boxShadow: 'var(--shadow-soft)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={(e) => {
                      if (!isDropdownOpen) e.currentTarget.style.borderColor = 'var(--border)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      {bookingForm.doctor_id ? (
                        (() => {
                          const doc = doctors.find(d => d.id.toString() === bookingForm.doctor_id.toString());
                          if (!doc) return <span style={{ color: 'var(--muted)' }}>-- Select Doctor --</span>;
                          return (
                            <>
                              {renderDoctorAvatar(doc)}
                              <div>
                                <strong style={{ display: 'block', fontSize: '14px', color: 'var(--text)', textAlign: 'left' }}>
                                  {doc.title || (doc.user ? `${doc.user.first_name || ''} ${doc.user.last_name || ''}` : 'Doctor')}
                                </strong>
                                <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', textAlign: 'left' }}>
                                  {doc.specialty || 'General Practitioner'}
                                </span>
                              </div>
                            </>
                          );
                        })()
                      ) : (
                        <span style={{ color: 'var(--muted)' }}>-- Select Doctor --</span>
                      )}
                    </div>
                    <span style={{ transition: 'transform 0.2s', transform: isDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', fontSize: '12px', color: 'var(--muted)' }}>
                      ▼
                    </span>
                  </div>

                  {/* Dropdown Options Container */}
                  {isDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      marginTop: '6px',
                      background: 'white',
                      border: '1px solid var(--border)',
                      borderRadius: '12px',
                      boxShadow: '0 12px 30px rgba(18, 33, 61, 0.12)',
                      zIndex: 1000,
                      maxHeight: '260px',
                      overflowY: 'auto',
                      padding: '6px'
                    }}>
                      <div 
                        onClick={() => {
                          handleDoctorChange("");
                          setIsDropdownOpen(false);
                        }}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          color: 'var(--muted)',
                          transition: 'background 0.1s',
                          textAlign: 'left'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        -- Select Doctor --
                      </div>
                      
                      {doctors.map(doc => {
                        const isSelected = doc.id.toString() === bookingForm.doctor_id.toString();
                        return (
                          <div 
                            key={doc.id}
                            onClick={() => {
                              handleDoctorChange(doc.id.toString());
                              setIsDropdownOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                              padding: '8px 12px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              background: isSelected ? 'rgba(26, 128, 199, 0.06)' : 'transparent',
                              transition: 'all 0.15s ease'
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'rgba(29, 44, 72, 0.03)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            {renderDoctorAvatar(doc)}
                            <div style={{ flex: 1, textAlign: 'left' }}>
                              <strong style={{ display: 'block', fontSize: '13.5px', color: 'var(--text)', fontWeight: isSelected ? 'bold' : 'normal' }}>
                                {doc.title || (doc.user ? `${doc.user.first_name || ''} ${doc.user.last_name || ''}` : 'Doctor')}
                              </strong>
                              <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
                                {doc.specialty || 'General Practitioner'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Custom Availability Calendar */}
                {bookingForm.doctor_id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                      Choose Date from Available Days
                    </label>
                    
                    <div style={{ 
                      border: '1px solid var(--border)', 
                      borderRadius: '12px', 
                      padding: '16px',
                      background: '#f8fafc'
                    }}>
                      {/* Month Navigation */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                        <button 
                          type="button" 
                          onClick={handlePrevMonth}
                          style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          &lsaquo;
                        </button>
                        <strong style={{ fontSize: '14.5px', color: 'var(--text)' }}>
                          {monthNames[month]} {year}
                        </strong>
                        <button 
                          type="button" 
                          onClick={handleNextMonth}
                          style={{ background: 'white', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          &rsaquo;
                        </button>
                      </div>

                      {/* Weekday headers */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', textAlign: 'center', gap: '4px', marginBottom: '8px' }}>
                        {weekdaysHeader.map(w => (
                          <span key={w} style={{ fontSize: '11px', fontWeight: 'bold', color: 'var(--muted)' }}>{w}</span>
                        ))}
                      </div>

                      {/* Days grid */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                        {calendarDays.map((dayNum, idx) => {
                          if (dayNum === null) {
                            return <div key={`empty-${idx}`} />;
                          }
                          
                          const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                          const isAvailable = isDoctorAvailableOnDay(dateString, selectedDocObj);
                          const isSelected = bookingForm.date === dateString;

                          return (
                            <button
                              key={dateString}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => handleDateChange(dateString)}
                              style={{
                                padding: '8px 0',
                                borderRadius: '6px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: isAvailable ? 'pointer' : 'not-allowed',
                                background: isSelected ? 'var(--primary)' : isAvailable ? 'white' : 'transparent',
                                color: isSelected ? 'white' : isAvailable ? 'var(--text)' : 'var(--muted)',
                                border: isAvailable ? '1px solid rgba(26,128,199,0.1)' : '1px dashed transparent',
                                ...(isAvailable ? {} : {
                                  opacity: 0.25,
                                  filter: 'blur(0.5px)',
                                  textDecoration: 'line-through'
                                })
                              }}
                            >
                              {dayNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Custom Time Slot Selector */}
                {bookingForm.date && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                      Select Time Slot
                    </label>
                    
                    {selectedDoctorSlots.length === 0 ? (
                      <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>
                        No time slots available for this day.
                      </p>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                        {selectedDoctorSlots.map(slotObj => {
                          const isSelected = bookingForm.time_label === slotObj.time;
                          const isAvailable = slotObj.available;
                          
                          return (
                            <button
                              key={slotObj.time}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => setBookingForm({ ...bookingForm, time_label: slotObj.time })}
                              style={{
                                padding: '10px 8px',
                                borderRadius: '8px',
                                fontSize: '13px',
                                fontWeight: '600',
                                cursor: isAvailable ? 'pointer' : 'not-allowed',
                                border: '1px solid var(--border)',
                                background: isSelected ? 'var(--accent)' : isAvailable ? 'white' : 'transparent',
                                color: isSelected ? '#12213d' : isAvailable ? 'var(--text)' : 'var(--muted)',
                                textAlign: 'center',
                                ...(isAvailable ? {} : {
                                  opacity: 0.3,
                                  filter: 'blur(0.5px)',
                                  background: '#f1f5f9',
                                  textDecoration: 'line-through'
                                })
                              }}
                            >
                              {slotObj.time} {!isAvailable && '(Booked)'}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Reason for visit */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                    Reason for Visit
                  </label>
                  <input
                    value={bookingForm.reason}
                    onChange={(e) => setBookingForm({ ...bookingForm, reason: e.target.value })}
                    placeholder="e.g. Skin rash, BP review"
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'white', fontSize: '14.5px', color: 'var(--text)' }}
                  />
                </div>

                {/* Time Zone selection */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                    Your Time Zone
                  </label>
                  <select
                    required
                    value={bookingForm.timezone}
                    onChange={(e) => setBookingForm({ ...bookingForm, timezone: e.target.value })}
                    style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'white', fontSize: '14.5px', color: 'var(--text)', cursor: 'pointer' }}
                  >
                    {Intl.DateTimeFormat().resolvedOptions().timeZone && !TIMEZONES.includes(Intl.DateTimeFormat().resolvedOptions().timeZone) && (
                      <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>
                        {Intl.DateTimeFormat().resolvedOptions().timeZone} (Auto-detected)
                      </option>
                    )}
                    {TIMEZONES.map(tz => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                </div>

                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                  <button type="submit" className="hero-btn-primary" style={{ flex: 1, border: 'none', background: '#ffbf47', color: '#12213d', padding: '12px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', height: '44px' }}>Confirm Booking</button>
                  <button type="button" className="hero-btn-secondary" style={{ flex: 1, border: '1.5px solid var(--border)', background: 'white', color: 'var(--text)', padding: '12px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer', height: '44px' }} onClick={() => setShowBookModal(false)}>Cancel</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Reschedule Appointment Modal */}
      {showRescheduleModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(18, 33, 61, 0.5)', backdropFilter: 'blur(6px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', overflowY: 'auto', zIndex: 10000
        }}>
          <div className="panel" style={{ width: '400px', padding: '32px', borderRadius: '24px', boxShadow: '0 24px 48px rgba(18, 33, 61, 0.16)', background: 'white', border: '1px solid var(--border)', backdropFilter: 'none' }}>
            <h3 style={{ margin: '0 0 20px 0', fontFamily: 'Montserrat, sans-serif', fontWeight: 800, color: '#263682', fontSize: '1.5rem' }}>Reschedule Consultation</h3>
            <form onSubmit={handleRescheduleSubmit} className="auth-form" style={{ gap: '14px' }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                New Date
                <input
                  required
                  type="date"
                  value={rescheduleForm.date}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, date: e.target.value })}
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'white', fontSize: '14.5px', color: 'var(--text)' }}
                />
              </label>

              <label style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontWeight: 600, fontSize: '13.5px', color: 'var(--text)' }}>
                New Time Slot
                <input
                  required
                  value={rescheduleForm.time_label}
                  onChange={(e) => setRescheduleForm({ ...rescheduleForm, time_label: e.target.value })}
                  placeholder="e.g. 14:30"
                  style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1.5px solid var(--border)', background: 'white', fontSize: '14.5px', color: 'var(--text)' }}
                />
              </label>

              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button type="submit" className="hero-btn-primary" style={{ flex: 1, border: 'none', background: '#ffbf47', color: '#12213d', padding: '12px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
                <button type="button" className="hero-btn-secondary" style={{ flex: 1, border: '1.5px solid var(--border)', background: 'white', color: 'var(--text)', padding: '12px', borderRadius: '12px', fontWeight: 700, cursor: 'pointer' }} onClick={() => setShowRescheduleModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
