const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '') || '/api/v1';


async function request(path, { method = 'GET', token = '', body } = {}) {
  const isFormData = body instanceof FormData;
  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers: {
      ...(body && !isFormData ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Token ${token}` } : {}),
    },
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  if (response.status === 204) {
    return null;
  }

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.detail || 'Request failed.');
  }

  return payload;
}

export const api = {
  login: (username, password) => request('/auth/login/', { method: 'POST', body: { username, password } }),
  verifyOtp: (username, otpCode) => request('/auth/verify-otp/', { method: 'POST', body: { username, otp_code: otpCode } }),
  resendOtp: (username) => request('/auth/resend-otp/', { method: 'POST', body: { username } }),

  logout: (token) => request('/auth/logout/', { method: 'POST', token }),
  me: (token) => request('/auth/me/', { token }),
  getMe: (token) => request('/auth/me/', { token }),

  updateMe: (token, formData) => request('/auth/me/', { method: 'PUT', token, body: formData }),
  dashboard: (token) => request('/dashboard/', { token }),
  thread: (token, doctorId) => request(`/chat/thread/${doctorId ? `?doctor_id=${doctorId}` : ''}`, { token }),
  getPatientThread: (token, patientId) => request(`/chat/thread/?patient_id=${patientId}`, { token }),
  sendMessage: (token, threadId, body) => request('/chat/thread/', { method: 'POST', token, body: { thread_id: threadId, body } }),
  updateTypingStatus: (token, threadId, isTyping) => request('/chat/thread/typing/', { method: 'POST', token, body: { thread_id: threadId, is_typing: isTyping } }),
  saveNote: (token, text) => request('/doctor/note/', { method: 'POST', token, body: { text } }),
  saveAvailability: (token, slots) => request('/doctor/availability/', { method: 'POST', token, body: { slots } }),

  // New API mappings
  register: (data) => request('/auth/register/', { method: 'POST', body: data }),
  lookupMember: (membershipNumber) => request(`/auth/lookup-member/?membership_number=${encodeURIComponent(membershipNumber)}`),
  getDoctors: (token) => request('/doctors/', { token }),
  getDoctorAvailability: (token, doctorId, date) => request(`/doctors/${doctorId}/availability/?date=${encodeURIComponent(date)}`, { token }),
  getPatients: (token) => request('/patients/', { token }),
  updatePatient: (token, patientId, data) => request('/patients/', { method: 'PUT', token, body: { patient_id: patientId, ...data } }),
  deletePatient: (token, patientId) => request('/patients/', { method: 'DELETE', token, body: { patient_id: patientId } }),

  getAppointments: (token, patientId) => request(`/appointments/${patientId ? `?patient_id=${patientId}` : ''}`, { token }),
  bookAppointment: (token, data) => request('/appointments/', { method: 'POST', token, body: data }),
  cancelAppointment: (token, appointmentId) => request('/appointments/', { method: 'PUT', token, body: { appointment_id: appointmentId, action: 'cancel' } }),
  rescheduleAppointment: (token, appointmentId, date, timeLabel) => request('/appointments/', { method: 'PUT', token, body: { appointment_id: appointmentId, action: 'reschedule', date, time_label: timeLabel } }),
  doctorApproveAppointment: (token, appointmentId) => request('/appointments/', { method: 'PUT', token, body: { appointment_id: appointmentId, action: 'doctor_approve' } }),
  updateAppointmentStatus: (token, appointmentId, status) => request('/appointments/', { method: 'PUT', token, body: { appointment_id: appointmentId, action: 'status_change', status } }),
  getPrescriptions: (token, patientId) => request(`/prescriptions/${patientId ? `?patient_id=${patientId}` : ''}`, { token }),
  createPrescription: (token, data) => request('/prescriptions/', { method: 'POST', token, body: data }),
  getRecords: (token, patientId) => request(`/records/${patientId ? `?patient_id=${patientId}` : ''}`, { token }),
  uploadRecord: (token, data) => request('/records/', { method: 'POST', token, body: data }),
  getNotifications: (token) => request('/notifications/', { token }),
  markNotificationsRead: (token, notificationId) => request('/notifications/', { method: 'POST', token, body: { notification_id: notificationId } }),
  adminVerifyPatient: (token, patientId, isApproved, rejectionReason) => request('/admin/action/', { method: 'POST', token, body: { action: 'verify_patient', patient_id: patientId, is_approved: isApproved, rejection_reason: rejectionReason } }),
  adminCreateDoctor: (token, data) => request('/admin/action/', { method: 'POST', token, body: { action: 'create_doctor', ...data } }),
  adminGetReports: (token, filters = {}) => request(`/admin/reports/?${new URLSearchParams(filters).toString()}`, { token }),
  sysadminGetUsers: (token) => request('/admin/sysadmin/users/', { token }),
  sysadminCreateUser: (token, data) => request('/admin/sysadmin/create-user/', { method: 'POST', token, body: data }),
  sysadminResetPassword: (token, userId, newPassword, forceChange) => request('/admin/sysadmin/reset-password/', { method: 'POST', token, body: { user_id: userId, new_password: newPassword, change_password_on_next_login: forceChange } }),
  sysadminUpdateUser: (token, data) => request('/admin/sysadmin/update-user/', { method: 'PUT', token, body: data }),
  sysadminDeleteUser: (token, userId) => request('/admin/sysadmin/delete-user/', { method: 'DELETE', token, body: { user_id: userId } }),
  sysadminGetAuditTrails: (token) => request('/admin/sysadmin/audit-trails/', { token }),
  sysadminGetMembers: (token, search = '') => request(`/admin/sysadmin/members/${search ? `?search=${encodeURIComponent(search)}` : ''}`, { token }),
  sysadminAddMember: (token, data) => request('/admin/sysadmin/add-member/', { method: 'POST', token, body: data }),
  sysadminUpdateMember: (token, data) => request('/admin/sysadmin/update-member/', { method: 'PUT', token, body: data }),
  sysadminDeleteMember: (token, id) => request('/admin/sysadmin/delete-member/', { method: 'DELETE', token, body: { id } }),
  sysadminUploadMembers: (token, file) => {
    const fd = new FormData();
    fd.append('file', file);
    return request('/admin/sysadmin/upload-members/', { method: 'POST', token, body: fd });
  },
  forceChangePassword: (username, oldPassword, newPassword) => request('/auth/force-change-password/', { method: 'POST', body: { username, old_password: oldPassword, new_password: newPassword } }),
  requestPasswordReset: (emailOrUsername) => request('/auth/password-reset-request/', { method: 'POST', body: { email_or_username: emailOrUsername } }),
  confirmPasswordReset: (token, newPassword) => request('/auth/password-reset-confirm/', { method: 'POST', body: { token, new_password: newPassword } }),
  adminApproveAppointment: (token, appointmentId) => request('/appointments/', { method: 'PUT', token, body: { appointment_id: appointmentId, action: 'approve' } }),
  adminRejectAppointment: (token, appointmentId, rejectionReason) => request('/appointments/', { method: 'PUT', token, body: { appointment_id: appointmentId, action: 'reject', rejection_reason: rejectionReason } }),
};


export function displayName(profile) {
  return profile?.user?.full_name || profile?.user?.username || 'User';
}

export function firstInitials(profile) {
  const name = displayName(profile);
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
