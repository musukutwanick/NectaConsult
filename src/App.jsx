import { useEffect, useRef, useState, Component } from 'react';
import { api, displayName, firstInitials } from './api';
import Register from './pages/Register';
import Appointments from './pages/Appointments';
import Prescriptions from './pages/Prescriptions';
import MedicalRecords from './pages/MedicalRecords';
import AdminDashboard from './pages/AdminDashboard';
import ConsultationCall from './pages/ConsultationCall';
import LandingPage from './pages/LandingPage';
import SysAdminDashboard from './pages/SysAdminDashboard';
import CameraModal from './components/CameraModal';
import SignaturePad from './components/SignaturePad';

class ConsultationCallBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ConsultationCall Boundary caught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 20000, background: 'rgba(5, 7, 12, 0.85)',
          color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', padding: '24px', textAlign: 'center', backdropFilter: 'blur(6px)'
        }}>
          <div style={{ background: '#1e293b', padding: '32px', borderRadius: '16px', maxWidth: '480px', width: '100%', border: '1px solid #334155', boxShadow: '0 20px 50px rgba(0,0,0,0.5)' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '44px', color: '#f27224', marginBottom: '16px' }}></i>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 'bold' }}>Consultation Room Error</h3>
            <p style={{ color: '#cbd5e1', fontSize: '13px', marginBottom: '20px', lineHeight: '1.4' }}>
              {this.state.error?.message || 'An issue occurred loading the room data.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, error: null })}
                style={{ background: '#1a80c7', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Retry
              </button>
              <button
                type="button"
                onClick={this.props.onClose}
                style={{ background: '#475569', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                Close Room
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}



function getGreeting() {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good morning';
  return 'Good afternoon';
}


const doctorNavigation = [
  { label: 'Home', icon: 'fa-solid fa-house' },
  { label: 'Appointments', icon: 'fa-solid fa-calendar-check' },
  { label: 'Availability', icon: 'fa-solid fa-clock' },
  { label: 'Patient Records', icon: 'fa-solid fa-hospital-user' },
];

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const patientNavigation = [
  { label: 'Home', icon: 'fa-solid fa-house' },
  { label: 'Appointments', icon: 'fa-solid fa-calendar-check' },
  { label: 'Consultation Records', icon: 'fa-solid fa-file-medical' },
  { label: 'Prescriptions', icon: 'fa-solid fa-prescription-bottle-medical' },
  { label: 'Profile', icon: 'fa-solid fa-user-gear' },
];

const demoAccounts = [
  { label: 'Doctor demo', username: 'Patience', password: 'password123' },
  { label: 'Patient demo', username: 'lebo.mokoena', password: 'password123' },
  { label: 'Admin demo', username: 'admin', password: 'password123' },
  { label: 'Sysadmin demo', username: 'sysadmin', password: 'password123' },
];

function App() {
  const TEN_MINUTES_MS = 10 * 60 * 1000;

  const [token, setToken] = useState(() => {
    const savedToken = window.localStorage.getItem('nectaconsult-token') || window.sessionStorage.getItem('nectaconsult-token') || '';
    const lastActiveStr = window.localStorage.getItem('nectaconsult-last-activity');
    if (savedToken && lastActiveStr) {
      const lastActive = parseInt(lastActiveStr, 10);
      if (Date.now() - lastActive > TEN_MINUTES_MS) {
        window.localStorage.removeItem('nectaconsult-token');
        window.sessionStorage.removeItem('nectaconsult-token');
        window.localStorage.removeItem('nectaconsult-last-activity');
        return '';
      }
    }
    return savedToken;
  });

  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(Boolean(token));
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((curr) => {
        if (curr && curr.message === message && curr.type === type) {
          return null;
        }
        return curr;
      });
    }, 4000);
  };

  // 10-Minute Inactivity Auto-Logout Manager
  useEffect(() => {
    if (!token) return;

    let inactivityTimer = null;
    let throttleTimer = null;

    const resetInactivityTimer = () => {
      window.localStorage.setItem('nectaconsult-last-activity', Date.now().toString());
      if (inactivityTimer) clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        handleLogout();
        showToast('You have been logged out due to 10 minutes of inactivity.', 'error');
      }, TEN_MINUTES_MS);
    };

    resetInactivityTimer();

    const onUserActivity = () => {
      if (!throttleTimer) {
        throttleTimer = setTimeout(() => {
          throttleTimer = null;
          resetInactivityTimer();
        }, 1000);
      }
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    events.forEach((evt) => window.addEventListener(evt, onUserActivity, { passive: true }));

    return () => {
      if (inactivityTimer) clearTimeout(inactivityTimer);
      if (throttleTimer) clearTimeout(throttleTimer);
      events.forEach((evt) => window.removeEventListener(evt, onUserActivity));
    };
  }, [token]);
  const [loginForm, setLoginForm] = useState(() => {
    try {
      const pending = window.localStorage.getItem('nectaconsult-pending-otp');
      if (pending) {
        const parsed = JSON.parse(pending);
        if (parsed && parsed.username) return { username: parsed.username, password: '' };
      }
    } catch {}
    return { username: '', password: '' };
  });

  const [isRegistering, setIsRegistering] = useState(() => {
    return window.localStorage.getItem('nectaconsult-is-registering') === 'true';
  });

  const updateIsRegistering = (val) => {
    setIsRegistering(val);
    if (val) {
      window.localStorage.setItem('nectaconsult-is-registering', 'true');
    } else {
      window.localStorage.removeItem('nectaconsult-is-registering');
    }
  };

  const [currentTab, setCurrentTab] = useState('');
  const [isCalling, setIsCalling] = useState(false);
  const [callInfo, setCallInfo] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const [otpRequired, setOtpRequired] = useState(() => {
    try {
      const pending = window.localStorage.getItem('nectaconsult-pending-otp');
      if (pending) {
        const parsed = JSON.parse(pending);
        return Boolean(parsed && parsed.otpRequired);
      }
    } catch {}
    return false;
  });

  const [otpEmail, setOtpEmail] = useState(() => {
    try {
      const pending = window.localStorage.getItem('nectaconsult-pending-otp');
      if (pending) {
        const parsed = JSON.parse(pending);
        return (parsed && parsed.otpEmail) || '';
      }
    } catch {}
    return '';
  });

  const [otpCode, setOtpCode] = useState('');
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const [showLanding, setShowLanding] = useState(false);
  const [autoOpenBookModal, setAutoOpenBookModal] = useState(false);
  const [isDoctorLogin, setIsDoctorLogin] = useState(false);
  const [forcePasswordChangeUsername, setForcePasswordChangeUsername] = useState('');


  // Password Reset Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMode, setResetMode] = useState('request'); // 'request' or 'confirm'
  const [resetIdentifier, setResetIdentifier] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [resetNewPasswordInput, setResetNewPasswordInput] = useState('');
  const [resetStatus, setResetStatus] = useState({ loading: false, error: '', success: '' });

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('reset_token');
    const userParam = urlParams.get('username');
    if (tokenParam) {
      setResetTokenInput(tokenParam);
      setResetMode('confirm');
      setShowResetModal(true);
      if (userParam) setResetIdentifier(userParam);
    }
  }, []);

  async function handleRequestResetSubmit(e) {
    e.preventDefault();
    setResetStatus({ loading: true, error: '', success: '' });
    try {
      const res = await api.requestPasswordReset(resetIdentifier);
      setResetStatus({ loading: false, error: '', success: res.detail || 'Password reset instructions have been sent to your email.' });
    } catch (err) {
      setResetStatus({ loading: false, error: err.message, success: '' });
    }
  }

  async function handleConfirmResetSubmit(e) {
    e.preventDefault();
    setResetStatus({ loading: true, error: '', success: '' });
    try {
      const res = await api.confirmPasswordReset(resetTokenInput, resetNewPasswordInput);
      setResetStatus({ loading: false, error: '', success: res.detail || 'Password updated successfully! You may now sign in.' });
      setTimeout(() => {
        setShowResetModal(false);
        setSuccessMsg('Password updated successfully. Please sign in with your new credentials.');
      }, 2000);
    } catch (err) {
      setResetStatus({ loading: false, error: err.message, success: '' });
    }
  }

  useEffect(() => {
    if (!token) {
      return;
    }
    loadDashboard(token);
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [token]);


  async function loadDashboard(currentToken) {
    setLoading(true);
    setError('');
    try {
      const data = await api.dashboard(currentToken);

      // Intercept forced password change on next login
      if (data.user && data.user.change_password_on_next_login) {
        setForcePasswordChangeUsername(data.user.user.username);
        setToken('');
        window.localStorage.removeItem('nectaconsult-token');
        window.sessionStorage.removeItem('nectaconsult-token');
        window.localStorage.removeItem('nectaconsult-last-activity');
        setDashboard(null);
        setLoading(false);
        return;
      }

      setDashboard(data);
      // Set default tab based on role
      if (data.role === 'doctor') {
        setCurrentTab('Home');
      } else if (data.role === 'patient') {
        setCurrentTab('Home');
      } else if (data.role === 'sysadmin') {
        setCurrentTab('Home');
      } else {
        setCurrentTab('Admin');
      }
    } catch (requestError) {
      setDashboard(null);
      setToken('');
      window.localStorage.removeItem('nectaconsult-token');
      window.sessionStorage.removeItem('nectaconsult-token');
      window.localStorage.removeItem('nectaconsult-last-activity');
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadNotifications() {
    if (!token) return;
    try {
      const data = await api.getNotifications(token);
      setNotifications(data);
    } catch (err) {
      console.error('Failed to load notifications', err);
    }
  }

  async function handleMarkNotificationsRead() {
    if (!token) return;
    try {
      await api.markNotificationsRead(token);
      loadNotifications();
      setShowNotifications(false);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      const response = await api.login(loginForm.username, loginForm.password);
      if (response.otp_required) {
        setOtpRequired(true);
        setOtpEmail(response.email);
        setOtpCode('');
        try {
          window.localStorage.setItem('nectaconsult-pending-otp', JSON.stringify({
            otpRequired: true,
            otpEmail: response.email,
            username: loginForm.username
          }));
        } catch {}
      } else if (response.change_password_required) {
        setForcePasswordChangeUsername(loginForm.username);
      } else {
        setToken(response.token);
        window.localStorage.setItem('nectaconsult-token', response.token);
        window.sessionStorage.setItem('nectaconsult-token', response.token);
        window.localStorage.setItem('nectaconsult-last-activity', Date.now().toString());
        window.localStorage.removeItem('nectaconsult-pending-otp');
        setDashboard(null);
        await loadDashboard(response.token);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleForceChangePasswordSubmit(oldPassword, newPassword) {
    setError('');
    setLoading(true);
    try {
      await api.forceChangePassword(forcePasswordChangeUsername, oldPassword, newPassword);
      setForcePasswordChangeUsername('');
      setLoginForm((prev) => ({ ...prev, password: '' }));
      setSuccessMsg('Password changed successfully. Please sign in with your new credentials.');
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleOtpVerifySubmit(event) {
    event.preventDefault();
    setError('');
    setResendMsg('');
    setLoading(true);
    try {
      const response = await api.verifyOtp(loginForm.username, otpCode);
      setToken(response.token);
      window.localStorage.setItem('nectaconsult-token', response.token);
      window.sessionStorage.setItem('nectaconsult-token', response.token);
      window.localStorage.setItem('nectaconsult-last-activity', Date.now().toString());
      window.localStorage.removeItem('nectaconsult-pending-otp');
      window.localStorage.removeItem('nectaconsult-is-registering');
      setOtpRequired(false);
      setOtpCode('');
      setDashboard(null);
      await loadDashboard(response.token);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleResendOtp() {
    setError('');
    setResendMsg('');
    setResendLoading(true);
    try {
      const res = await api.resendOtp(loginForm.username);
      setResendMsg(res.detail || 'A new verification code has been sent to your email.');
    } catch (err) {
      setError(err.message);
    } finally {
      setResendLoading(false);
    }
  }


  async function handleLogout() {
    if (token) {
      try {
        await api.logout(token);
      } catch {
        // Ignore logout issues and clear session
      }
    }
    setToken('');
    setDashboard(null);
    setLoginForm({ username: '', password: '' });
    setOtpRequired(false);
    setOtpCode('');
    updateIsRegistering(false);
    window.sessionStorage.removeItem('nectaconsult-token');
    window.localStorage.removeItem('nectaconsult-token');
    window.localStorage.removeItem('nectaconsult-last-activity');
    window.localStorage.removeItem('nectaconsult-pending-otp');
    window.localStorage.removeItem('nectaconsult-is-registering');
  }


  function handleRegisterSuccess() {
    updateIsRegistering(false);
    setShowLanding(false);
  }

  if (loading && !dashboard) {
    return <LoadingScreen />;
  }

  let innerScreen = null;

  if (isRegistering) {
    innerScreen = (
      <Register
        onBackToLogin={() => { updateIsRegistering(false); setShowLanding(false); }}
        onRegisterSuccess={handleRegisterSuccess}
      />
    );
  } else if (!dashboard && showLanding) {
    innerScreen = (
      <LandingPage
        onGetStarted={() => { setShowLanding(false); updateIsRegistering(true); }}
        onLogin={() => { setShowLanding(false); }}
      />
    );
  } else if (forcePasswordChangeUsername) {
    innerScreen = (
      <ForcePasswordChangeScreen
        username={forcePasswordChangeUsername}
        error={error}
        onSubmit={handleForceChangePasswordSubmit}
        onCancel={() => { setForcePasswordChangeUsername(''); setError(''); }}
        loading={loading}
      />
    );
  } else if (!dashboard) {
    if (otpRequired) {
      innerScreen = (
        <OtpScreen
          email={otpEmail}
          otpCode={otpCode}
          onChangeOtpCode={setOtpCode}
          error={error}
          onSubmit={handleOtpVerifySubmit}
          onCancel={() => {
            setOtpRequired(false);
            setError('');
            setResendMsg('');
            window.localStorage.removeItem('nectaconsult-pending-otp');
          }}
          onResend={handleResendOtp}
          resendLoading={resendLoading}
          resendMsg={resendMsg}
          loading={loading}
        />
      );
    } else {
      innerScreen = (
        <LoginScreen
          form={loginForm}
          error={error}
          successMsg={successMsg}
          onSubmit={handleLoginSubmit}
          onChange={setLoginForm}
          loading={loading}
          onQuickFill={(account) => setLoginForm({ username: account.username, password: account.password })}
          onToggleRegister={() => updateIsRegistering(true)}
          onBackToLanding={() => setShowLanding(true)}
          onForgotPassword={() => {
            setShowResetModal(true);
            setResetMode('request');
            setResetStatus({ loading: false, error: '', success: '' });
          }}
        />
      );
    }
  } else if (dashboard.role === 'sysadmin') {
    innerScreen = <SysAdminDashboard token={token} onLogout={handleLogout} DashboardHeader={DashboardHeader} showToast={showToast} />;
  } else if (dashboard.role === 'admin') {
    innerScreen = <AdminDashboard token={token} onLogout={handleLogout} DashboardHeader={DashboardHeader} showToast={showToast} />;
  } else if (dashboard.role === 'doctor') {
    innerScreen = (
      <DoctorDashboard
        dashboard={dashboard}
        token={token}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onLogout={handleLogout}
        onRefresh={() => loadDashboard(token)}
        error={error}
        setError={setError}
        onStartCall={(appt) => { setIsCalling(true); setCallInfo(appt); }}
        notifications={notifications}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        showToast={showToast}
      />
    );
  } else {
    innerScreen = (
      <PatientDashboard
        dashboard={dashboard}
        token={token}
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        onLogout={handleLogout}
        onRefresh={() => loadDashboard(token)}
        error={error}
        setError={setError}
        onStartCall={(appt) => { setIsCalling(true); setCallInfo(appt); }}
        notifications={notifications}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        onMarkNotificationsRead={handleMarkNotificationsRead}
        autoOpenBookModal={autoOpenBookModal}
        setAutoOpenBookModal={setAutoOpenBookModal}
        showToast={showToast}
      />
    );
  }

  return (
    <>
      {innerScreen}
      {showResetModal && (
        <PasswordResetModal
          mode={resetMode}
          identifier={resetIdentifier}
          setIdentifier={setResetIdentifier}
          token={resetTokenInput}
          setToken={setResetTokenInput}
          newPassword={resetNewPasswordInput}
          setNewPassword={setResetNewPasswordInput}
          status={resetStatus}
          onRequest={handleRequestResetSubmit}
          onConfirm={handleConfirmResetSubmit}
          onClose={() => setShowResetModal(false)}
          onSwitchMode={(newM) => {
            setResetMode(newM);
            setResetStatus({ loading: false, error: '', success: '' });
          }}
        />
      )}
      {isCalling && (
        <ConsultationCallBoundary onClose={() => { setIsCalling(false); setCallInfo(null); }}>
          <ConsultationCall
            role={dashboard?.role}
            token={token}
            patientName={callInfo?.patient_name || (dashboard?.role === 'doctor' ? 'Patient' : displayName(dashboard?.user))}
            doctorName={callInfo?.doctor_name || (dashboard?.role === 'patient' ? 'Doctor' : displayName(dashboard?.user))}
            patientId={callInfo?.patient_id}
            doctorId={callInfo?.doctor_id}
            partnerProfilePic={dashboard?.role === 'doctor' ? callInfo?.patient_profile_pic : callInfo?.doctor_profile_pic}
            appointmentId={callInfo?.id}
            appointmentStatus={callInfo?.status}
            onEndCall={async () => {
              const isAlreadyEnded = callInfo?.status === 'done' || callInfo?.status === 'completed' || callInfo?.status === 'cancelled' || callInfo?.readOnly;
              if (dashboard?.role === 'doctor' && callInfo?.id && !isAlreadyEnded) {
                try {
                  await api.updateAppointmentStatus(token, callInfo.id, 'done');
                  showToast('Consultation session marked as completed', 'success');
                } catch (e) {
                  console.error("Failed to complete appointment:", e);
                }
              }
              setIsCalling(false);
              setCallInfo(null);
              loadDashboard(token);
            }}
          />
        </ConsultationCallBoundary>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </>
  );
}


function Toast({ message, type, onClose }) {
  const iconClass = type === 'success'
    ? 'fa-solid fa-circle-check'
    : type === 'error'
      ? 'fa-solid fa-circle-exclamation'
      : 'fa-solid fa-circle-info';

  return (
    <div className="toast-container">
      <div className={`toast-message ${type}`}>
        <div className="toast-icon">
          <i className={iconClass}></i>
        </div>
        <div className="toast-content">{message}</div>
        <button type="button" className="toast-close" onClick={onClose}>
          ×
        </button>
      </div>
    </div>
  );
}

function LoadingScreen({ message }) {
  return (
    <div className="app-loading-screen">
      <div className="app-loading-card">
        <img className="app-loading-logo" src="/nectacare-logo.png" alt="NectaCare" />
        <div className="spinner-circle spinner-circle-lg"></div>
        <p className="app-loading-text">{message || 'Loading...'}</p>
      </div>
    </div>
  );
}

function LoginScreen({ form, error, successMsg, onSubmit, onChange, onToggleDoctorLogin, onQuickFill, onToggleRegister, onBackToLanding, onForgotPassword, loading }) {
  const [showPw, setShowPw] = useState(false);
  return (
    <div className="auth3-root">
      <div className="auth3-container">

        {/* ── LEFT COLUMN ── */}
        <div className="auth3-left">
          <div className="auth3-brand">
            <img src="/nectacare-logo.png" alt="NectaCare" className="auth3-logo" />
          </div>

          <h1 className="auth3-left-title">NectaConsult</h1>
          <h2 className="auth3-left-subtitle">
            Quality Healthcare. <span className="highlight">Anytime. Anywhere.</span>
          </h2>
          <p className="auth3-left-desc">
            Connect with licensed doctors online in minutes. NectaConsult makes quality care simple, secure and fully covered for CellMed medical aid members.
          </p>

          <div className="auth3-nurse-container">
            <div className="auth3-heart-blob"></div>
            <svg className="auth3-pulse-line" viewBox="0 0 200 80" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0,40 L60,40 L65,30 L70,50 L75,10 L80,70 L85,35 L90,45 L95,40 L200,40" stroke="rgba(29, 78, 216, 0.07)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <img src="/doctor-login-hero-transparent.png" alt="NectaCare Telehealth" className="auth3-nurse-img" />
            <div className="auth3-decor decor-plus"><i className="fa-solid fa-plus"></i></div>
            <div className="auth3-decor decor-calendar"><i className="fa-solid fa-calendar-days"></i></div>
            <div className="auth3-decor decor-video"><i className="fa-solid fa-video"></i></div>
            <div className="auth3-decor decor-pulse"><i className="fa-solid fa-wave-square"></i></div>
          </div>
        </div>

        {/* ── MIDDLE COLUMN ── */}
        <div className="auth3-middle">
          <div className="auth3-how-it-works">
            <h3>How It Works</h3>
            <p className="auth3-how-sub">Getting started is easy</p>

            <div className="auth3-steps">
              <div className="auth3-step">
                <div className="auth3-step-icon-wrap">
                  <div className="auth3-step-circle-icon">
                    <i className="fa-solid fa-user"></i>
                  </div>
                  <div className="auth3-step-number-badge">1</div>
                </div>
                <div className="auth3-step-text">
                  <strong>Enter Membership Number</strong>
                  <span>Enter your CellMed membership number</span>
                </div>
              </div>
              <div className="auth3-step">
                <div className="auth3-step-icon-wrap">
                  <div className="auth3-step-circle-icon">
                    <i className="fa-solid fa-shield-halved"></i>
                  </div>
                  <div className="auth3-step-number-badge">2</div>
                </div>
                <div className="auth3-step-text">
                  <strong>Verify Membership</strong>
                  <span>We verify your membership details instantly</span>
                </div>
              </div>
              <div className="auth3-step">
                <div className="auth3-step-icon-wrap">
                  <div className="auth3-step-circle-icon">
                    <i className="fa-solid fa-file-shield"></i>
                  </div>
                  <div className="auth3-step-number-badge">3</div>
                </div>
                <div className="auth3-step-text">
                  <strong>Complete Registration</strong>
                  <span>Fill in your details and create your account</span>
                </div>
              </div>
              <div className="auth3-step">
                <div className="auth3-step-icon-wrap">
                  <div className="auth3-step-circle-icon">
                    <i className="fa-solid fa-calendar-check"></i>
                  </div>
                  <div className="auth3-step-number-badge">4</div>
                </div>
                <div className="auth3-step-text">
                  <strong>Book Appointment</strong>
                  <span>Choose a specialist and reserve a time slot</span>
                </div>
              </div>
              <div className="auth3-step">
                <div className="auth3-step-icon-wrap">
                  <div className="auth3-step-circle-icon">
                    <i className="fa-solid fa-user-doctor"></i>
                  </div>
                  <div className="auth3-step-number-badge">5</div>
                </div>
                <div className="auth3-step-text">
                  <strong>Start Consulting</strong>
                  <span>Join chat room and consult with your doctor</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div className="auth3-right">
          <div>
            <div className="auth3-card">
              <h2 className="auth3-card-title" style={{ fontWeight: 800, fontSize: '15px', color: '#0f172a', marginBottom: '18px', lineHeight: 1.3 }}>
                Login to your NectaConsult account
              </h2>

              <form className="auth3-form" onSubmit={onSubmit} autoComplete="on">
                <div className="auth3-field">
                  <label htmlFor="login-username">Membership Number / Username</label>
                  <div className="auth3-input-wrap">
                    <i className="fa-solid fa-user auth3-input-icon"></i>
                    <input
                      id="login-username"
                      autoComplete="username"
                      value={form.username}
                      onChange={(e) => onChange((c) => ({ ...c, username: e.target.value }))}
                      placeholder="Enter membership number or username"
                    />
                  </div>
                </div>

                <div className="auth3-field">
                  <label htmlFor="login-password">Password</label>
                  <div className="auth3-input-wrap">
                    <i className="fa-solid fa-lock auth3-input-icon"></i>
                    <input
                      id="login-password"
                      type={showPw ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={form.password}
                      onChange={(e) => onChange((c) => ({ ...c, password: e.target.value }))}
                      placeholder="Enter your password"
                    />
                    <button type="button" className="auth3-pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password">
                      <i className={showPw ? "fa-solid fa-eye-slash" : "fa-solid fa-eye"}></i>
                    </button>
                  </div>
                </div>

                <div className="auth3-form-options">
                  <label className="auth3-remember-me">
                    <input type="checkbox" /> Remember me
                  </label>
                  <a
                    href="#forgot"
                    onClick={(e) => {
                      e.preventDefault();
                      if (onForgotPassword) onForgotPassword();
                    }}
                    className="auth3-forgot-link"
                  >
                    Forgot Password?
                  </a>
                </div>


                {successMsg && (
                  <div className="auth3-success-box" style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    marginBottom: '20px',
                    background: 'rgba(33, 178, 111, 0.08)',
                    border: '1.5px solid var(--success)',
                    color: 'var(--success)',
                    fontSize: '13.5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontWeight: '600'
                  }}>
                    <i className="fa-solid fa-circle-check"></i> <span>{successMsg}</span>
                  </div>
                )}

                {error && (
                  <div className="auth3-error-box">
                    <i className="fa-solid fa-circle-exclamation"></i> {error}
                  </div>
                )}

                <button type="submit" className="auth3-submit-btn" disabled={loading}>
                  {loading ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                      <span className="spinner-circle spinner-circle-sm"></span> Signing In...
                    </span>
                  ) : (
                    <>Login &nbsp;&rarr;</>
                  )}
                </button>
              </form>

              <p className="auth3-switch-text">
                You haven't registered for NectaConsult?{' '}
                <button type="button" className="auth3-switch-link" onClick={onToggleRegister}>
                  Register
                </button>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM CURVED WAVE BANNER (AMBER + DEEP BLUE) ===== */}
      <div style={{ width: '100vw', marginLeft: 'calc(-50vw + 50%)', marginTop: '24px', position: 'relative', overflow: 'hidden', lineHeight: 0 }}>
        <div style={{ position: 'relative', width: '100%', height: '56px' }}>
          {/* Amber Accent Wave */}
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            <path d="M0,18 Q360,55 720,22 T1440,30 L1440,60 L0,60 Z" fill="#ffaa2b" />
          </svg>
          {/* Deep Royal Blue Main Wave */}
          <svg viewBox="0 0 1440 60" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', top: '4px' }}>
            <path d="M0,22 Q360,59 720,26 T1440,34 L1440,60 L0,60 Z" fill="#0d47a1" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function DoctorLoginScreen({ form, error, successMsg, onSubmit, onChange, onTogglePatientLogin, onBackToLanding, loading }) {
  const [showPw, setShowPw] = useState(false);
  return (
    <div className="auth2-root doctor-auth2-root">
      {/* ── LEFT PANEL ── */}
      <div className="auth2-left doctor-auth2-left">
        <div className="auth2-left-inner">
          <div className="auth2-brand">
            <img src="/nectacare-logo.png" alt="NectaCare" className="auth2-logo" />
            <div>
              <strong>NectaConsult</strong>
            </div>
          </div>
          <h1 className="auth2-left-title">Practitioner Portal</h1>
          <p className="auth2-left-sub">
            Secure sign in for verified medical practitioners. Manage your appointments, prescriptions, and telehealth rooms.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth2-right">
        <div className="auth2-form-wrap">
          <div className="auth2-form-header">
            <h2>Practitioner Sign In</h2>
            <p>Enter your professional credentials provided by administration</p>
          </div>

          <form className="auth2-form" onSubmit={onSubmit} autoComplete="on">
            <div className="auth2-field">
              <label htmlFor="doc-username">Username</label>
              <div className="auth2-input-wrap">
                <svg className="auth2-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <input
                  id="doc-username"
                  autoComplete="username"
                  required
                  value={form.username}
                  onChange={(e) => onChange((c) => ({ ...c, username: e.target.value }))}
                  placeholder="e.g. dr.moyo"
                />
              </div>
            </div>

            <div className="auth2-field">
              <label htmlFor="doc-password">Password</label>
              <div className="auth2-input-wrap">
                <svg className="auth2-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                <input
                  id="doc-password"
                  type={showPw ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={form.password}
                  onChange={(e) => onChange((c) => ({ ...c, password: e.target.value }))}
                  placeholder="••••••••"
                />
                <button type="button" className="auth2-pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password">
                  {showPw
                    ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" /><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                    : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                  }
                </button>
              </div>
            </div>

            {successMsg && (
              <div className="auth2-success" style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '12px',
                borderRadius: '8px',
                background: 'rgba(33, 178, 111, 0.08)',
                border: '1.5px solid var(--success)',
                color: 'var(--success)',
                fontSize: '13.5px',
                fontWeight: '600',
                marginBottom: '16px'
              }}>
                <i className="fa-solid fa-circle-check"></i>
                <span>{successMsg}</span>
              </div>
            )}

            {error && (
              <div className="auth2-error">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {error}
              </div>
            )}

            <button type="submit" className="auth2-submit practitioner-submit" disabled={loading}>
              {loading ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                  <span className="spinner-circle spinner-circle-sm"></span> Signing In...
                </span>
              ) : (
                <>
                  Sign in as Practitioner
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" /></svg>
                </>
              )}
            </button>
          </form>

          <p className="auth2-switch">
            Are you a patient?{' '}
            <button type="button" className="auth2-switch-btn" onClick={onTogglePatientLogin}>
              Sign In to Patient Portal
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}


function DoctorDashboard({
  dashboard,
  token,
  currentTab,
  setCurrentTab,
  onLogout,
  onRefresh,
  error,
  setError,
  onStartCall,
  notifications,
  showNotifications,
  setShowNotifications,
  onMarkNotificationsRead,
  showToast,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [noteText, setNoteText] = useState(dashboard.note?.text || '');
  const [availabilityDraft, setAvailabilityDraft] = useState(() =>
    (dashboard.availability || []).map((slot) => ({
      day: slot.day,
      hours: slot.hours,
      is_off: slot.is_off,
    })),
  );
  const [chatDraft, setChatDraft] = useState('');
  const [selectedConsultation, setSelectedConsultation] = useState(null);
  const [selectedConsultationThreadId, setSelectedConsultationThreadId] = useState(null);
  const [selectedConsultationMessages, setSelectedConsultationMessages] = useState([]);
  const [selectedConsultationChatDraft, setSelectedConsultationChatDraft] = useState('');
  const [homeMenuId, setHomeMenuId] = useState(null);

  useEffect(() => {
    function handleHomeClickOutside(event) {
      if (!event.target.closest || !event.target.closest('.home-action-menu-container')) {
        setHomeMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleHomeClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleHomeClickOutside);
    };
  }, []);

  const [consultationsSearch, setConsultationsSearch] = useState('');
  const [consultationsDate, setConsultationsDate] = useState('');
  const [consultationsPage, setConsultationsPage] = useState(1);
  const [consultationsPageLimit, setConsultationsPageLimit] = useState(10);

  async function handleSelectConsultation(appt) {
    setError('');
    try {
      const res = await api.getPatientThread(token, appt.patient_id);
      setSelectedConsultationThreadId(res.thread_id);
      setSelectedConsultationMessages(res.messages);
      setSelectedConsultation(appt);
    } catch (e) {
      setError(e.message || 'Failed to load consultation messages.');
    }
  }

  useEffect(() => {
    if (!selectedConsultation) return;

    async function pollSelectedThread() {
      try {
        const res = await api.getPatientThread(token, selectedConsultation.patient_id);
        setSelectedConsultationMessages(res.messages);
      } catch (e) {
        console.error("Failed to poll selected thread messages:", e);
      }
    }

    const interval = setInterval(pollSelectedThread, 3000);
    return () => clearInterval(interval);
  }, [selectedConsultation, token]);

  async function sendConsultationChatMessage(event, customBody) {
    if (event) event.preventDefault();
    const messageText = customBody || selectedConsultationChatDraft.trim();
    if (!messageText) return;

    setError('');
    try {
      await api.sendMessage(token, selectedConsultationThreadId, messageText);
      if (!customBody) setSelectedConsultationChatDraft('');
      const res = await api.getPatientThread(token, selectedConsultation.patient_id);
      setSelectedConsultationMessages(res.messages);
    } catch (e) {
      setError(e.message || 'Failed to send message.');
    }
  }

  function handleExportExcel(filteredConsultations) {
    let html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head>
        <meta charset="utf-8">
        <!--[if gte mso 9]>
        <xml>
          <x:ExcelWorkbook>
            <x:ExcelWorksheets>
              <x:ExcelWorksheet>
                <x:Name>Consultations</x:Name>
                <x:WorksheetOptions>
                  <x:DisplayGridlines/>
                </x:WorksheetOptions>
              </x:ExcelWorksheet>
            </x:ExcelWorksheets>
          </x:ExcelWorkbook>
        </xml>
        <![endif]-->
        <style>
          table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
          th { background-color: #1a80c7; color: white; font-weight: bold; padding: 12px; border: 1px solid #cbd5e1; text-align: left; }
          td { padding: 10px; border: 1px solid #cbd5e1; font-size: 13px; }
          tr:nth-child(even) { background-color: #f8fafc; }
          .title { font-size: 18px; font-weight: bold; color: #12213d; margin-bottom: 10px; }
          .status { font-weight: bold; text-transform: uppercase; }
          .status-done { color: #21b26f; }
          .status-booked { color: #1a80c7; }
          .status-cancelled { color: #d84d4d; }
        </style>
      </head>
      <body>
        <div class="title">NectaConsult - Doctor Consultation History</div>
        <p style="color:#6b7891; font-size:12px;">Exported on: ${new Date().toLocaleDateString()}</p>
        <table>
          <thead>
            <tr>
              <th>Membership No.</th>
              <th>Insurer</th>
              <th>Patient Name</th>
              <th>Date</th>
              <th>Time</th>
              <th>Reason</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${filteredConsultations.map(c => `
              <tr>
                <td>${c.patient_membership || 'CM-MEMBER'}</td>
                <td>${c.patient_insurer || 'CellMed'}</td>
                <td>${c.patient_name}</td>
                <td>${c.date}</td>
                <td>${formatTimeRange(c.time_label)}</td>
                <td>${c.reason}</td>
                <td class="status status-${c.status}">${c.status === 'booked' ? 'APPROVAL IN PROCESS' : c.status.toUpperCase()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Consultations_Export_${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  const profile = dashboard.user;
  const doctorName = displayName(profile);
  const avatar = profile.profile_pic ? <img src={profile.profile_pic} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : firstInitials(profile);
  const chatMessages = dashboard.messages || [];

  useEffect(() => {
    setNoteText(dashboard.note?.text || '');
    setAvailabilityDraft(
      (dashboard.availability || []).map((slot) => ({
        day: slot.day,
        hours: slot.hours,
        is_off: slot.is_off,
      })),
    );
  }, [dashboard]);

  async function saveNote() {
    setError('');
    await api.saveNote(token, noteText);
    await onRefresh();
  }

  function updateAvailability(index, field, value) {
    setAvailabilityDraft((current) =>
      current.map((slot, slotIndex) => (slotIndex === index ? { ...slot, [field]: value } : slot)),
    );
  }

  function addAvailabilityRow() {
    setAvailabilityDraft((current) => [...current, { day: 'Sunday', hours: '09:00 - 13:00', is_off: false }]);
  }

  function removeAvailabilityRow(index) {
    setAvailabilityDraft((current) => current.filter((_, slotIndex) => slotIndex !== index));
  }

  async function saveAvailability() {
    setError('');
    await api.saveAvailability(token, availabilityDraft);
    await onRefresh();
  }

  async function sendChatMessage(event, customBody) {
    if (event) event.preventDefault();
    const messageText = customBody || chatDraft.trim();
    if (!messageText) {
      return;
    }

    setError('');
    await api.sendMessage(token, dashboard.chat_thread_id, messageText);
    if (!customBody) setChatDraft('');
    await onRefresh();
  }

  return (
    <div className="dashboard-app topnav-layout">
      <DashboardHeader
        role="doctor"
        navigation={doctorNavigation}
        activeLabel={currentTab}
        onNavigate={setCurrentTab}
        query={searchQuery}
        setQuery={setSearchQuery}
        avatar={avatar}
        name={doctorName}
        subtitle={profile.specialty || 'Doctor'}
        profile={profile}
        appointmentsCount={(dashboard.appointments || []).filter(a => a.status === 'upcoming' || a.status === 'verified' || a.status === 'start').length}
        notifications={notifications}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        onMarkRead={onMarkNotificationsRead}
        onLogout={onLogout}
      />

      <main className="dashboard-main">

        {/* Dynamic page content routing */}
        {currentTab === 'Profile' && (
          <ProfileSettings token={token} profile={profile} onRefresh={onRefresh} showToast={showToast} />
        )}

        {currentTab === 'Appointments' && (
          <Appointments token={token} role="doctor" onRefreshDashboard={onRefresh} showToast={showToast} onStartConsultation={onStartCall} />
        )}

        {currentTab === 'Patient Records' && (
          <MedicalRecords token={token} role="doctor" onStartCall={onStartCall} />
        )}

        {currentTab === 'Availability' && (
          <div style={{ padding: '24px' }}>
            <header className="dashboard-header-row">
              <div>
                <h1>Availability Schedule</h1>
                <p className="subtitle">Set which days and hours you're available for consultations.</p>
              </div>
              <button type="button" className="cta-button" onClick={saveAvailability}>
                <Icon name="calendar" /> Save Schedule
              </button>
            </header>

            <div className="availability-page-grid">
              {WEEKDAYS.map((dayName) => {
                const slotIndex = availabilityDraft.findIndex((s) => s.day === dayName);
                const slot = slotIndex >= 0 ? availabilityDraft[slotIndex] : null;
                const isOff = slot ? Boolean(slot.is_off) : true;
                const startHour = slot && !isOff ? (slot.hours?.split(' - ')[0] || '08:00') : '08:00';
                const endHour = slot && !isOff ? (slot.hours?.split(' - ')[1] || '17:00') : '17:00';

                function toggleDay() {
                  if (!slot) {
                    setAvailabilityDraft((cur) => [...cur, { day: dayName, hours: '08:00 - 17:00', is_off: false }]);
                  } else {
                    updateAvailability(slotIndex, 'is_off', !isOff);
                  }
                }

                function setStart(val) {
                  if (!slot) {
                    setAvailabilityDraft((cur) => [...cur, { day: dayName, hours: `${val} - ${endHour}`, is_off: false }]);
                  } else {
                    updateAvailability(slotIndex, 'hours', `${val} - ${endHour}`);
                  }
                }

                function setEnd(val) {
                  if (!slot) {
                    setAvailabilityDraft((cur) => [...cur, { day: dayName, hours: `${startHour} - ${val}`, is_off: false }]);
                  } else {
                    updateAvailability(slotIndex, 'hours', `${startHour} - ${val}`);
                  }
                }

                return (
                  <div key={dayName} className={`avail-day-card ${isOff ? 'avail-day-off' : 'avail-day-on'}`}>
                    <div className="avail-day-header">
                      <h3>{dayName}</h3>
                      <label className="avail-toggle-switch">
                        <input type="checkbox" checked={!isOff} onChange={toggleDay} />
                        <span className="avail-toggle-slider"></span>
                      </label>
                    </div>

                    {isOff ? (
                      <div className="avail-off-label">
                        <span>🚫</span>
                        <p>Not available</p>
                      </div>
                    ) : (
                      <div className="avail-time-pickers">
                        <div className="avail-time-field">
                          <label>Start</label>
                          <input type="time" value={startHour} onChange={(e) => setStart(e.target.value)} />
                        </div>
                        <span className="avail-time-dash">→</span>
                        <div className="avail-time-field">
                          <label>End</label>
                          <input type="time" value={endHour} onChange={(e) => setEnd(e.target.value)} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}



        {currentTab === 'Home' && (
          <>
            <section className="doctor-hero-card">
              <div className="doctor-hero-left">
                <p className="hero-eyebrow">Verified Nectacare Practitioner</p>
                <h1 className="hero-title">
                  {getGreeting()}, Doctor {profile.user.last_name && profile.user.last_name.toLowerCase() !== 'moyo' ? profile.user.last_name : 'Quinton'}
                </h1>
                <p className="hero-sub">
                  Welcome to your online consulting dashboard. You have {dashboard.appointments.length} appointment{dashboard.appointments.length === 1 ? '' : 's'} scheduled for today.
                </p>
                <div className="hero-buttons">
                  <button
                    type="button"
                    className="hero-btn-primary"
                    onClick={() => {
                      const nextAppt = dashboard.appointments.find(a => a.status === 'upcoming' || a.status === 'start');
                      onStartCall(nextAppt || null);
                    }}
                  >
                    Start next consultation &rarr;
                  </button>
                </div>
              </div>

              <div className="doctor-hero-right">
                <div className="hero-medical-card">
                  <div className="card-detail-row">
                    <div>
                      <span className="card-sublabel">Specialty</span>
                      <strong className="card-value">{profile.specialty || 'General Practitioner'}</strong>
                    </div>
                    <div>
                      <span className="card-sublabel">System Status</span>
                      <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: '0.95rem', marginTop: '4px' }}>
                        <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginRight: '6px', fontSize: '15px' }}></i>
                        <span style={{ color: '#10b981' }}>Active & Online</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="content-grid doctor-content-grid" style={{ gridTemplateColumns: '1fr' }}>
              <article className="panel appointments-panel">
                <div className="panel-heading">
                  <h2>Today's Appointments</h2>
                  <button type="button" className="mini-button" onClick={() => setCurrentTab('Appointments')}>
                    Full schedule
                  </button>
                </div>

                <div className="appointments-list">
                  {dashboard.appointments.length === 0 ? (
                    <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '16px' }}>No appointments today.</p>
                  ) : (
                    dashboard.appointments.slice(0, 5).map((appointment) => (
                      <div className="appointment-row" key={`${appointment.id}-${appointment.time_label}`}>
                        <div className="appointment-avatar" style={{ overflow: 'hidden' }}>
                          {appointment.patient_profile_pic ? (
                            <img src={appointment.patient_profile_pic} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            avatarFromName(appointment.patient_name)
                          )}
                        </div>
                        <div className="appointment-copy">
                          <strong>{appointment.patient_name}</strong>
                          <span>{appointment.reason}</span>
                        </div>
                        <div className="appointment-time">{appointment.time_label} {appointment.timezone && <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', fontWeight: 'normal', textAlign: 'right' }}>({appointment.timezone})</span>}</div>
                        <div className="home-action-menu-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
                                  try {
                                    await api.updateAppointmentStatus(token, appointment.id, 'start');
                                    onRefresh();
                                  } catch (e) { }
                                }
                                onStartCall(appointment);
                              }}
                            >
                              <i className="fa-solid fa-video"></i>
                              Join Chat &rarr;
                            </button>
                          )}

                          {appointment.status !== 'cancelled' && appointment.status !== 'done' && (
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setHomeMenuId(homeMenuId === appointment.id ? null : appointment.id);
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
                                  fontSize: '16px'
                                }}
                                title="More options"
                              >
                                <i className="fa-solid fa-ellipsis-vertical"></i>
                              </button>

                              {homeMenuId === appointment.id && (
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
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        setHomeMenuId(null);
                                        try {
                                          await api.doctorApproveAppointment(token, appointment.id);
                                          showToast('Appointment accepted successfully', 'success');
                                          onRefresh();
                                        } catch (err) {
                                          showToast(err.message, 'error');
                                        }
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
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setHomeMenuId(null);
                                      try {
                                        await api.updateAppointmentStatus(token, appointment.id, 'done');
                                        showToast('Appointment marked done', 'success');
                                        onRefresh();
                                      } catch (err) {
                                        showToast(err.message, 'error');
                                      }
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
                                      setHomeMenuId(null);
                                      setCurrentTab('Appointments');
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
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setHomeMenuId(null);
                                      try {
                                        await api.cancelAppointment(token, appointment.id);
                                        showToast('Appointment cancelled', 'info');
                                        onRefresh();
                                      } catch (err) {
                                        showToast(err.message, 'error');
                                      }
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

                      </div>
                    ))
                  )}
                </div>
              </article>
            </section>
          </>
        )}

        {error ? <p className="form-message form-error dashboard-error">{error}</p> : null}
      </main>
    </div>
  );
}

function PatientDashboard({
  dashboard,
  token,
  currentTab,
  setCurrentTab,
  onLogout,
  onRefresh,
  error,
  setError,
  onStartCall,
  notifications,
  showNotifications,
  setShowNotifications,
  onMarkNotificationsRead,
  autoOpenBookModal,
  setAutoOpenBookModal,
  showToast,
}) {
  const [searchQuery, setSearchQuery] = useState('');

  const profile = dashboard.user;
  const patientName = displayName(profile);
  const avatar = profile.profile_pic ? <img src={profile.profile_pic} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : firstInitials(profile);

  return (
    <div className="dashboard-app topnav-layout">
      <DashboardHeader
        role="patient"
        navigation={patientNavigation}
        activeLabel={currentTab}
        onNavigate={setCurrentTab}
        query={searchQuery}
        setQuery={setSearchQuery}
        avatar={avatar}
        name={patientName}
        subtitle={profile.plan || 'Member'}
        profile={profile}
        notifications={notifications}
        showNotifications={showNotifications}
        setShowNotifications={setShowNotifications}
        onMarkRead={onMarkNotificationsRead}
        onLogout={onLogout}
        onBookConsultation={() => { setCurrentTab('Appointments'); setAutoOpenBookModal(true); }}
      />

      <main className="dashboard-main patient-main">

        {/* Dynamic page content routing */}

        {currentTab === 'Appointments' && (
          <Appointments
            token={token}
            role="patient"
            onRefreshDashboard={onRefresh}
            autoOpenBook={autoOpenBookModal}
            onCloseBookModal={() => setAutoOpenBookModal(false)}
            onStartConsultation={onStartCall}
            showToast={showToast}
          />
        )}

        {currentTab === 'Prescriptions' && (
          <Prescriptions token={token} role="patient" onRefreshDashboard={onRefresh} />
        )}

        {currentTab === 'Consultation Records' && (
          <MedicalRecords token={token} role="patient" appointments={dashboard.appointments || []} onStartCall={onStartCall} />
        )}

        {currentTab === 'Profile' && (
          <ProfileSettings token={token} profile={profile} onRefresh={onRefresh} showToast={showToast} />
        )}

        {currentTab === 'Home' && (
          <>
            {dashboard.appointments?.find(a => a.status === 'start') && (
              <div style={{
                background: '#ffffff',
                border: '2px solid #ffbf47',
                color: '#12213d',
                padding: '16px 20px',
                borderRadius: '16px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                boxShadow: 'none'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <i className="fa-solid fa-video" style={{ fontSize: '22px', color: '#0f172a' }}></i>
                  <div>
                    <strong style={{ fontSize: '15.5px', display: 'block', color: '#ffbf47', fontWeight: '800' }}>
                      {dashboard.appointments.find(a => a.status === 'start').doctor_name} has started your consultation!
                    </strong>
                    <span style={{ fontSize: '13px', color: '#64748b', fontWeight: '600' }}>Your doctor is waiting in the consultation room. Click Join to start now.</span>
                  </div>
                </div>
                <button
                  type="button"
                  style={{
                    background: '#ffbf47',
                    color: '#12213d',
                    border: 'none',
                    fontWeight: '800',
                    padding: '10px 22px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    boxShadow: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                  onClick={() => onStartCall(dashboard.appointments.find(a => a.status === 'start'))}
                >
                  <i className="fa-solid fa-phone" style={{ color: '#0f172a' }}></i>
                  <span>Join Now &rarr;</span>
                </button>
              </div>


            )}

            <section className="patient-hero-card">

              <div className="patient-hero-left">
                <p className="hero-eyebrow">{getGreeting()},</p>
                <h1 className="hero-title">{profile.user.first_name || patientName}</h1>
                <p className="hero-sub">
                  You have {dashboard.appointments.length} upcoming consultation{dashboard.appointments.length === 1 ? '' : 's'} today. Have a great day.
                </p>
                <div className="hero-buttons">
                  <button
                    type="button"
                    className="hero-btn-primary"
                    onClick={() => { setCurrentTab('Appointments'); setAutoOpenBookModal(true); }}
                  >
                    Book consultation &rarr;
                  </button>
                </div>
              </div>

              <div className="patient-hero-right">
                <div className="hero-medical-card">
                  <div className="card-detail-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <span className="card-sublabel">Membership ID</span>
                      <strong className="card-value" style={{ fontSize: '0.95rem' }}>{profile.medical_aid_number || 'CM-2048-7791'}</strong>
                    </div>
                    <div>
                      <span className="card-sublabel">Verification</span>
                      <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: '0.95rem', marginTop: '4px' }}>
                        <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginRight: '6px', fontSize: '15px' }}></i>
                        <span style={{ color: '#10b981' }}>Verified</span>
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: '1px dashed var(--border)', margin: '12px 0' }} />
                  <div className="card-detail-row">
                    <div>
                      <span className="card-sublabel">Medical Aid Status</span>
                      <div style={{ display: 'flex', alignItems: 'center', fontWeight: 700, fontSize: '0.9rem', marginTop: '4px' }}>
                        {profile.medical_aid_status === 'Active' || profile.medical_aid_status === 'Verified' || !profile.medical_aid_status || profile.medical_aid_status === 'Pending' ? (
                          <>
                            <i className="fa-solid fa-circle-check" style={{ color: '#10b981', marginRight: '6px', fontSize: '15px' }}></i>
                            <span style={{ color: '#10b981' }}>Active</span>
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-circle-xmark" style={{ color: '#ef4444', marginRight: '6px', fontSize: '15px' }}></i>
                            <span style={{ color: '#ef4444' }}>{profile.medical_aid_status}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Horizontal stretched Upcoming Appointments list */}
            <section className="patient-dashboard-grid-stretched">
              <article className="panel appointments-panel full-width-panel">
                <div className="panel-heading">
                  <h2>Upcoming Appointments</h2>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setCurrentTab('Appointments')}
                    style={{ background: 'none', border: 'none', color: 'var(--primary)', fontWeight: 'bold', fontSize: '13.5px', cursor: 'pointer', padding: 0 }}
                  >
                    View all &rarr;
                  </button>
                </div>

                <div className="appointments-list">
                  {dashboard.appointments.length === 0 ? (
                    <p style={{ color: 'var(--muted)', textAlign: 'center', padding: '16px' }}>No upcoming consults booked.</p>
                  ) : (
                    dashboard.appointments.slice(0, 5).map((appointment) => (
                      <div className="appointment-row" key={`${appointment.id}-${appointment.time_label}`}>
                        <div className="appointment-avatar" style={{ overflow: 'hidden' }}>
                          {appointment.doctor_profile_pic ? (
                            <img src={appointment.doctor_profile_pic} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                          ) : (
                            avatarFromName(appointment.doctor_name)
                          )}
                        </div>
                        <div className="appointment-copy">
                          <strong>{appointment.doctor_name}</strong>
                          <span>{appointment.reason}</span>
                        </div>
                        <div className="appointment-time appointment-time-wrap">{appointment.time_label} {appointment.timezone && <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', fontWeight: 'normal', textAlign: 'right' }}>({appointment.timezone})</span>}</div>
                        {appointment.status === 'booked' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', color: '#ffbf47', fontWeight: 700, fontSize: '0.85rem' }}>
                            <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px', fontSize: '13px' }}></i>
                            Pending
                          </span>
                        ) : appointment.status === 'verified' ? (
                          <span style={{ display: 'inline-flex', alignItems: 'center', color: '#ffbf47', fontWeight: 700, fontSize: '0.85rem' }}>
                            <i className="fa-solid fa-circle-notch fa-spin" style={{ marginRight: '6px', fontSize: '13px' }}></i>
                            Pending Doctor
                          </span>

                        ) : appointment.status === 'done' ? (
                          <span style={{ color: 'var(--success)', fontWeight: 700, fontSize: '0.85rem' }}>Completed</span>
                        ) : appointment.status === 'start' ? (
                          <button
                            type="button"
                            className="cta-button"
                            style={{
                              background: '#10b981',
                              color: 'white',
                              border: 'none',
                              fontWeight: 'bold',
                              padding: '8px 16px',
                              borderRadius: '8px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.35)'
                            }}
                            onClick={() => onStartCall(appointment)}
                          >
                            <i className="fa-solid fa-video"></i>
                            Join Consultation &rarr;
                          </button>
                        ) : (

                          <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: '0.85rem' }}>Scheduled</span>
                        )}

                      </div>
                    ))
                  )}
                </div>

              </article>
            </section>
          </>
        )}

        {error ? <p className="form-message form-error dashboard-error">{error}</p> : null}
      </main>
    </div>
  );
}

function DashboardHeader({
  role,
  navigation,
  activeLabel,
  onNavigate,
  query,
  setQuery,
  avatar,
  name,
  subtitle,
  profile,
  appointmentsCount = 0,
  notifications,
  showNotifications,
  setShowNotifications,
  onMarkRead,
  onLogout,
  onBookConsultation,
}) {
  const unreadCount = notifications ? notifications.filter((n) => n.status === 'unread').length : 0;
  const [showDropdown, setShowDropdown] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const dropdownRef = useRef(null);

  const isProfileIncomplete = role === 'patient' && profile && (
    !profile.phone || !profile.address || !profile.date_of_birth
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="new-dashboard-header">
      {/* ── ROW 1: Logo and Action ── */}
      <div className="header-top-row">
        <div className="header-brand">
          <img className="brand-logo" src="/nectacare-logo.png" alt="NectaCare" />
        </div>

        <div className="header-actions" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '14px' }} ref={dropdownRef}>
          {/* Notification Bell Icon */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowNotifications && setShowNotifications(!showNotifications)}
              style={{
                background: 'rgba(29, 44, 72, 0.05)',
                border: '1px solid var(--border)',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#12213d',
                fontSize: '16px',
                position: 'relative',
                transition: 'all 0.2s ease',
                outline: 'none'
              }}
              title="Notifications"
            >
              <i className="fa-regular fa-bell"></i>
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-3px',
                    right: '-3px',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: 'bold',
                    borderRadius: '10px',
                    padding: '2px 5px',
                    minWidth: '17px',
                    height: '17px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover Dropdown */}
            {showNotifications && (
              <div
                style={{
                  position: 'absolute',
                  top: '50px',
                  right: '0',
                  width: '320px',
                  maxWidth: '90vw',
                  background: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: '16px',
                  boxShadow: '0 12px 32px rgba(29, 44, 72, 0.18)',
                  zIndex: 200,
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-bell" style={{ color: 'var(--primary)', fontSize: '13px' }}></i>
                    <strong style={{ fontSize: '14px', color: '#12213d' }}>Notifications</strong>
                  </div>
                  {unreadCount > 0 && onMarkRead && (
                    <button
                      type="button"
                      onClick={onMarkRead}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }}
                    >
                      Mark all as read
                    </button>
                  )}
                </div>

                <div style={{ maxHeight: '280px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {(!notifications || notifications.length === 0) ? (
                    <p style={{ fontSize: '13px', color: 'var(--muted)', textAlign: 'center', margin: '20px 0' }}>
                      No notifications yet.
                    </p>
                  ) : (
                    notifications.map((n) => (
                      <div
                        key={n.id}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '10px',
                          background: n.status === 'unread' ? 'rgba(26, 128, 199, 0.08)' : '#f8fafc',
                          fontSize: '12.5px',
                          color: '#12213d'
                        }}
                      >
                        <p style={{ margin: 0, lineHeight: 1.4, fontWeight: n.status === 'unread' ? '600' : 'normal' }}>{n.message}</p>
                        <span style={{ fontSize: '10.5px', color: 'var(--muted)', marginTop: '4px', display: 'block' }}>
                          {n.created_at ? new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Simple Profile Icon */}
          <div className="top-profile-chip" onClick={() => setShowDropdown(!showDropdown)} style={{ cursor: 'pointer', position: 'relative' }}>
            <div className="top-avatar" style={{ position: 'relative' }}>
              {avatar}
              {isProfileIncomplete && (
                <span
                  style={{
                    position: 'absolute', top: '-2px', right: '-2px', width: '10px', height: '10px',
                    borderRadius: '50%', background: '#ef4444', border: '2px solid white'
                  }}
                  title="Profile Incomplete"
                />
              )}
            </div>
            <span className="top-name">{name}</span>
            <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px', marginLeft: '6px', opacity: 0.7 }}></i>
          </div>

          {/* Mobile Hamburger Menu Button */}
          <button
            type="button"
            className="mobile-hamburger-btn"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle Navigation Menu"
          >
            <i className={mobileMenuOpen ? "fa-solid fa-xmark" : "fa-solid fa-bars"}></i>
          </button>

          {/* Profile incomplete popover reminder banner */}
          {isProfileIncomplete && !showDropdown && (
            <div
              style={{
                position: 'absolute',
                top: '52px',
                right: '0',
                background: '#ffffff',
                border: '1.5px solid #ffaa2b',
                borderRadius: '14px',
                padding: '10px 14px',
                boxShadow: '0 10px 25px rgba(255, 170, 43, 0.22)',
                zIndex: 99,
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minWidth: '240px'
              }}
            >
              <span style={{ fontSize: '18px' }}>⚠️</span>
              <div style={{ flex: 1 }}>
                <strong style={{ display: 'block', fontSize: '12px', color: '#12213d' }}>Profile Incomplete</strong>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Add phone, address & DOB</span>
              </div>
              <button
                type="button"
                className="mini-button"
                style={{ fontSize: '11px', padding: '4px 8px' }}
                onClick={() => onNavigate('Profile')}
              >
                Update
              </button>
            </div>
          )}

          {showDropdown && (
            <div
              className="panel dropdown-menu"
              style={{
                position: 'absolute',
                top: '52px',
                right: '0',
                width: '180px',
                zIndex: 100,
                padding: '8px',
                boxShadow: 'var(--shadow)',
                background: 'white',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}
            >
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  onNavigate('Profile');
                  setShowDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 12px',
                  background: 'none',
                  border: 'none',
                  borderRadius: '8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(29, 44, 72, 0.04)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <i className="fa-solid fa-user" style={{ width: '16px' }}></i> My Profile
              </button>
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  onLogout();
                  setShowDropdown(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  width: '100%',
                  padding: '10px 12px',
                  background: 'none',
                  border: 'none',
                  borderRadius: '8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: '#ef4444'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <i className="fa-solid fa-right-from-bracket" style={{ width: '16px' }}></i> Sign Out
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── ROW 2: Navigation blue bar ── */}
      <div className={`header-nav-bar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="nav-links-container">
          {navigation.map((item) => {
            const isApptTab = item.label === 'Appointments';
            return (
              <button
                key={item.label}
                type="button"
                className={`nav-link-item ${activeLabel === item.label ? 'active' : ''}`}
                onClick={() => {
                  onNavigate(item.label);
                  setMobileMenuOpen(false);
                }}
              >
                <span className="nav-icon-span">
                  <i className={item.icon} style={{ fontSize: '15px' }}></i>
                </span>
                {item.label}
                {isApptTab && role === 'doctor' && appointmentsCount > 0 && (
                  <span className="nav-badge-pill">{appointmentsCount}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
}

function Sidebar({ navigation, activeLabel, onNavigate }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <img className="brand-image" src="/nectacare-logo.png" alt="NectaCare" />
        <div>
          <strong>NectaConsult</strong>
        </div>
      </div>

      <nav className="sidebar-nav" aria-label="NectaConsult navigation">
        {navigation.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`sidebar-item ${activeLabel === item.label ? 'active' : ''}`}
            onClick={() => onNavigate(item.label)}
          >
            <span className="nav-icon" aria-hidden="true">
              <Icon name={item.icon} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}

function Topbar({
  query,
  setQuery,
  avatar,
  name,
  subtitle,
  notifications,
  showNotifications,
  setShowNotifications,
  onMarkRead,
  onLogout,
}) {
  const unreadCount = notifications.filter((n) => n.status === 'unread').length;

  return (
    <header className="topbar">
      <label className="search-bar" aria-label="Search">
        <span className="search-icon" aria-hidden="true">
          <Icon name="search" />
        </span>
        <input type="search" placeholder="Search..." value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>

      <div className="topbar-actions" style={{ position: 'relative' }}>
        <button
          type="button"
          className="icon-button"
          aria-label="Notifications"
          onClick={() => setShowNotifications(!showNotifications)}
        >
          <Icon name="bell" />
          {unreadCount > 0 && <span className="notification-dot" aria-hidden="true" />}
        </button>

        {showNotifications && (
          <div
            className="panel"
            style={{
              position: 'absolute',
              top: '50px',
              right: '0',
              width: '320px',
              zIndex: 20,
              padding: '16px',
              boxShadow: 'var(--shadow)',
              background: 'white',
              border: '1px solid var(--border)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>In-System Alerts</h4>
              {unreadCount > 0 && (
                <button type="button" className="text-button" onClick={onMarkRead} style={{ fontSize: '12px' }}>
                  Mark all read
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto' }}>
              {notifications.length === 0 ? (
                <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>No new notifications.</p>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    style={{
                      fontSize: '13px',
                      padding: '8px',
                      borderRadius: '6px',
                      background: n.status === 'unread' ? 'rgba(26,128,199,0.05)' : 'white',
                      borderLeft: n.status === 'unread' ? '3px solid var(--primary)' : 'none',
                    }}
                  >
                    {n.message}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        <div className="profile-chip" onClick={onLogout} style={{ cursor: 'pointer' }} title="Click to log out">
          <div className="avatar">{avatar}</div>
          <div>
            <strong>{name}</strong>
          </div>
        </div>
      </div>
    </header>
  );
}

function ChatPanel({ title, subtitle, messages, draft, setDraft, onSend, currentUserRole, readOnly = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const recordingTimer = useRef(null);
  const fileInputRef = useRef(null);
  const [showRxForm, setShowRxForm] = useState(false);
  const [rxForm, setRxForm] = useState({ drug: '', dosage: '', remarks: '' });
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);

  // Image upload progress state
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusMsg, setUploadStatusMsg] = useState('');

  function startRecording() {
    setIsRecording(true);
    setRecordingSec(0);
    recordingTimer.current = setInterval(() => {
      setRecordingSec((s) => s + 1);
    }, 1000);
  }

  function stopAndSendAudio() {
    clearInterval(recordingTimer.current);
    setIsRecording(false);
    const audioLabel = `[AUDIO] Voice note (${recordingSec}s)`;
    onSend(null, audioLabel);
  }

  function handleImageChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image file is too large. Please select an image under 5MB.');
      return;
    }

    setIsUploadingImage(true);
    setUploadProgress(15);
    setUploadStatusMsg(`Reading ${file.name}...`);

    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        const percent = Math.round((evt.loaded / evt.total) * 60);
        setUploadProgress(percent);
      }
    };

    reader.onload = async () => {
      setUploadProgress(75);
      setUploadStatusMsg('Sending photo to server...');
      try {
        await onSend(null, `[IMAGE] ${reader.result}`);
        setUploadProgress(100);
        setUploadStatusMsg('Photo sent!');
      } catch (err) {
        console.error("Image upload error", err);
      } finally {
        setTimeout(() => {
          setIsUploadingImage(false);
          setUploadProgress(0);
          setUploadStatusMsg('');
        }, 500);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  async function handleCameraPhotoSend(capturedBase64) {
    setIsUploadingImage(true);
    setUploadProgress(40);
    setUploadStatusMsg('Processing photo...');
    try {
      setUploadProgress(75);
      setUploadStatusMsg('Sending photo to server...');
      await onSend(null, `[IMAGE] ${capturedBase64}`);
      setUploadProgress(100);
      setUploadStatusMsg('Photo sent!');
    } catch (err) {
      console.error("Camera photo upload error", err);
    } finally {
      setTimeout(() => {
        setIsUploadingImage(false);
        setUploadProgress(0);
        setUploadStatusMsg('');
      }, 500);
    }
  }

  function handleSendPrescription(e) {
    e.preventDefault();
    if (!rxForm.drug || !rxForm.dosage) {
      alert('Please fill out drug name and dosage.');
      return;
    }
    const rxBody = `[PRESCRIPTION] ${rxForm.drug} | ${rxForm.dosage} | ${rxForm.remarks || 'No additional remarks'}`;
    onSend(null, rxBody);
    setRxForm({ drug: '', dosage: '', remarks: '' });
    setShowRxForm(false);
  }

  function renderMessageBody(body) {
    if (body.startsWith('[AUDIO]')) {
      return (
        <div className="audio-player-bubble">
          <span className="audio-play-icon">▶</span>
          <div className="audio-waves">
            <span className="wave-bar"></span>
            <span className="wave-bar"></span>
            <span className="wave-bar"></span>
            <span className="wave-bar"></span>
          </div>
          <span className="audio-time">{body.replace('[AUDIO] ', '')}</span>
        </div>
      );
    }
    if (body.startsWith('[PRESCRIPTION]')) {
      const parts = body.replace('[PRESCRIPTION] ', '').split('|');
      const drug = parts[0]?.trim() || '';
      const dosage = parts[1]?.trim() || '';
      const remarks = parts[2]?.trim() || '';
      return (
        <div className="prescription-bubble">
          <div className="rx-badge-row">
            <span className="rx-symbol">℞</span>
            <strong>PRESCRIPTION SHEET</strong>
          </div>
          <div className="rx-details">
            <p><strong>Medication:</strong> {drug}</p>
            <p><strong>Dosage:</strong> {dosage}</p>
            {remarks && <p className="rx-remarks"><strong>Instructions:</strong> {remarks}</p>}
          </div>
        </div>
      );
    }
    if (body.startsWith('[IMAGE]')) {
      const src = body.replace('[IMAGE] ', '').trim();
      return (
        <div style={{ marginTop: '8px' }}>
          <img
            src={src}
            alt="Sent attachment"
            style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '12px', cursor: 'pointer', border: '1px solid var(--border)' }}
            onClick={() => setSelectedImagePreview(src)}
          />
        </div>
      );
    }
    return <p>{body}</p>;
  }

  return (
    <article className="panel chat-panel">
      <div className="panel-heading notes-heading">
        <div>
          <h2>{title}</h2>
          <span className="notes-badge">{subtitle}</span>
        </div>
      </div>

      <div className="chat-list">
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.sender_role === currentUserRole ? 'me' : 'them'}`}>
            <strong>{message.sender_name}</strong>
            {renderMessageBody(message.body)}
          </div>
        ))}
      </div>

      {/* Image Upload Loading Progress Banner */}
      {isUploadingImage && (
        <div style={{
          margin: '8px 16px',
          padding: '10px 14px',
          background: 'rgba(2, 132, 199, 0.06)',
          border: '1px solid rgba(2, 132, 199, 0.2)',
          borderRadius: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px', fontWeight: '700', color: '#0284c7' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-spinner fa-spin" style={{ color: '#0284c7' }}></i>
              {uploadStatusMsg || 'Uploading Image...'}
            </span>
            <span>{uploadProgress}%</span>
          </div>
          <div style={{ width: '100%', height: '6px', background: 'rgba(2, 132, 199, 0.15)', borderRadius: '999px', overflow: 'hidden' }}>
            <div style={{
              width: `${uploadProgress}%`,
              height: '100%',
              background: 'linear-gradient(90deg, #0284c7, #38bdf8)',
              borderRadius: '999px',
              transition: 'width 0.25s ease-out'
            }} />
          </div>
        </div>
      )}

      {showRxForm && (
        <form onSubmit={handleSendPrescription} className="inline-prescription-editor">
          <h4 style={{ margin: '0 0 6px 0', color: 'var(--primary)' }}>📄 Give Digital Prescription</h4>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              required
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
              placeholder="Drug Name (e.g. Amoxicillin)"
              value={rxForm.drug}
              onChange={(e) => setRxForm({ ...rxForm, drug: e.target.value })}
            />
            <input
              required
              style={{ flex: 1, padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
              placeholder="Dosage (e.g. 500mg, 1 cap 3x daily)"
              value={rxForm.dosage}
              onChange={(e) => setRxForm({ ...rxForm, dosage: e.target.value })}
            />
          </div>
          <input
            style={{ width: '100%', padding: '8px', borderRadius: '6px', border: '1px solid var(--border)', fontSize: '13px' }}
            placeholder="Special Remarks (e.g. Take after food for 7 days)"
            value={rxForm.remarks}
            onChange={(e) => setRxForm({ ...rxForm, remarks: e.target.value })}
          />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button type="button" className="secondary-button compact" onClick={() => setShowRxForm(false)}>Cancel</button>
            <button type="submit" className="cta-button compact" style={{ padding: '0 12px' }}>Send Rx</button>
          </div>
        </form>
      )}

      {readOnly ? (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border)', background: '#f8fafc',
          color: 'var(--muted)', textAlign: 'center', fontSize: '13px', borderRadius: '0 0 16px 16px', fontWeight: '500'
        }}>
          <i className="fa-solid fa-lock" style={{ marginRight: '6px', color: '#1a80c7' }}></i>
          Past consultation record (Read Only View)
        </div>
      ) : (
        <form className="chat-form" onSubmit={onSend}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%' }}>
            {isRecording ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '10px', padding: '8px 12px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }}></span>
                <span style={{ color: '#ef4444', fontWeight: 'bold', fontSize: '14px' }}>Recording... 00:{recordingSec.toString().padStart(2, '0')}</span>
                <button type="button" className="mini-button" style={{ marginLeft: 'auto', background: '#ef4444', color: 'white' }} onClick={stopAndSendAudio}>Stop & Send</button>
              </div>
            ) : (
              <>
                <button
                  type="button"
                  className="icon-button"
                  title="Record voice note"
                  onClick={startRecording}
                  style={{ padding: '8px', background: 'rgba(29, 44, 72, 0.04)', borderRadius: '50%' }}
                >
                  🎙️
                </button>
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    className="icon-button"
                    title="Attach Photo or File"
                    onClick={() => setShowAttachMenu(!showAttachMenu)}
                    style={{ padding: '8px', background: 'rgba(29, 44, 72, 0.04)', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <i className="fa-solid fa-paperclip" style={{ fontSize: '15px', color: '#475569' }}></i>
                  </button>
                  {showAttachMenu && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '45px',
                        left: '0',
                        background: 'white',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
                        padding: '6px',
                        zIndex: 100,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        minWidth: '150px'
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => { setShowAttachMenu(false); setIsCameraOpen(true); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                          padding: '8px 10px', background: 'none', border: 'none', borderRadius: '8px',
                          cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '500', color: '#1e293b'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <i className="fa-solid fa-camera" style={{ color: '#3b82f6', width: '16px' }}></i> Take Photo
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowAttachMenu(false); fileInputRef.current?.click(); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                          padding: '8px 10px', background: 'none', border: 'none', borderRadius: '8px',
                          cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '500', color: '#1e293b'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = '#f1f5f9'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                      >
                        <i className="fa-solid fa-file-arrow-up" style={{ color: '#10b981', width: '16px' }}></i> Upload File
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: 'none' }}
                />
                <CameraModal
                  isOpen={isCameraOpen}
                  onClose={() => setIsCameraOpen(false)}
                  onCapture={handleCameraPhotoSend}
                />
                {currentUserRole === 'doctor' && (
                  <button
                    type="button"
                    className="icon-button"
                    title="Give Prescription"
                    onClick={() => setShowRxForm(!showRxForm)}
                    style={{ padding: '8px', background: 'rgba(29, 44, 72, 0.04)', borderRadius: '50%' }}
                  >
                    📄
                  </button>
                )}
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={1}
                  placeholder="Write a message..."
                  style={{ flex: 1, resize: 'none', minHeight: '38px', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                />
                <button type="submit" className="cta-button compact" style={{ minHeight: '38px', borderRadius: '10px', padding: '0 16px' }}>
                  Send
                </button>
              </>
            )}
          </div>
        </form>
      )}

      {/* ── IMAGE LIGHTBOX PREVIEW MODAL ── */}
      {selectedImagePreview && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 99999,
            padding: '24px'
          }}
          onClick={() => setSelectedImagePreview(null)}
        >
          <div
            style={{
              position: 'relative',
              maxWidth: '90vw',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelectedImagePreview(null)}
              style={{
                position: 'absolute',
                top: '-44px',
                right: '0',
                background: 'rgba(255, 255, 255, 0.25)',
                color: 'white',
                border: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontSize: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
              }}
              title="Close Preview"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <img
              src={selectedImagePreview}
              alt="Enlarged Attachment"
              style={{
                maxWidth: '90vw',
                maxHeight: '78vh',
                borderRadius: '12px',
                objectFit: 'contain',
                boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            />

            <a
              href={selectedImagePreview}
              download="nectaconsult-attachment.png"
              style={{
                marginTop: '16px',
                padding: '10px 22px',
                background: '#1a80c7',
                color: 'white',
                borderRadius: '30px',
                textDecoration: 'none',
                fontWeight: 'bold',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                boxShadow: '0 4px 14px rgba(26, 128, 199, 0.4)'
              }}
            >
              <i className="fa-solid fa-download"></i> Save / Download Image
            </a>
          </div>
        </div>
      )}
    </article>
  );
}

function avatarFromName(name) {
  if (!name) {
    return 'NC';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function formatDate(dateStr) {
  if (!dateStr) return 'TBD';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

function formatTimeRange(timeLabel) {
  if (!timeLabel) return 'TBD';
  const parts = timeLabel.split('-');
  if (parts.length === 2) {
    return `From ${parts[0].trim()} to ${parts[1].trim()}`;
  }
  return timeLabel;
}

function Icon({ name }) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.8',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    viewBox: '0 0 24 24',
    'aria-hidden': 'true',
  };

  switch (name) {
    case 'grid':
      return (
        <svg {...commonProps}>
          <rect x="4" y="4" width="6" height="6" rx="1.5" />
          <rect x="14" y="4" width="6" height="6" rx="1.5" />
          <rect x="4" y="14" width="6" height="6" rx="1.5" />
          <rect x="14" y="14" width="6" height="6" rx="1.5" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...commonProps}>
          <rect x="3" y="5" width="18" height="16" rx="3" />
          <path d="M7 3v4M17 3v4M3 10h18" />
        </svg>
      );
    case 'video':
      return (
        <svg {...commonProps}>
          <rect x="3" y="6" width="11" height="12" rx="3" />
          <path d="M14 9.5v5l5-2.5v-2l-5-2.5z" />
        </svg>
      );
    case 'patient':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M4.5 19c1.4-3.5 4.3-5.5 7.5-5.5s6.1 2 7.5 5.5" />
        </svg>
      );
    case 'prescription':
      return (
        <svg {...commonProps}>
          <rect x="5" y="4" width="10" height="16" rx="2" />
          <path d="M9 8h5M9 12h5M9 16h3" />
          <path d="M16 8l3 3-5 5" />
        </svg>
      );
    case 'star':
      return (
        <svg {...commonProps}>
          <path d="M12 3.8l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.2-4.1 5.8-.9L12 3.8z" />
        </svg>
      );
    case 'clock':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7.5V12l3 2" />
        </svg>
      );
    case 'notes':
      return (
        <svg {...commonProps}>
          <path d="M5 4.5h10l4 4V19a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 19V6A1.5 1.5 0 0 1 5 4.5Z" />
          <path d="M15 4.5V9h4" />
          <path d="M7 12h8M7 15.5h6" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...commonProps}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...commonProps}>
          <path d="M10 5H6.5A1.5 1.5 0 0 0 5 6.5v11A1.5 1.5 0 0 0 6.5 19H10" />
          <path d="M13 12H4" />
          <path d="M16 9l4 3-4 3" />
        </svg>
      );
    case 'search':
      return (
        <svg {...commonProps}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...commonProps}>
          <path d="M8 17h8M7 17v-4a5 5 0 0 1 10 0v4" />
          <path d="M10 18a2 2 0 0 0 4 0" />
        </svg>
      );
    case 'message':
      return (
        <svg {...commonProps}>
          <path d="M21 12a7 7 0 0 1-7 7H8l-5 2 1.5-4.5A7 7 0 0 1 4 12a7 7 0 0 1 7-7h3a7 7 0 0 1 7 7Z" />
        </svg>
      );
    default:
      return null;
  }
}

function OtpScreen({ email, otpCode, onChangeOtpCode, error, onSubmit, onCancel, onResend, resendLoading, resendMsg, loading }) {
  const [countdown, setCountdown] = useState(60);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleResendClick = () => {
    if (countdown > 0 || resendLoading) return;
    if (onResend) {
      onResend();
      setCountdown(60);
    }
  };

  return (
    <div className="auth3-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: '#f0f4f9' }}>
      <div className="auth3-card" style={{ maxWidth: '460px', width: '100%' }}>
        <h2 className="auth3-card-title" style={{ textAlign: 'center', fontSize: '24px' }}>Enter Security Code</h2>
        <p className="auth3-card-sub" style={{ textAlign: 'center', marginBottom: '8px' }}>We've sent a 6-digit verification code to:</p>
        <strong style={{ display: 'block', color: 'var(--text)', marginTop: '8px', fontSize: '15px', textAlign: 'center', marginBottom: '24px' }}>{email}</strong>

        <form className="auth3-form" onSubmit={onSubmit}>
          <div className="auth3-field">
            <label htmlFor="otp-input" style={{ fontWeight: '700' }}>Verification Code</label>
            <div className="auth3-input-wrap">
              <i className="fa-solid fa-lock auth3-input-icon"></i>
              <input
                id="otp-input"
                required
                value={otpCode}
                onChange={(e) => onChangeOtpCode(e.target.value)}
                placeholder="e.g. 123456"
                maxLength={6}
                style={{ fontSize: '1.25rem', letterSpacing: '0.2em', textAlign: 'center', paddingLeft: '46px' }}
              />
            </div>
          </div>

          {resendMsg && (
            <div style={{ marginTop: '14px', padding: '10px 14px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#166534', fontSize: '13px', textAlign: 'center' }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i> {resendMsg}
            </div>
          )}

          {error && (
            <div className="auth3-error-box" style={{ marginTop: '16px' }}>
              <i className="fa-solid fa-circle-exclamation"></i> {error}
            </div>
          )}

          <button type="submit" className="auth3-submit-btn" disabled={loading} style={{ marginTop: '24px' }}>
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', justifyContent: 'center' }}>
                <span className="spinner-circle spinner-circle-sm"></span> Verifying Code...
              </span>
            ) : (
              'Verify Code & Sign In'
            )}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '14px', color: '#64748b' }}>
          {countdown > 0 ? (
            <span>
              Didn't receive the code? Resend in <strong style={{ color: '#263682' }}>{countdown}s</strong>
            </span>
          ) : (
            <span>
              Didn't receive the code?{' '}
              <button
                type="button"
                onClick={handleResendClick}
                disabled={resendLoading}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#263682',
                  fontWeight: '700',
                  textDecoration: 'underline',
                  cursor: resendLoading ? 'wait' : 'pointer',
                  padding: 0
                }}
              >
                {resendLoading ? 'Sending new code...' : 'Resend Code'}
              </button>
            </span>
          )}
        </div>

        <p className="auth3-switch-text" style={{ marginTop: '20px' }}>
          Wrong email or entered wrong info?{' '}
          <button type="button" className="auth3-switch-link" onClick={onCancel}>
            Back to Sign In
          </button>
        </p>
      </div>
    </div>
  );
}


function ProfileSettings({ token, profile, onRefresh, showToast }) {
  const [email, setEmail] = useState(profile.user.email || '');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profilePic, setProfilePic] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(profile.profile_pic || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Patient clinical details states
  const [weight, setWeight] = useState(profile.weight || '');
  const [height, setHeight] = useState(profile.height || '');
  const [bloodType, setBloodType] = useState(profile.blood_type || '');
  const [allergies, setAllergies] = useState(profile.allergies || '');
  const [chronicConditions, setChronicConditions] = useState(profile.chronic_conditions || '');
  const [emergencyContact, setEmergencyContact] = useState(profile.emergency_contact || '');

  // Doctor professional & signature states
  const [signatureData, setSignatureData] = useState(profile.signature_data || '');
  const [doctorRegNum, setDoctorRegNum] = useState(profile.doctor_registration_number || '');
  const [doctorQualifications, setDoctorQualifications] = useState(profile.doctor_qualifications || '');
  const [clinicAddress, setClinicAddress] = useState(profile.clinic_address || '');

  function handleFileChange(e) {
    const file = e.target.files[0];
    if (file) {
      setProfilePic(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage({ text: '', type: '' });

    if (password && password !== confirmPassword) {
      setMessage({ text: 'Passwords do not match.', type: 'error' });
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('email', email);
    if (password) {
      formData.append('password', password);
    }
    if (profilePic) {
      formData.append('profile_pic', profilePic);
    } else if (previewUrl && previewUrl.startsWith('data:image')) {
      formData.append('profile_pic', previewUrl);
    }

    if (profile.role === 'patient') {
      formData.append('weight', weight);
      formData.append('height', height);
      formData.append('blood_type', bloodType);
      formData.append('allergies', allergies);
      formData.append('chronic_conditions', chronicConditions);
      formData.append('emergency_contact', emergencyContact);
    } else if (profile.role === 'doctor') {
      formData.append('signature_data', signatureData);
      formData.append('doctor_registration_number', doctorRegNum);
      formData.append('doctor_qualifications', doctorQualifications);
      formData.append('clinic_address', clinicAddress);
    }


    try {
      await api.updateMe(token, formData);
      const msgText = 'Profile & Digital Signature updated successfully!';
      setMessage({ text: msgText, type: 'success' });
      if (showToast) {
        showToast(msgText, 'success');
      }
      setPassword('');
      setConfirmPassword('');
      if (onRefresh) await onRefresh();
    } catch (err) {
      setMessage({ text: err.message || 'Failed to update profile.', type: 'error' });
      if (showToast) {
        showToast(err.message || 'Failed to update profile.', 'error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="profile-page-container">
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ margin: 0 }}>Profile Settings</h1>
        <p style={{ color: 'var(--muted)', margin: '4px 0 0 0' }}>Manage your account credentials and personalization settings.</p>
      </header>

      {message.text && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          marginBottom: '20px',
          background: message.type === 'success' ? 'rgba(33, 178, 111, 0.08)' : 'rgba(239, 68, 68, 0.08)',
          border: `1px solid ${message.type === 'success' ? 'var(--success)' : '#ef4444'}`,
          color: message.type === 'success' ? 'var(--success)' : '#ef4444',
          fontWeight: '600',
          fontSize: '14px'
        }}>
          {message.text}
        </div>
      )}

      <div className="profile-layout-grid">
        {/* Left Column: Profile Pic Upload */}
        <div className="profile-avatar-card">
          <div style={{ position: 'relative', width: '120px', height: '120px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginBottom: '16px', border: '2.5px solid #ffaa2b' }}>
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '36px', fontWeight: 'bold', color: 'var(--muted)' }}>
                {firstInitials(profile)}
              </span>
            )}
          </div>

          <label className="mini-button" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', marginTop: '4px' }}>
            <i className="fa-solid fa-camera"></i> Upload New Photo
            <input type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
          </label>
          <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '8px' }}>JPG, PNG or GIF. Max size 2MB.</p>
        </div>

        {/* Right Column: Details & Password Form */}
        <form className="profile-form-card" onSubmit={handleSubmit}>
          {/* Read-only Information */}
          <div className="profile-info-grid">
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Username / Membership ID</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>{profile.user.username}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Full Name</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>{profile.title || profile.user.full_name}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Account Role</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)', textTransform: 'capitalize' }}>{profile.role}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Account Verification</span>
              <span style={{ fontSize: '14px', fontWeight: 'bold', color: profile.is_verified ? 'var(--success)' : 'var(--accent)' }}>
                {profile.is_verified ? '✓ Verified' : 'Pending Verification'}
              </span>
            </div>
          </div>

          {/* Editable Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text)' }}>Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid var(--border)',
                background: 'white'
              }}
            />
          </div>

          {/* Change Password */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text)' }}>Change Password</h3>
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>Leave blank if you do not want to change your password.</p>

            <div className="profile-form-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'white'
                  }}
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Confirm New Password</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    border: '1px solid var(--border)',
                    background: 'white'
                  }}
                />
              </div>
            </div>
          </div>

          {/* Clinical Profile details for Patients */}
          {profile.role === 'patient' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text)' }}>Clinical Vitals & Details</h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>These general details will be visible to doctors when you consult them.</p>

              <div className="profile-form-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Weight</label>
                  <input
                    type="text"
                    placeholder="e.g. 74 kg"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Height</label>
                  <input
                    type="text"
                    placeholder="e.g. 176 cm"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Blood Type</label>
                  <input
                    type="text"
                    placeholder="e.g. O+"
                    value={bloodType}
                    onChange={(e) => setBloodType(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Emergency Contact</label>
                  <input
                    type="text"
                    placeholder="Name - Phone"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Allergies & Contraindications</label>
                  <textarea
                    placeholder="e.g. Penicillin, Peanuts"
                    value={allergies}
                    onChange={(e) => setAllergies(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Chronic Conditions & Medical Notes</label>
                  <textarea
                    placeholder="e.g. Hypertension, Asthma"
                    value={chronicConditions}
                    onChange={(e) => setChronicConditions(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Doctor Professional Details & Signature Pad */}
          {profile.role === 'doctor' && (
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-signature" style={{ color: 'var(--primary)' }}></i>
                Prescribing Roster & Digital Signature
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: 'var(--muted)' }}>
                Configure your official prescription details and digital signature. This signature will automatically appear on issued NectaCare prescriptions.
              </p>

              <div className="profile-form-grid">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>AHFOZ / Council Registration Number</label>
                  <input
                    type="text"
                    placeholder="e.g. AHFOZ 40289"
                    value={doctorRegNum}
                    onChange={(e) => setDoctorRegNum(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Qualifications</label>
                  <input
                    type="text"
                    placeholder="e.g. MBChB, MMed (Family Med)"
                    value={doctorQualifications}
                    onChange={(e) => setDoctorQualifications(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Clinic & Practice Address</label>
                  <textarea
                    placeholder="e.g. 1016A HIGHLANDS FAMILY CLINIC, ZVISHAVANE"
                    value={clinicAddress}
                    onChange={(e) => setClinicAddress(e.target.value)}
                    rows={2}
                    style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontFamily: 'inherit', resize: 'vertical' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: '1 / -1' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Doctor Digital Signature</label>
                  <SignaturePad
                    initialSignature={signatureData}
                    onSave={(dataUrl) => setSignatureData(dataUrl)}
                  />
                </div>
              </div>
            </div>
          )}


          <button
            type="submit"
            className="cta-button"
            disabled={loading}
            style={{
              padding: '12px 20px',
              fontSize: '14px',
              fontWeight: 'bold',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              marginTop: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            {loading ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </form>
      </div>
    </div>
  );
}

export function ForcePasswordChangeScreen({ username, error, onSubmit, onCancel, loading }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setLocalError('');
    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match.');
      return;
    }
    onSubmit(oldPassword, newPassword);
  };

  return (
    <div className="auth3-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '20px', background: '#f0f4f9' }}>
      <div className="auth3-card" style={{ maxWidth: '460px', width: '100%', padding: '32px', background: 'white', borderRadius: '18px', border: '1px solid var(--border)' }}>
        <h2 className="auth3-card-title" style={{ textAlign: 'center', fontSize: '24px', margin: '0 0 12px 0' }}>Update Password Required</h2>
        <p className="auth3-card-sub" style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--muted)', fontSize: '14px' }}>
          Your system administrator requires you to change your password before accessing your dashboard.
        </p>

        <form className="auth3-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="auth3-field">
            <label style={{ fontWeight: '700', fontSize: '13px' }}>Username</label>
            <input
              disabled
              value={username}
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: '#f8fafc' }}
            />
          </div>

          <div className="auth3-field">
            <label style={{ fontWeight: '700', fontSize: '13px' }}>Current Password</label>
            <input
              type="password"
              required
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter current password"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>

          <div className="auth3-field">
            <label style={{ fontWeight: '700', fontSize: '13px' }}>New Password</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Minimum 8 characters"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>

          <div className="auth3-field">
            <label style={{ fontWeight: '700', fontSize: '13px' }}>Confirm New Password</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm new password"
              style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}
            />
          </div>

          {(error || localError) && (
            <div className="auth3-error-box" style={{ marginTop: '8px', color: '#ef4444', fontSize: '13px' }}>
              <i className="fa-solid fa-circle-exclamation"></i> {error || localError}
            </div>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
            <button type="submit" disabled={loading} className="cta-button" style={{ flex: 1, padding: '12px 20px', fontSize: '14px', fontWeight: 'bold', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
              {loading ? 'Updating...' : 'Update Password & Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordResetModal({ mode, identifier, setIdentifier, token, setToken, newPassword, setNewPassword, status, onRequest, onConfirm, onClose, onSwitchMode }) {

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.65)', backdropFilter: 'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, padding: '20px' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', maxWidth: '440px', width: '100%', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)', position: 'relative' }}>
        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '16px', border: 'none', background: '#f1f5f9', width: '32px', height: '32px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
          <i className="fa-solid fa-xmark"></i>
        </button>

        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#e0f2fe', color: '#1C75BC', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', marginBottom: '12px' }}>
            <i className="fa-solid fa-key"></i>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: '#0f172a', margin: '0 0 6px 0' }}>
            {mode === 'request' ? 'Reset Your Password' : 'Set New Password'}
          </h2>
          <p style={{ fontSize: '13px', color: '#64748b', margin: 0 }}>
            {mode === 'request'
              ? 'Enter your CellMed membership number or registered email to receive a password reset link.'
              : 'Enter your reset token and new secure password below.'}
          </p>
        </div>

        {status.error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>
            <i className="fa-solid fa-circle-exclamation"></i> {status.error}
          </div>
        )}

        {status.success && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#16a34a', padding: '12px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px', fontWeight: 500 }}>
            <i className="fa-solid fa-circle-check"></i> {status.success}
          </div>
        )}

        {mode === 'request' ? (
          <form onSubmit={onRequest}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Email or Membership Number</label>
              <input
                required
                type="text"
                placeholder="e.g. CM-12345 or patient@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={status.loading}
              style={{ width: '100%', background: '#1C75BC', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
            >
              {status.loading ? 'Sending Request...' : 'Send Reset Link'}
            </button>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => onSwitchMode('confirm')}
                style={{ background: 'none', border: 'none', color: '#1C75BC', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Already have a reset token? Click here
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={onConfirm}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>Reset Token</label>
              <input
                required
                type="text"
                placeholder="Enter reset token from email"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: '#334155', marginBottom: '6px' }}>New Password</label>
              <input
                required
                type="password"
                placeholder="Enter new strong password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', outline: 'none' }}
              />
            </div>

            <button
              type="submit"
              disabled={status.loading}
              style={{ width: '100%', background: '#1C75BC', color: '#ffffff', border: 'none', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '14px', cursor: 'pointer' }}
            >
              {status.loading ? 'Updating Password...' : 'Confirm & Update Password'}
            </button>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                type="button"
                onClick={() => onSwitchMode('request')}
                style={{ background: 'none', border: 'none', color: '#1C75BC', fontSize: '12px', fontWeight: '600', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Back to Request Reset Link
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default App;

