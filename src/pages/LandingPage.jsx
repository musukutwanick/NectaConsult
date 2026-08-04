import '../landing.css';

// ---- Icons ----
function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}
function IconVideo() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d="M23 7l-7 5 7 5V7z" />
      <rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  );
}
function IconPill() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d="M10.5 20H4a2 2 0 0 1-2-2V5c0-1.1.9-2 2-2h3.93a2 2 0 0 1 1.66.9l.82 1.2a2 2 0 0 0 1.66.9H20a2 2 0 0 1 2 2v3" />
      <circle cx="18" cy="18" r="3" />
      <path d="m20.2 15.8-4.4 4.4" />
    </svg>
  );
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
function IconChat() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
function IconClipboard() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" />
    </svg>
  );
}
function IconFile() {
  return (
    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" stroke="currentColor">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  );
}

const features = [
  { icon: <IconVideo />, title: 'Online Doctor Consultations', desc: 'Face-to-face video visits with licensed professionals from the comfort of home.' },
  { icon: <IconCalendar />, title: 'Appointment Booking', desc: 'Find the right specialist and reserve a slot in seconds, 24 hours a day.' },
  { icon: <IconShield />, title: 'Secure Medical Records', desc: 'Your full history, lab results and notes encrypted and always within reach.' },
  { icon: <IconPill />, title: 'Digital Prescriptions', desc: 'Receive e-prescriptions instantly and collect medication at your pharmacy.' },
  { icon: <IconClock />, title: 'Medical Aid Verification', desc: "Instant CellMed membership verification so you always know what's covered." },
  { icon: <IconChat />, title: 'Real-Time Messaging', desc: 'Securely chat with your care team for follow-ups and quick questions.' },
];

const steps = [
  { num: 1, icon: <IconUser />, title: 'Register Account', desc: 'Create your free NectaConsult profile in under two minutes.' },
  { num: 2, icon: <IconClipboard />, title: 'Verify Medical Aid', desc: 'Confirm your CellMed membership for seamless, covered care.' },
  { num: 3, icon: <IconCalendar />, title: 'Book Appointment', desc: 'Choose a doctor and a time that fits your schedule.' },
  { num: 4, icon: <IconVideo />, title: 'Consult Doctor Online', desc: 'Join a secure chat room and discuss your health concerns.' },
  { num: 5, icon: <IconFile />, title: 'Receive Prescription', desc: 'Get your digital prescription and follow-up plan instantly.' },
];

export default function LandingPage({ onGetStarted, onLogin }) {
  return (
    <div className="lp-root">

      {/* ===== NAVBAR ===== */}
      <header className="lp-nav">
        <div className="lp-nav-inner">
          <div className="lp-brand">
            <img src="/nectacare-logo.png" alt="NectaCare" className="lp-logo" />
          </div>
          <nav className="lp-links">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#about">About</a>
          </nav>
          <div className="lp-nav-actions" style={{ marginTop: '4px' }}>
            <button className="lp-nav-login" onClick={onLogin} style={{ padding: '9px 18px' }}>Log in</button>
            <button className="lp-nav-signup" onClick={onGetStarted}>Sign up</button>
          </div>
        </div>
      </header>

      {/* ===== HERO ===== */}
      <section className="lp-hero">
        <div className="lp-hero-inner">

          {/* Left: Copy */}
          <div className="lp-hero-copy">
            <h1 className="lp-hero-title">
              Healthcare Consultation<br />
              <span className="lp-hero-blue">Anytime, Anywhere</span>
            </h1>
            <p className="lp-hero-desc">
              Connect with licensed doctors online in minutes. NectaConsult
              makes quality care simple, secure and fully covered for CellMed
              medical aid members.
            </p>
            <div className="lp-hero-btns">
              <button className="lp-btn-book" onClick={onGetStarted}>
                Book Consultation <IconArrow />
              </button>
              <button className="lp-btn-find" onClick={onLogin}>
                <IconSearch /> Find a Doctor
              </button>
            </div>
            <div className="lp-stats-row">
              <div className="lp-stat-item">
                <strong>120+</strong>
                <span>Verified doctors</span>
              </div>
              <div className="lp-stat-item">
                <strong>50k+</strong>
                <span>Consultations</span>
              </div>
              <div className="lp-stat-item">
                <strong>4.9</strong>
                <span>Average rating</span>
              </div>
            </div>
          </div>

          {/* Right: Illustration */}
          <div className="lp-hero-image-wrap">
            <div className="lp-hero-image-bg">
              <img
                src="/hero-mockup.png"
                alt="Doctor video consultation app mockup"
                className="lp-hero-img"
              />
            </div>
          </div>

        </div>
      </section>

      {/* ===== FEATURES ===== */}
      <section className="lp-features" id="features">
        <div className="lp-section-inner">
          <p className="lp-section-eyebrow">WHAT WE OFFER</p>
          <h2 className="lp-section-title">Everything you need for online care</h2>
          <p className="lp-section-sub">
            A complete telemedicine platform <strong>built</strong> around your health and your medical aid.
          </p>
          <div className="lp-features-grid">
            {features.map((f) => (
              <div key={f.title} className="lp-feature-card">
                <div className="lp-feature-icon">{f.icon}</div>
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="lp-how" id="how-it-works">
        <div className="lp-section-inner">
          <p className="lp-section-eyebrow">HOW IT WORKS</p>
          <h2 className="lp-section-title">Care in five simple steps</h2>
          <p className="lp-section-sub">
            From sign-up to prescription, NectaConsult keeps everything fast and effortless.
          </p>
          <div className="lp-steps-grid">
            {steps.map((s, idx) => (
              <div key={s.num} className="lp-step-card">
                <div className="lp-step-icon">{s.icon}</div>
                <p className="lp-step-label">STEP {s.num}</p>
                <h3 className="lp-step-title">{s.title}</h3>
                <p className="lp-step-desc">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== CTA ===== */}
      <section className="lp-cta" id="about">
        <div className="lp-section-inner">
          <div className="lp-cta-box">
            <div className="lp-cta-ecg" />
            <h2 className="lp-cta-title">Ready to see a doctor today?</h2>
            <p className="lp-cta-sub">
              Join NectaConsult and get covered, convenient consultations from anywhere. Your CellMed
              membership unlocks instant access.
            </p>
            <div className="lp-cta-btns">
              <button className="lp-cta-btn-accent" onClick={onGetStarted}>Create free account</button>
              <button className="lp-cta-btn-ghost" onClick={onLogin}>Talk to us</button>
            </div>
          </div>
        </div>
      </section>

      {/* ===== CONFIDENTIALITY BANNER ===== */}
      <div style={{ padding: '0 32px', marginBottom: '40px' }}>
        <div style={{
          background: 'rgba(26, 128, 199, 0.04)',
          border: '1px solid rgba(26, 128, 199, 0.14)',
          borderRadius: '18px',
          padding: '18px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          maxWidth: '1200px',
          margin: '0 auto'
        }}>
          <div style={{
            width: '42px', height: '42px', borderRadius: '50%',
            background: 'rgba(26, 128, 199, 0.1)', color: '#1a80c7',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0
          }}>
            <IconShield />
          </div>
          <div style={{ flex: 1 }}>
            <strong style={{ display: 'block', fontSize: '14.5px', color: '#12213d', fontWeight: '700' }}>
              Patient data is private and confidential.
            </strong>
            <span style={{ fontSize: '12.5px', color: '#64748b' }}>
              Access is logged and monitored for security and compliance.
            </span>
          </div>
        </div>
      </div>

      {/* ===== BOTTOM CURVED WAVE GRAPHIC BANNER ===== */}
      <div style={{ width: '100%', marginTop: '24px', position: 'relative', overflow: 'hidden', lineHeight: 0 }}>
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

      {/* ===== FOOTER ===== */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-brand">
            <img src="/nectacare-logo.png" alt="NectaCare" className="lp-logo" />
            <span className="lp-footer-name">NectaConsult &mdash; Powered by CellMed</span>
          </div>
          <p className="lp-footer-copy">© {new Date().getFullYear()} NectaConsult. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
