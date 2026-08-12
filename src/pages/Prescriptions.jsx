import { useState, useEffect } from 'react';
import { api } from '../api';
import NectaCarePrescriptionTemplate from '../components/NectaCarePrescriptionTemplate';
import SignaturePad from '../components/SignaturePad';

export default function Prescriptions({ token, role, onRefreshDashboard }) {
  const [prescriptions, setPrescriptions] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Doctor form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [title, setTitle] = useState('Prescription');
  const [drugs, setDrugs] = useState([
    { name: '', dosage: '', instructions: '' }
  ]);
  const [doctorRegNum, setDoctorRegNum] = useState('');
  const [doctorQualifications, setDoctorQualifications] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [doctorSignature, setDoctorSignature] = useState('');

  // Selected prescription for template modal
  const [activePrintPrescription, setActivePrintPrescription] = useState(null);

  useEffect(() => {
    loadPrescriptions();
    if (role === 'doctor') {
      loadPatients();
      loadDoctorProfile();
    }
  }, []);

  async function loadPrescriptions() {
    setLoading(true);
    setError('');
    try {
      const data = await api.getPrescriptions(token);
      setPrescriptions(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadPatients() {
    try {
      const data = await api.getPatients(token);
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patients', err);
    }
  }

  async function loadDoctorProfile() {
    try {
      const data = await api.getMe(token);
      const prof = data.user || data;
      setDoctorRegNum(prof.doctor_registration_number || 'AHFOZ 40289');
      setDoctorQualifications(prof.doctor_qualifications || 'MBChB, MMed (Family Med)');
      setClinicAddress(prof.clinic_address || '1016A HIGHLANDS FAMILY CLINIC, ZVISHAVANE');
      setDoctorSignature(prof.signature_data || '');
    } catch (err) {
      console.error('Failed to load doctor profile', err);
    }
  }

  const selectedPatientObj = patients.find(p => p.id === parseInt(selectedPatientId, 10));

  function handleAddDrug() {
    if (drugs.length >= 5) {
      alert('Maximum of 5 items per prescription script as per regulations.');
      return;
    }
    setDrugs([...drugs, { name: '', dosage: '', instructions: '' }]);
  }

  function handleRemoveDrug(index) {
    if (drugs.length === 1) return;
    setDrugs(drugs.filter((_, i) => i !== index));
  }

  function handleDrugChange(index, field, value) {
    const updated = [...drugs];
    updated[index][field] = value;
    setDrugs(updated);
  }

  async function handleCreateSubmit(e) {
    e.preventDefault();
    setError('');

    if (!selectedPatientId) {
      setError('Please select a patient.');
      return;
    }

    const validDrugs = drugs.filter(d => d.name.trim().length > 0);
    if (validDrugs.length === 0) {
      setError('Please prescribe at least one drug.');
      return;
    }

    const payload = {
      patient_id: selectedPatientId,
      title: title || 'Prescription',
      medication: validDrugs[0].name,
      dosage: validDrugs[0].dosage,
      renewal_note: validDrugs[0].instructions,
      drugs_json: JSON.stringify(validDrugs),
      patient_address: selectedPatientObj?.address || '',
      patient_age: selectedPatientObj?.date_of_birth ? getAge(selectedPatientObj.date_of_birth) : '',
      doctor_registration_number: doctorRegNum,
      doctor_qualifications: doctorQualifications,
      doctor_address: clinicAddress,
      doctor_signature: doctorSignature
    };

    try {
      await api.createPrescription(token, payload);
      setShowCreateModal(false);
      setDrugs([{ name: '', dosage: '', instructions: '' }]);
      setSelectedPatientId('');
      await loadPrescriptions();
      if (onRefreshDashboard) onRefreshDashboard();
    } catch (err) {
      setError(err.message);
    }
  }

  function getAge(dobStr) {
    try {
      const dob = new Date(dobStr);
      const diffMs = Date.now() - dob.getTime();
      const ageDate = new Date(diffMs);
      return Math.abs(ageDate.getUTCFullYear() - 1970).toString();
    } catch (e) {
      return '';
    }
  }

  return (
    <div className="prescriptions-page-container" style={{ padding: '24px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Electronic Prescriptions</h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0 0' }}>
            {role === 'doctor' ? 'Create, digitally sign and issue official NectaCare prescriptions.' : 'View, print and download your official NectaCare prescriptions.'}
          </p>
        </div>
        {role === 'doctor' && (
          <button type="button" className="cta-button" onClick={() => setShowCreateModal(true)}>
            <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i>
            Issue Prescription
          </button>
        )}
      </div>

      {error && <p className="form-message form-error" style={{ marginBottom: '16px' }}>{error}</p>}

      {loading ? (
        <p>Loading prescriptions...</p>
      ) : (
        <div className="prescriptions-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '20px' }}>
          {prescriptions.length === 0 ? (
            <p style={{ color: 'var(--muted)', gridColumn: '1 / -1' }}>No prescriptions issued.</p>
          ) : (
            prescriptions.map((p) => (
              <article key={p.id} className="panel prescription-card-full" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '16px' }}>{p.title || 'NectaCare Prescription'}</h3>
                    <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                      Rx #{p.id} • {p.created_at ? new Date(p.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}
                    </span>
                  </div>
                </div>

                <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <strong style={{ display: 'block', fontSize: '15px', color: 'var(--text)' }}>
                    {p.medication}
                  </strong>
                  {p.patient_name && (
                    <span style={{ fontSize: '12px', color: 'var(--muted)', display: 'block', marginTop: '4px' }}>
                      Patient: <strong>{p.patient_name}</strong>
                    </span>
                  )}
                </div>

                <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--border)', display: 'flex', gap: '8px' }}>
                  <button type="button" className="cta-button compact" onClick={() => setActivePrintPrescription(p)}>
                    <i className="fa-solid fa-file-prescription" style={{ marginRight: '6px' }}></i>
                    View Official Script
                  </button>
                </div>
              </article>
            ))
          )}
        </div>
      )}

      {/* Create Official Prescription Modal */}
      {showCreateModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, overflowY: 'auto', padding: '24px'
        }}>
          <div className="panel" style={{ width: '680px', maxHeight: '90vh', overflowY: 'auto', padding: '28px', background: 'white' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-file-prescription" style={{ color: '#1a80c7' }}></i>
                Issue Official NectaCare Prescription Script
              </h2>
              <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: 'var(--muted)' }}>✕</button>
            </div>

            <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Select Patient */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 'bold' }}>Select Patient *</label>
                <select
                  required
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white', fontSize: '14px' }}
                >
                  <option value="">-- Choose Patient Roster --</option>
                  {patients.map(pat => (
                    <option key={pat.id} value={pat.id}>
                      {pat.title || pat.user.full_name} ({pat.medical_aid_number || 'No Aid ID'}) - {pat.address || 'Address on file'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Patient details preview */}
              {selectedPatientObj && (
                <div style={{ background: 'rgba(26, 128, 199, 0.05)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12.5px' }}>
                  <div>
                    <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', fontWeight: 'bold' }}>PATIENT NAME</span>
                    <strong>{selectedPatientObj.title}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', fontWeight: 'bold' }}>MEMBERSHIP NUMBER</span>
                    <strong>{selectedPatientObj.medical_aid_number}</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={{ color: 'var(--muted)', display: 'block', fontSize: '11px', fontWeight: 'bold' }}>PATIENT ADDRESS</span>
                    <span>{selectedPatientObj.address || 'Highlands Family Clinic Roster Address'}</span>
                  </div>
                </div>
              )}

              {/* Drugs Prescribed List (Max 5) */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 'bold', color: '#1e40af' }}>
                    DRUGS PRESCRIBED (Max 5 items per script)
                  </label>
                  {drugs.length < 5 && (
                    <button
                      type="button"
                      onClick={handleAddDrug}
                      style={{ background: 'none', border: '1px solid #1a80c7', color: '#1a80c7', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      + Add Item
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {drugs.map((drug, idx) => (
                    <div key={idx} style={{ background: '#f8fafc', padding: '14px', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--primary)' }}>Item #{idx + 1}</span>
                        {drugs.length > 1 && (
                          <button type="button" onClick={() => handleRemoveDrug(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>Remove</button>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <input
                          required
                          placeholder="Drug Name & Strength (e.g. Paracetamol 500mg)"
                          value={drug.name}
                          onChange={(e) => handleDrugChange(idx, 'name', e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                        />
                        <input
                          placeholder="Dosage & Frequency (e.g. 1 tab tid po x 5 days)"
                          value={drug.dosage}
                          onChange={(e) => handleDrugChange(idx, 'dosage', e.target.value)}
                          style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                        />
                      </div>
                      <input
                        placeholder="Instructions (e.g. Take after meals. Drink plenty of water.)"
                        value={drug.instructions}
                        onChange={(e) => handleDrugChange(idx, 'instructions', e.target.value)}
                        style={{ padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Doctor Registration & Digital Signature Section */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <label style={{ fontSize: '13px', fontWeight: 'bold', color: 'var(--text)' }}>
                  Prescribing Doctor Digital Signature & Credentials
                </label>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold' }}>DOCTOR REGISTRATION NUMBER</label>
                    <input
                      value={doctorRegNum}
                      onChange={(e) => setDoctorRegNum(e.target.value)}
                      placeholder="e.g. AHFOZ 40289"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold' }}>QUALIFICATIONS</label>
                    <input
                      value={doctorQualifications}
                      onChange={(e) => setDoctorQualifications(e.target.value)}
                      placeholder="e.g. MBChB, MMed"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold' }}>DIGITAL SIGNATURE PAD</label>
                  <SignaturePad
                    initialSignature={doctorSignature}
                    onSave={(dataUrl) => setDoctorSignature(dataUrl)}
                    height={130}
                  />
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="cta-button" style={{ flex: 1 }}>
                  Issue Official NectaCare Prescription
                </button>
                <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Prescription Printable Overlay Modal */}
      {activePrintPrescription && (
        <NectaCarePrescriptionTemplate
          prescription={activePrintPrescription}
          onClose={() => setActivePrintPrescription(null)}
        />
      )}
    </div>
  );
}
