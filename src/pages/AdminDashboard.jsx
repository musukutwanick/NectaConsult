import { useState, useEffect } from 'react';
import { api, displayName, firstInitials } from '../api';

export default function AdminDashboard({ token, onLogout, DashboardHeader, showToast }) {
  const [adminData, setAdminData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentTab, setCurrentTab] = useState('Home');
  const [verifySubTab, setVerifySubTab] = useState('appointments');

  // Navigation menu
  const adminNavigation = [
    { label: 'Home', icon: 'fa-solid fa-house' },
    { label: 'Verify Consultations', icon: 'fa-solid fa-user-shield' },
    { label: 'Consultation Reports', icon: 'fa-solid fa-chart-line' },
  ];

  // Patients list and verification state
  const [patients, setPatients] = useState([]);
  const [loadingPatients, setLoadingPatients] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [patientStatusFilter, setPatientStatusFilter] = useState('all');
  const [actionType, setActionType] = useState('approve');
  const [rejectionDropdown, setRejectionDropdown] = useState('Account inactive/Terminated');
  const [customReason, setCustomReason] = useState('');

  // Reports state
  const [reportsData, setReportsData] = useState(null);
  const [loadingReports, setLoadingReports] = useState(false);
  const [doctorsList, setDoctorsList] = useState([]);
  const [reportFilters, setReportFilters] = useState({
    start_date: '',
    end_date: '',
    doctor_id: '',
    status: '',
  });

  // Reports Pagination
  const [reportsPage, setReportsPage] = useState(1);
  const [reportsLimit, setReportsLimit] = useState(10);

  // Create Doctor Form States
  const [showDoctorModal, setShowDoctorModal] = useState(false);
  const [doctorForm, setDoctorForm] = useState({
    username: '',
    password: '',
    email: '',
    first_name: '',
    last_name: '',
    specialty: 'General Practitioner',
    phone: '',
  });

  useEffect(() => {
    loadAdminDashboard();
    loadDoctors();
    loadPatientsList();
  }, []);

  useEffect(() => {
    if (currentTab === 'Verify Consultations') {
      loadPatientsList();
    } else if (currentTab === 'Consultation Reports') {
      loadReports();
    }
  }, [currentTab]);

  async function loadAdminDashboard() {
    setLoading(true);
    setError('');
    try {
      const data = await api.dashboard(token);
      setAdminData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDoctors() {
    try {
      const docs = await api.getDoctors(token);
      setDoctorsList(docs);
    } catch (err) {
      console.error('Failed to load doctors list', err);
    }
  }

  async function loadPatientsList() {
    setLoadingPatients(true);
    setError('');
    try {
      const list = await api.getPatients(token);
      setPatients(list);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingPatients(false);
    }
  }

  async function loadReports() {
    setLoadingReports(true);
    setError('');
    try {
      const rData = await api.adminGetReports(token, reportFilters);
      setReportsData(rData);
      setReportsPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingReports(false);
    }
  }

  function handleFilterChange(key, value) {
    setReportFilters((prev) => ({ ...prev, [key]: value }));
  }

  async function handleApplyFilters(e) {
    e.preventDefault();
    loadReports();
  }

  async function handleResetFilters() {
    const cleared = { start_date: '', end_date: '', doctor_id: '', status: '' };
    setReportFilters(cleared);
    setLoadingReports(true);
    try {
      const rData = await api.adminGetReports(token, cleared);
      setReportsData(rData);
      setReportsPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingReports(false);
    }
  }

  function selectPatientForReview(patient) {
    setSelectedPatient(patient);
    setActionType(patient.is_verified && patient.medical_aid_status !== 'Active' ? 'reject' : 'approve');
    setRejectionDropdown('Account inactive/Terminated');
    setCustomReason('');
  }

  async function handleVerifyPatientSubmit(e) {
    e.preventDefault();
    if (!selectedPatient) return;
    setError('');
    try {
      const isApproved = (actionType === 'approve');
      const rejectionReason = isApproved ? '' : (rejectionDropdown === 'Other' ? customReason : rejectionDropdown);
      await api.adminVerifyPatient(
        token,
        selectedPatient.id,
        isApproved,
        rejectionReason
      );
      setSelectedPatient(null);
      await loadPatientsList();
      await loadAdminDashboard();
      if (showToast) showToast(isApproved ? 'Registration approved' : 'Registration rejected', 'success');
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleCreateDoctorSubmit(e) {
    e.preventDefault();
    setError('');

    if (!doctorForm.username || !doctorForm.password || !doctorForm.first_name || !doctorForm.last_name) {
      setError('Please fill in username, password, first name and last name.');
      return;
    }

    try {
      await api.adminCreateDoctor(token, doctorForm);
      if (showToast) showToast('Practitioner account created successfully', 'success');
      setShowDoctorModal(false);
      setDoctorForm({
        username: '',
        password: '',
        first_name: '',
        last_name: '',
        specialty: 'General Practitioner',
        phone: '',
      });
      await loadAdminDashboard();
      await loadDoctors();
    } catch (err) {
      setError(err.message || 'Failed to create doctor account.');
      if (showToast) showToast(err.message || 'Failed to create doctor account.', 'error');
    }
  }

  async function handleExportCSV() {
    try {
      const queryParams = new URLSearchParams({ ...reportFilters, export: 'csv' }).toString();
      const response = await fetch(`/api/admin/reports/?${queryParams}`, {
        headers: {
          Authorization: `Token ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to generate CSV export.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nectaconsult_consultations_report_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    }
  }

  // Appointment Rejection Modal State
  const [rejectingAppt, setRejectingAppt] = useState(null);
  const [apptRejectionReasonOption, setApptRejectionReasonOption] = useState('No active benefits on member plan');
  const [apptCustomRejectionReason, setApptCustomRejectionReason] = useState('');

  async function handleApproveAppointment(apptId) {
    if (!window.confirm('Are you sure you want to approve this appointment?')) return;
    setError('');
    try {
      await api.adminApproveAppointment(token, apptId);
      await loadAdminDashboard();
      if (showToast) showToast('Appointment approved successfully', 'success');
    } catch (err) {
      setError(err.message);
    }
  }

  function openRejectModal(appt) {
    setRejectingAppt(appt);
    setApptRejectionReasonOption('No active benefits on member plan');
    setApptCustomRejectionReason('');
  }

  async function handleConfirmRejectAppointment() {
    if (!rejectingAppt) return;
    const finalReason = apptRejectionReasonOption === 'Other' ? apptCustomRejectionReason.trim() : apptRejectionReasonOption;
    if (!finalReason) {
      setError('Please select or provide a rejection reason.');
      return;
    }
    setError('');
    try {
      await api.adminRejectAppointment(token, rejectingAppt.id, finalReason);
      setRejectingAppt(null);
      setApptCustomRejectionReason('');
      await loadAdminDashboard();
      if (showToast) showToast('Appointment request rejected', 'success');
    } catch (err) {
      setError(err.message);
    }
  }

  const filteredPatients = patients.filter((p) => {
    const matchesSearch =
      !patientSearch ||
      p.title.toLowerCase().includes(patientSearch.toLowerCase()) ||
      p.medical_aid_number.toLowerCase().includes(patientSearch.toLowerCase());
    
    if (patientStatusFilter === 'pending') {
      return matchesSearch && !p.is_verified;
    } else if (patientStatusFilter === 'verified') {
      return matchesSearch && p.is_verified && p.medical_aid_status === 'Active';
    } else if (patientStatusFilter === 'inactive') {
      return matchesSearch && (p.medical_aid_status === 'Inactive' || p.medical_aid_status === 'Suspended');
    }
    return matchesSearch;
  });

  const reportsAppointments = reportsData?.appointments || [];
  const totalReportsItems = reportsAppointments.length;
  const totalReportsPages = Math.ceil(totalReportsItems / reportsLimit) || 1;
  const reportsStartIndex = (reportsPage - 1) * reportsLimit;
  const paginatedReports = reportsAppointments.slice(reportsStartIndex, reportsStartIndex + reportsLimit);

  if (loading && !adminData) {
    return <div style={{ padding: '80px', textAlign: 'center', fontSize: '18px', color: 'var(--muted)' }}>Loading administrator dashboard...</div>;
  }

  if (!adminData) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'red' }}>
        Failed to load administration data. Please check connection or permissions.
      </div>
    );
  }

  const { stats, pending_verifications, appointments } = adminData;
  const adminProfile = adminData.user;
  const adminName = displayName(adminProfile);
  const avatar = adminProfile.profile_pic ? (
    <img src={adminProfile.profile_pic} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
  ) : (
    firstInitials(adminProfile)
  );

  return (
    <div className="dashboard-app topnav-layout">
      {/* Premium Navigation Header Component Shared Across Views */}
      <DashboardHeader
        role="admin"
        navigation={adminNavigation}
        activeLabel={currentTab}
        onNavigate={setCurrentTab}
        name={adminName}
        avatar={avatar}
        notifications={[]}
        onLogout={onLogout}
        onBookConsultation={() => setShowDoctorModal(true)} // reuse button slot
      />

      <main className="dashboard-main admin-main" style={{
        padding: '32px 24px',
        maxWidth: '1280px',
        margin: '0 auto',
        width: '100%',
        boxSizing: 'border-box'
      }}>
        {error && (
          <div className="auth3-error-box" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <i className="fa-solid fa-circle-exclamation"></i>
            <span>{error}</span>
            <button onClick={() => setError('')} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>×</button>
          </div>
        )}

        {/* ── HOME TAB ── */}
        {currentTab === 'Home' && (
          <>
            <section className="doctor-hero-card">
              <div className="doctor-hero-left">
                <p className="hero-eyebrow">CellMed Medical Aid Administration</p>
                <h1 className="hero-title">
                  Welcome back, {adminProfile?.user?.first_name || adminName}
                </h1>
                <p className="hero-sub">
                  You have {appointments.filter(a => a.status === 'booked').length} consultation request{appointments.filter(a => a.status === 'booked').length === 1 ? '' : 's'} awaiting verification & approval.
                </p>
                <div className="hero-buttons">
                  <button
                    type="button"
                    className="hero-btn-primary"
                    onClick={() => setCurrentTab('Verify Consultations')}
                  >
                    Review consultation requests &rarr;
                  </button>
                </div>

              </div>

              <div className="doctor-hero-right">
                <div className="hero-medical-card">
                  <div className="card-detail-row">
                    <div>
                      <span className="card-sublabel">Role</span>
                      <strong className="card-value">NectaCare Admin</strong>
                    </div>
                    <div>
                      <span className="card-sublabel">Status</span>
                      <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: '0.95rem', marginTop: '4px' }}>
                        <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginRight: '6px', fontSize: '15px' }}></i>
                        <span style={{ color: '#10b981' }}>Operational</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' }}>
              {stats.map((stat) => (
                <article className="stat-card" key={stat.label} style={{ background: 'var(--panel)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}>
                  <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--muted)', fontWeight: '700', textTransform: 'uppercase' }}>{stat.label}</p>
                  <strong style={{ fontSize: '28px', color: 'var(--text)', display: 'block' }}>{stat.value}</strong>
                  <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{stat.note}</span>
                </article>
              ))}
            </section>

            <section className="content-grid" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', alignItems: 'start' }}>
              {/* Quick Pending Consultations List */}
              <article className="panel" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Pending Consultation Requests</h2>
                  <button onClick={() => {
                    setCurrentTab('Verify Consultations');
                    setVerifySubTab('appointments');
                  }} className="mini-button">View all</button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {appointments.filter(a => a.status === 'booked').length === 0 ? (
                    <p style={{ color: 'var(--muted)', padding: '20px 0', textAlign: 'center' }}>No pending consultation requests require approval.</p>
                  ) : (
                    appointments.filter(a => a.status === 'booked').slice(0, 5).map((appt) => (
                      <div key={appt.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: 'rgba(255,255,255,0.5)', border: '1px solid var(--border)', borderRadius: '12px' }}>
                        <div>
                          <strong style={{ display: 'block', color: 'var(--text)' }}>{appt.patient_name} ({appt.patient_membership || 'CM-MEMBER'})</strong>
                          <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block' }}>Doctor: {appt.doctor_name} | Reason: {appt.reason}</span>
                          <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Requested: {appt.date} @ {appt.time_label}</span>
                        </div>
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => {
                            setCurrentTab('Verify Consultations');
                            setVerifySubTab('appointments');
                          }}
                        >
                          Review Request
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>

          </>
        )}

        {/* ── VERIFY CONSULTATIONS TAB ── */}
        {currentTab === 'Verify Consultations' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h1 style={{ margin: 0, fontSize: '1.6rem', color: 'var(--text)' }}>Verify Consultations & Registrations</h1>
                <p style={{ color: 'var(--muted)', margin: '4px 0 0 0', fontSize: '14px' }}>Review and verify consultation requests and member accounts</p>
              </div>
            </div>

            {/* Sub Tabs */}
            <div style={{ display: 'flex', gap: '12px', borderBottom: '1.5px solid var(--border)', paddingBottom: '4px', marginBottom: '8px' }}>
              <button
                type="button"
                onClick={() => setVerifySubTab('appointments')}
                style={{
                  padding: '8px 18px',
                  background: verifySubTab === 'appointments' ? 'white' : 'transparent',
                  color: verifySubTab === 'appointments' ? '#12213d' : 'var(--muted)',
                  border: 'none',
                  borderBottom: verifySubTab === 'appointments' ? '3px solid #ffaa2b' : '3px solid transparent',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
              >
                Consultation Requests
              </button>
              <button
                type="button"
                onClick={() => setVerifySubTab('patients')}
                style={{
                  padding: '8px 18px',
                  background: verifySubTab === 'patients' ? 'white' : 'transparent',
                  color: verifySubTab === 'patients' ? '#12213d' : 'var(--muted)',
                  border: 'none',
                  borderBottom: verifySubTab === 'patients' ? '3px solid #ffaa2b' : '3px solid transparent',
                  fontWeight: 'bold',
                  cursor: 'pointer',
                  fontSize: '14px',
                  transition: 'all 0.2s ease'
                }}
              >
                Patient Accounts
              </button>
            </div>

            {verifySubTab === 'patients' ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px', alignItems: 'start' }}>
              <div className="panel" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                  <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                    <input
                      type="text"
                      placeholder="Search by name, membership number or ID..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', background: 'white' }}
                    />
                    <select
                      value={patientStatusFilter}
                      onChange={(e) => setPatientStatusFilter(e.target.value)}
                      style={{ width: '180px', padding: '10px 14px', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '13.5px', background: 'white', cursor: 'pointer' }}
                    >
                      <option value="all">All Status</option>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                {loadingPatients ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--muted)' }}>Loading patients directory...</div>
                ) : filteredPatients.length === 0 ? (
                  <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px' }}>No patient profiles match your filters.</p>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border)', background: 'rgba(29, 44, 72, 0.01)' }}>
                          <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Patient Name</th>
                          <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Membership Number</th>
                          {!selectedPatient && <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Plan</th>}
                          <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Status</th>
                          {!selectedPatient && <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Submitted On</th>}
                          <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)', textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredPatients.map((patient) => {
                          const isSelected = selectedPatient && selectedPatient.id === patient.id;
                          return (
                            <tr
                              key={patient.id}
                              onClick={() => selectPatientForReview(patient)}
                              style={{
                                borderBottom: '1px solid var(--border)',
                                cursor: 'pointer',
                                background: isSelected ? 'rgba(26, 128, 199, 0.04)' : 'none',
                                transition: 'background 0.2s',
                              }}
                              className="patient-row-hover"
                            >
                              <td style={{ padding: '14px 16px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(26,128,199,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold', color: 'var(--primary)' }}>
                                  {firstInitials(patient)}
                                </div>
                                <span style={{ color: 'var(--text)' }}>{patient.title}</span>
                              </td>
                              <td style={{ padding: '14px 16px' }}>{patient.medical_aid_number}</td>
                              {!selectedPatient && <td style={{ padding: '14px 16px' }}>{patient.plan || 'CellMed Gold'}</td>}
                              <td style={{ padding: '14px 16px' }}>
                                <span style={{
                                  fontSize: '12px',
                                  fontWeight: 'bold',
                                  padding: '4px 10px',
                                  borderRadius: '20px',
                                  background: patient.medical_aid_status === 'Active' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                                  color: patient.medical_aid_status === 'Active' ? '#10b981' : '#ef4444'
                                }}>
                                  ● {patient.medical_aid_status || 'Active'}
                                </span>
                              </td>
                              {!selectedPatient && (
                                <td style={{ padding: '14px 16px', color: 'var(--muted)', fontSize: '13px' }}>
                                  19 May 2025
                                </td>
                              )}
                              <td style={{ padding: '14px 16px', textAlign: 'center' }}>
                                <button
                                  type="button"
                                  className="mini-button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectPatientForReview(patient);
                                  }}
                                >
                                  View
                                </button>
                              </td>

                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {selectedPatient && (
                <aside style={{
                  position: 'fixed',
                  top: '72px',
                  right: 0,
                  bottom: 0,
                  width: '460px',
                  maxWidth: '90%',
                  height: 'calc(100vh - 72px)',
                  background: 'var(--panel)',
                  borderLeft: '1px solid var(--border)',
                  boxShadow: '-8px 0 32px rgba(29, 44, 72, 0.15)',
                  padding: '32px 24px',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '20px',
                  overflowY: 'auto'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
                    <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>Review Registration</h3>
                    <button onClick={() => setSelectedPatient(null)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(26, 128, 199, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold', color: 'var(--primary)' }}>
                      {firstInitials(selectedPatient)}
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {selectedPatient.title}
                        <span style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: selectedPatient.medical_aid_status === 'Active' ? 'var(--success)' : selectedPatient.medical_aid_status === 'Pending' ? '#e2a100' : '#ef4444'
                        }}>
                          {selectedPatient.medical_aid_status}
                        </span>
                      </h4>
                      <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '2px' }}>
                        Membership Number: <strong>{selectedPatient.medical_aid_number}</strong>
                      </span>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--primary)', fontWeight: 'bold', fontSize: '13px' }}>
                      <i className="fa-solid fa-user" style={{ fontSize: '13px' }}></i>
                      <span>Personal Information</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', fontSize: '12.5px' }}>
                      <div>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>Date of Birth</span>
                        <strong style={{ color: 'var(--text)' }}>
                          {selectedPatient.date_of_birth ? new Date(selectedPatient.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : '12 March 1994'}
                        </strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>Email Address</span>
                        <strong style={{ color: 'var(--text)', wordBreak: 'break-all' }}>{selectedPatient.user.email || `${selectedPatient.user.username}@cellmed.co.zw`}</strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>Phone Number</span>
                        <strong style={{ color: 'var(--text)' }}>{selectedPatient.phone || '+27 82 555 8885'}</strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>ID Number</span>
                        <strong style={{ color: 'var(--text)' }}>{selectedPatient.user.username.toUpperCase()}</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--primary)', fontWeight: 'bold', fontSize: '13px' }}>
                      <i className="fa-solid fa-address-card" style={{ fontSize: '13px' }}></i>
                      <span>Membership Details</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', fontSize: '12.5px' }}>
                      <div>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>Medical Aid Plan</span>
                        <strong style={{ color: 'var(--text)' }}>{selectedPatient.plan || 'CellMed Gold'}</strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>Membership Start Date</span>
                        <strong style={{ color: 'var(--text)' }}>01 Jan 2025</strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>Membership Status</span>
                        <strong style={{ color: selectedPatient.medical_aid_status === 'Active' ? 'var(--success)' : '#ef4444' }}>
                          {selectedPatient.medical_aid_status}
                        </strong>
                      </div>
                      <div>
                        <span style={{ display: 'block', color: 'var(--muted)', fontSize: '10.5px', fontWeight: 'bold', textTransform: 'uppercase' }}>Membership Expiry Date</span>
                        <strong style={{ color: 'var(--text)' }}>31 Dec 2026</strong>
                      </div>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)', fontWeight: 'bold', fontSize: '13px' }}>
                      <i className="fa-solid fa-user-gear" style={{ fontSize: '13px' }}></i>
                      <span>Account Management</span>
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '6px' }}>
                      {selectedPatient.medical_aid_status === 'Active' ? (
                        <button
                          type="button"
                          className="secondary-button"
                          style={{ flex: 1, color: '#d97706', borderColor: '#d97706', fontWeight: 'bold' }}
                          onClick={async () => {
                            setError('');
                            try {
                              await api.updatePatient(token, selectedPatient.id, { medical_aid_status: 'Inactive' });
                              setSelectedPatient(null);
                              await loadPatientsList();
                              await loadAdminDashboard();
                              if (showToast) showToast('Patient account disabled', 'success');
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Disable Account
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="cta-button"
                          style={{ flex: 1, background: '#10b981', color: 'white', fontWeight: 'bold' }}
                          onClick={async () => {
                            setError('');
                            try {
                              await api.updatePatient(token, selectedPatient.id, { medical_aid_status: 'Active' });
                              setSelectedPatient(null);
                              await loadPatientsList();
                              await loadAdminDashboard();
                              if (showToast) showToast('Patient account activated', 'success');
                            } catch (err) {
                              setError(err.message);
                            }
                          }}
                        >
                          Enable Account
                        </button>
                      )}

                      <button
                        type="button"
                        className="mini-button"
                        style={{ flex: 1, color: '#ef4444', borderColor: '#ef4444', fontWeight: 'bold' }}
                        onClick={async () => {
                          if (!window.confirm(`Are you sure you want to delete patient "${selectedPatient.title}"? This action cannot be undone.`)) return;
                          setError('');
                          try {
                            await api.deletePatient(token, selectedPatient.id);
                            setSelectedPatient(null);
                            await loadPatientsList();
                            await loadAdminDashboard();
                            if (showToast) showToast('Patient account deleted', 'success');
                          } catch (err) {
                            setError(err.message);
                          }
                        }}
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>

                </aside>
              )}
            </div>
            ) : (
              <div className="panel" style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '18px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border)', paddingBottom: '16px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--text)' }}>Pending Consultation Approvals</h2>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)', background: 'rgba(29, 44, 72, 0.01)' }}>
                        <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Member Number</th>
                        <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Patient Name</th>
                        <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Doctor Name</th>
                        <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Reason</th>
                        <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)' }}>Date & Time</th>
                        <th style={{ padding: '14px 16px', fontSize: '13px', fontWeight: 'bold', color: 'var(--muted)', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {appointments.filter(a => a.status === 'booked').length === 0 ? (
                        <tr>
                          <td colSpan="6" style={{ padding: '32px', textAlign: 'center', color: 'var(--muted)' }}>
                            No pending consultations require approval.
                          </td>
                        </tr>
                      ) : (
                        appointments.filter(a => a.status === 'booked').map((appt) => (
                          <tr key={appt.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '14px 16px', fontWeight: 'bold', color: 'var(--primary)' }}>
                              {appt.patient_membership || 'CM-MEMBER'}
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: 'bold', color: 'var(--text)' }}>
                              {appt.patient_name}
                            </td>
                            <td style={{ padding: '14px 16px' }}>{appt.doctor_name}</td>
                            <td style={{ padding: '14px 16px' }}>{appt.reason}</td>
                            <td style={{ padding: '14px 16px' }}>
                              {appt.date} @ {appt.time_label} {appt.timezone && <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block' }}>({appt.timezone})</span>}
                            </td>
                            <td style={{ padding: '14px 16px', textAlign: 'center', display: 'flex', gap: '8px', justifyContent: 'center' }}>
                              <button
                                type="button"
                                className="mini-button"
                                onClick={() => handleApproveAppointment(appt.id)}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                className="mini-button"
                                style={{ color: '#ef4444', borderColor: '#ef4444' }}
                                onClick={() => openRejectModal(appt)}
                              >
                                Reject
                              </button>
                            </td>
                          </tr>
                        ))
                      )}

                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── APPOINTMENT REJECTION REASON MODAL ── */}
        {rejectingAppt && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '480px',
              width: '100%',
              padding: '28px',
              boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              gap: '18px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#12213d', fontWeight: 'bold' }}>Reject Consultation Request</h3>
                <button onClick={() => setRejectingAppt(null)} style={{ background: 'none', border: 'none', fontSize: '22px', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
              </div>

              <p style={{ margin: 0, fontSize: '13.5px', color: 'var(--muted)' }}>
                Please select or enter the reason for declining <strong>{rejectingAppt.patient_name}</strong>'s appointment request for {rejectingAppt.date} @ {rejectingAppt.time_label}.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text)' }}>Rejection Reason</label>
                <select
                  value={apptRejectionReasonOption}
                  onChange={(e) => setApptRejectionReasonOption(e.target.value)}
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13.5px', background: 'white' }}
                >
                  <option value="No active benefits on member plan">No active benefits on member plan</option>
                  <option value="Doctor unavailable at requested time">Doctor unavailable at requested time</option>
                  <option value="Member account inactive or suspended">Member account inactive or suspended</option>
                  <option value="Duplicate consultation request">Duplicate consultation request</option>
                  <option value="Incomplete patient documentation">Incomplete patient documentation</option>
                  <option value="Other">Other (Specify below)</option>
                </select>
              </div>

              {apptRejectionReasonOption === 'Other' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text)' }}>Custom Reason Details</label>
                  <textarea
                    rows="3"
                    value={apptCustomRejectionReason}
                    onChange={(e) => setApptCustomRejectionReason(e.target.value)}
                    placeholder="Provide specific details for rejection..."
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '13.5px', resize: 'vertical' }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => setRejectingAppt(null)}
                  style={{ padding: '8px 18px' }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={handleConfirmRejectAppointment}
                  style={{ padding: '8px 18px', background: '#ef4444', color: 'white', border: '1px solid #ef4444', fontWeight: 'bold' }}
                >
                  Confirm Rejection
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── CONSULTATION REPORTS TAB ── */}
        {currentTab === 'Consultation Reports' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Filter & Export Panel */}
            <form className="panel" onSubmit={(e) => e.preventDefault()} style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '24px', borderRadius: '18px' }}>
              <h3 style={{ margin: '0 0 16px 0', fontSize: '1.2rem' }}>Generate Consultation Reports</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--muted)' }}>Start Date</label>
                  <input
                    type="date"
                    value={reportFilters.start_date}
                    onChange={(e) => handleFilterChange('start_date', e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--muted)' }}>End Date</label>
                  <input
                    type="date"
                    value={reportFilters.end_date}
                    onChange={(e) => handleFilterChange('end_date', e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--muted)' }}>Doctor</label>
                  <select
                    value={reportFilters.doctor_id}
                    onChange={(e) => handleFilterChange('doctor_id', e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white', cursor: 'pointer' }}
                  >
                    <option value="">All Doctors</option>
                    {doctorsList.map((doc) => (
                      <option key={doc.id} value={doc.id}>{doc.title}</option>
                    ))}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--muted)' }}>Status</label>
                  <select
                    value={reportFilters.status}
                    onChange={(e) => handleFilterChange('status', e.target.value)}
                    style={{ padding: '8px 12px', border: '1px solid var(--border)', borderRadius: '8px', background: 'white', cursor: 'pointer' }}
                  >
                    <option value="">All Statuses</option>
                    <option value="done">Completed</option>
                    <option value="booked">Booked</option>
                    <option value="start">In Progress</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '12px' }}>
                  <button
                    type="button"
                    onClick={handleExportCSV}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '140px',
                      height: '32px',
                      background: 'transparent',
                      border: '1px solid var(--accent)',
                      color: 'var(--accent)',
                      borderRadius: '6px',
                      fontWeight: '600',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 191, 71, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    <i className="fa-solid fa-file-csv"></i> Export CSV
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '6px',
                      width: '140px',
                      height: '32px',
                      background: 'transparent',
                      border: '1px solid var(--accent)',
                      color: 'var(--accent)',
                      borderRadius: '6px',
                      fontWeight: '600',
                      fontSize: '12px',
                      cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 191, 71, 0.08)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    Reset Filters
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}
      </main>

      {/* Register Doctor Modal */}
      {showDoctorModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
        }}>
          <div className="panel" style={{ width: '450px', padding: '24px', background: 'white', borderRadius: '16px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <h3 style={{ marginTop: 0, margin: 0 }}>Register New Doctor Profile</h3>
              <button onClick={() => setShowDoctorModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>×</button>
            </div>
            <form onSubmit={handleCreateDoctorSubmit} className="auth-form" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>First Name</label>
                  <input
                    required
                    value={doctorForm.first_name}
                    onChange={(e) => setFormVal('first_name', e.target.value)}
                    placeholder="Daniel"
                    style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Last Name</label>
                  <input
                    required
                    value={doctorForm.last_name}
                    onChange={(e) => setFormVal('last_name', e.target.value)}
                    placeholder="Moyo"
                    style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Username</label>
                  <input
                    required
                    value={doctorForm.username}
                    onChange={(e) => setFormVal('username', e.target.value)}
                    placeholder="dr.moyo"
                    style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Password</label>
                  <input
                    required
                    type="password"
                    value={doctorForm.password}
                    onChange={(e) => setFormVal('password', e.target.value)}
                    placeholder="Set password"
                    style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Email Address (Used for OTP Login Verification) <span style={{ color: '#ef4444' }}>*</span></label>
                <input
                  required
                  type="email"
                  value={doctorForm.email}
                  onChange={(e) => setFormVal('email', e.target.value)}
                  placeholder="e.g. dr.moyo@nectacare.co.zw"
                  style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Specialty Area</label>
                <input
                  required
                  value={doctorForm.specialty}
                  onChange={(e) => setFormVal('specialty', e.target.value)}
                  placeholder="e.g. Cardiologist, General Practitioner"
                  style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Phone Number</label>
                <input
                  value={doctorForm.phone}
                  onChange={(e) => setFormVal('phone', e.target.value)}
                  placeholder="+27 82 555 1100"
                  style={{ padding: '8px', border: '1px solid var(--border)', borderRadius: '6px' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="cta-button" style={{ flex: 1 }}>Register Doctor</button>
                <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setShowDoctorModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );

  function setFormVal(key, val) {
    setDoctorForm({ ...doctorForm, [key]: val });
  }
}
