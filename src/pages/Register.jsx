import { useState, useEffect } from 'react';
import { api } from '../api';

export default function Register({ onBackToLogin, onRegisterSuccess }) {
  const [form, setForm] = useState(() => {
    try {
      const saved = window.localStorage.getItem('nectaconsult-register-form');
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      password: '',
      confirmPassword: '',
      email: '',
      medical_aid_number: '',
      first_name: '',
      last_name: '',
      date_of_birth: '',
      phone: '',
      address: '',
    };
  });

  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [foundMember, setFoundMember] = useState(() => {
    return window.localStorage.getItem('nectaconsult-register-found') === 'true';
  });

  useEffect(() => {
    try {
      window.localStorage.setItem('nectaconsult-register-form', JSON.stringify(form));
    } catch {}
  }, [form]);

  useEffect(() => {
    if (foundMember) {
      window.localStorage.setItem('nectaconsult-register-found', 'true');
    } else {
      window.localStorage.removeItem('nectaconsult-register-found');
    }
  }, [foundMember]);

  const clearRegisterStorage = () => {
    window.localStorage.removeItem('nectaconsult-register-form');
    window.localStorage.removeItem('nectaconsult-register-found');
    window.localStorage.removeItem('nectaconsult-is-registering');
  };

  const handleBackToLogin = () => {
    clearRegisterStorage();
    onBackToLogin();
  };

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);

  const passwordsMatch = form.password && form.confirmPassword && form.password === form.confirmPassword;
  const passwordsMismatch = form.confirmPassword && form.password !== form.confirmPassword;

  async function handleLookup(e) {
    if (e) e.preventDefault();
    setError('');
    setSuccessMsg('');
    if (!form.medical_aid_number) {
      setError('Please enter your membership number.');
      return;
    }

    setSearching(true);
    try {
      const details = await api.lookupMember(form.medical_aid_number);
      setForm((prev) => ({
        ...prev,
        first_name: details.first_name || '',
        last_name: details.last_name || '',
        date_of_birth: details.date_of_birth || '',
        phone: details.phone || '',
        address: details.address || '',
        email: details.email || '',
      }));
      setFoundMember(true);
      setSuccessMsg('Membership verified! Please enter your email and set a password.');
    } catch (requestError) {
      setError(requestError.message || 'Membership number not found. Please try again.');
      setFoundMember(false);
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!form.email || !form.password || !form.confirmPassword) {
      setError('Email and password fields are required.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match. Please try again.');
      return;
    }
    if (!agreePrivacy) {
      setError('You must agree to the Privacy Policy before registering.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.register({
        medical_aid_number: form.medical_aid_number,
        password: form.password,
        email: form.email,
      });
      clearRegisterStorage();
      setSuccessMsg('Registration successful! Redirecting to login page to sign in...');
      setTimeout(() => {
        handleBackToLogin();
      }, 2500);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth2-root">
      {/* ── LEFT PANEL ── */}
      <div className="auth2-left">
        <div className="auth2-left-inner">
          <div className="auth2-brand">
            <img src="/nectacare-logo.png" alt="NectaCare" className="auth2-logo" />
            <div>
              <strong>NectaConsult</strong>
            </div>
          </div>
          <h1 className="auth2-left-title">Join thousands of members getting care online.</h1>
          <p className="auth2-left-sub">
            Create your account in under 2 minutes. Your CellMed membership covers all consultations.
          </p>
        </div>
      </div>

      {/* ── RIGHT PANEL ── */}
      <div className="auth2-right">
        <div className="auth2-form-wrap auth2-form-wrap--register">
          <div className="auth2-form-header">
            <h2>Register For NectaConsult</h2>
            <p>
              {!foundMember
                ? 'Enter your CellMed membership number to retrieve your details.'
                : 'Confirm your profile details and set your password.'}
            </p>
          </div>

          {!foundMember ? (
            <form className="auth2-form" onSubmit={handleLookup}>
              <div className="auth2-field">
                <label htmlFor="reg-cellmed">CellMed Membership Number <span className="auth2-req">*</span></label>
                <div className="auth2-input-wrap">
                  <svg className="auth2-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                  <input
                    id="reg-cellmed"
                    required
                    value={form.medical_aid_number}
                    onChange={(e) => setForm({ ...form, medical_aid_number: e.target.value })}
                    placeholder="Enter your membership number"
                  />
                </div>
              </div>

              {error && (
                <div className="auth2-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button type="submit" className="auth2-submit" disabled={searching}>
                <span>{searching ? 'Verifying...' : 'Verify & Retrieve Details'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>
            </form>
          ) : (
            <form className="auth2-form" onSubmit={handleSubmit}>

              {/* ── MEMBER PROFILE CARD ── */}
              <div className="member-profile-card">
                <div className="member-profile-card__header">
                  <span className="member-profile-card__number">{form.medical_aid_number.toUpperCase()}</span>
                </div>

                <div className="member-profile-card__body">
                  <div className="member-info-row">
                    <div className="member-info-item">
                      <span className="member-info-item__label">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        First Name
                      </span>
                      <span className="member-info-item__value">{form.first_name}</span>
                    </div>
                    <div className="member-info-item">
                      <span className="member-info-item__label">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                        Last Name
                      </span>
                      <span className="member-info-item__value">{form.last_name}</span>
                    </div>
                  </div>

                  <div className="member-info-row">
                    <div className="member-info-item">
                      <span className="member-info-item__label">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                        Date of Birth
                      </span>
                      <span className="member-info-item__value">{form.date_of_birth}</span>
                    </div>
                    <div className="member-info-item">
                      <span className="member-info-item__label">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.71 3.41 2 2 0 0 1 3.68 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.06 6.06l1.07-1.07a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        Phone Number
                      </span>
                      <span className="member-info-item__value">{form.phone}</span>
                    </div>
                  </div>

                  <div className="member-info-item member-info-item--full">
                    <span className="member-info-item__label">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                      Physical Address
                    </span>
                    <span className="member-info-item__value">{form.address}</span>
                  </div>
                </div>
              </div>

              {/* Editable email */}
              <div className="auth2-field">
                <label htmlFor="reg-email">
                  Email Address <span className="auth2-req">*</span>
                  <small style={{ fontWeight: 'normal', color: 'var(--muted)', marginLeft: '6px' }}>You will receive a verification code here</small>
                </label>
                <div className="auth2-input-wrap">
                  <svg className="auth2-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                  <input
                    id="reg-email"
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="your.email@example.com"
                  />
                </div>
              </div>

              {/* Password */}
              <div className="auth2-field">
                <label htmlFor="reg-password">Password <span className="auth2-req">*</span></label>
                <div className="auth2-input-wrap">
                  <svg className="auth2-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input
                    id="reg-password"
                    type={showPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="Choose a strong password"
                  />
                  <button type="button" className="auth2-pw-toggle" onClick={() => setShowPw((v) => !v)} aria-label="Toggle password">
                    {showPw
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="auth2-field">
                <label htmlFor="reg-confirm-password">Confirm Password <span className="auth2-req">*</span></label>
                <div className="auth2-input-wrap">
                  <svg className="auth2-input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <input
                    id="reg-confirm-password"
                    type={showConfirmPw ? 'text' : 'password'}
                    required
                    autoComplete="new-password"
                    value={form.confirmPassword}
                    onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
                    placeholder="Re-enter your password"
                  />
                  <button type="button" className="auth2-pw-toggle" onClick={() => setShowConfirmPw((v) => !v)} aria-label="Toggle confirm password">
                    {showConfirmPw
                      ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              {/* Privacy Policy Checkbox */}
              <div style={{ marginTop: '12px', marginBottom: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#475569', fontWeight: '500', lineHeight: '1.4' }}>
                  <input
                    type="checkbox"
                    required
                    checked={agreePrivacy}
                    onChange={(e) => setAgreePrivacy(e.target.checked)}
                    style={{ width: '18px', height: '18px', marginTop: '2px', accentColor: '#1a80c7', cursor: 'pointer', flexShrink: 0 }}
                  />
                  <span>
                    By registering, you agree to our{' '}
                    <a
                      href="https://cellgroup.co.zw/legal/privacy-policy/"
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#1a80c7', fontWeight: 'bold', textDecoration: 'underline' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      Privacy Policy
                    </a>
                    .
                  </span>
                </label>
              </div>

              {error && (
                <div className="auth2-error">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button type="submit" className="auth2-submit" disabled={loading || passwordsMismatch}>
                <span>{loading ? 'Creating Account...' : 'Verify & Create Account'}</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
              </button>

            </form>
          )}

          <p className="auth2-switch">
            Already have an account?{' '}
            <button type="button" className="auth2-switch-btn" onClick={handleBackToLogin}>
              Sign in
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
