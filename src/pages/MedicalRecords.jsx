import { useState, useEffect, useRef } from 'react';
import { api } from '../api';
import CameraModal from '../components/CameraModal';
import NectaCarePrescriptionTemplate from '../components/NectaCarePrescriptionTemplate';


function avatarFromName(name) {
  if (!name) return 'NC';
  return name.split(' ').filter(Boolean).slice(0, 2).map(n => n[0]).join('').toUpperCase();
}

function getConsultationCategory(reason) {
  const r = (reason || '').toLowerCase();
  if (r.includes('blood') || r.includes('lab') || r.includes('test') || r.includes('urine')) {
    return { label: 'LAB RESULT', icon: 'fa-solid fa-flask' };
  }
  if (r.includes('x-ray') || r.includes('mri') || r.includes('imaging') || r.includes('scan') || r.includes('chest')) {
    return { label: 'IMAGING', icon: 'fa-solid fa-camera' };
  }
  if (r.includes('vaccin') || r.includes('flu') || r.includes('immun') || r.includes('shot')) {
    return { label: 'IMMUNIZATION', icon: 'fa-solid fa-syringe' };
  }
  return { label: 'VISIT', icon: 'fa-solid fa-file-medical' };
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

function downloadConsultationPDF(appt, messages, includeMedia = false) {
  const printWindow = window.open('', '_blank');
  const rxMessages = messages.filter(m => m.body.startsWith('[PRESCRIPTION]'));
  const normalMessages = messages.filter(m => !m.body.startsWith('[PRESCRIPTION]'));

  const html = `
    <html>
      <head>
        <title>Consultation Record - ${appt.doctor_name}</title>
        <style>
          body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #12213d; padding: 40px; line-height: 1.6; }
          .header { border-bottom: 2px solid #1a80c7; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: flex-end; }
          .header h1 { margin: 0; color: #1a80c7; font-size: 26px; }
          .header p { margin: 5px 0 0 0; color: #6b7891; }
          .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
          .meta-item { background: #f4f7fb; padding: 15px; border-radius: 12px; border: 1px solid rgba(29,44,72,0.06); }
          .meta-item span { font-size: 11px; color: #6b7891; display: block; margin-bottom: 4px; text-transform: uppercase; font-weight: bold; letter-spacing: 0.05em; }
          .meta-item strong { font-size: 15px; }
          .section { margin-bottom: 30px; }
          .section h2 { border-bottom: 1px solid rgba(29,44,72,0.08); padding-bottom: 8px; color: #12213d; font-size: 18px; margin-bottom: 15px; }
          .message-row { margin-bottom: 12px; padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid rgba(29,44,72,0.03); }
          .message-sender { font-weight: bold; font-size: 12px; color: #1a80c7; margin-bottom: 4px; }
          .rx-box { border: 1.5px dashed #21b26f; background: rgba(33,178,111,0.04); padding: 15px; border-radius: 10px; margin-bottom: 15px; }
          .rx-title { font-weight: bold; color: #21b26f; display: flex; align-items: center; gap: 8px; font-size: 14px; letter-spacing: 0.05em; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h1>NectaConsult Consultation Record</h1>
            <p>Official Medical Visit Summary Transcript</p>
          </div>
          <div style="text-align: right; color: #6b7891; font-size: 12px;">
            Document Ref: NC-REC-${appt.id}
          </div>
        </div>
        
        <div class="meta-grid">
          <div class="meta-item">
            <span>Consulting Doctor</span>
            <strong>${appt.doctor_name}</strong>
          </div>
          <div class="meta-item">
            <span>Date & Time slot</span>
            <strong>${appt.date || 'TBD'} (${appt.time_label || 'TBD'}${appt.timezone ? ` ${appt.timezone}` : ''})</strong>
          </div>
          <div class="meta-item" style="grid-column: 1 / -1;">
            <span>Consultation Type</span>
            <strong>Medical Consultation</strong>
          </div>
        </div>

        ${rxMessages.length > 0 ? `
          <div class="section">
            <h2>Issued Prescriptions</h2>
            ${rxMessages.map(m => {
              const parts = m.body.replace('[PRESCRIPTION] ', '').split('|');
              return `
                <div class="rx-box">
                  <div class="rx-title">℞ DIGITAL PRESCRIPTION SHEET</div>
                  <p style="margin: 8px 0 4px 0; font-size: 14px;"><strong>Medication:</strong> ${parts[0]}</p>
                  <p style="margin: 0 0 4px 0; font-size: 14px;"><strong>Dosage:</strong> ${parts[1]}</p>
                  <p style="margin: 0; font-size: 14px; color: #555;"><strong>Instructions:</strong> ${parts[2] || 'No additional remarks'}</p>
                </div>
              `;
            }).join('')}
          </div>
        ` : ''}

        <div class="section">
          <h2>Secure Communication logs</h2>
          ${normalMessages.length === 0 ? '<p style="color: #6b7891; font-style: italic;">No text messages exchanged.</p>' : normalMessages.map(m => {
            const isVoice = m.body.startsWith('[AUDIO]') || m.body.startsWith('[Voice Message]:');
            const isImage = m.body.startsWith('[IMAGE]');
            let bodyText = m.body;
            if (m.body.startsWith('[Voice Message]:')) {
              const parts = m.body.split(':');
              bodyText = `🎙️ Audio Voice Note (${parts[1]}s)`;
            } else if (m.body.startsWith('[AUDIO]')) {
              bodyText = '🎙️ Audio Voice Note';
            } else if (isImage) {
              const src = m.body.replace('[IMAGE] ', '').trim();
              if (includeMedia) {
                bodyText = `<div style="margin-top: 8px;"><img src="${src}" style="max-width: 250px; max-height: 180px; border-radius: 8px; border: 1px solid #cbd5e1;" /></div>`;
              } else {
                bodyText = `📷 Image Attachment (Excluded from PDF)`;
              }
            }
            return `
              <div class="message-row">
                <div class="message-sender">${m.sender_name} (${m.sender_role.toUpperCase()})</div>
                <div style="font-size: 13px;">${bodyText}</div>
              </div>
            `;
          }).join('')}
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
}

export default function MedicalRecords({ token, role, appointments = [], onStartCall }) {
  const [records, setRecords] = useState([]);
  const [patients, setPatients] = useState([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Upload form states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    patient_id: '',
    record_type: 'Laboratory Result',
    file_name: '',
  });

  // Chat thread states for patients
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [activeThread, setActiveThread] = useState({ thread_id: null, messages: [] });
  const [loadingThread, setLoadingThread] = useState(false);
  const [chatDraft, setChatDraft] = useState('');
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);
  const [activeViewPrescription, setActiveViewPrescription] = useState(null);

  // Doctor clinical workspace states
  const [allAppointments, setAllAppointments] = useState([]);
  const [allPrescriptions, setAllPrescriptions] = useState([]);
  const [patientSearch, setPatientSearch] = useState('');
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState('general'); // 'general' or 'visits'
  const [isEditingVitals, setIsEditingVitals] = useState(false);
  const [vitalsForm, setVitalsForm] = useState({
    weight: '',
    height: '',
    blood_type: '',
    allergies: '',
    chronic_conditions: '',
    emergency_contact: '',
  });

  useEffect(() => {
    if (role === 'patient') {
      loadRecords();
    } else {
      loadDoctorWorkspace();
    }
  }, []);

  async function loadRecords(patientId = '') {
    setLoading(true);
    setError('');
    try {
      const data = await api.getRecords(token, patientId);
      setRecords(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadDoctorWorkspace() {
    setLoading(true);
    try {
      const patientList = await api.getPatients(token);
      setPatients(patientList);

      if (patientList.length > 0) {
        const defaultId = patientList[0].id.toString();
        setSelectedPatientId(defaultId);
        loadRecords(defaultId);

        // Fetch selected patient's specific appointments and prescriptions
        const apptList = await api.getAppointments(token, defaultId);
        setAllAppointments(apptList);

        const rxList = await api.getPrescriptions(token, defaultId);
        setAllPrescriptions(rxList);
      }
    } catch (err) {
      setError(err.message || 'Failed to load doctor workspace details.');
    } finally {
      setLoading(false);
    }
  }

  async function loadThreadForDoctor(targetAppt) {
    if (!targetAppt) return;
    setLoadingThread(true);
    try {
      let data;
      if (role === 'doctor') {
        const pId = targetAppt.patient_id || selectedPatientId;
        data = await api.getPatientThread(token, pId);
      } else {
        data = await api.thread(token, targetAppt.doctor_id);
      }
      setActiveThread({
        thread_id: data.thread_id,
        messages: data.messages || []
      });
    } catch (err) {
      console.error("Failed to load chat thread", err);
    } finally {
      setLoadingThread(false);
    }
  }

  useEffect(() => {
    if (!selectedAppt) return;

    loadThreadForDoctor(selectedAppt);

    const pollInterval = setInterval(() => {
      loadThreadForDoctor(selectedAppt);
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [selectedAppt]);

  const selectedPatient = patients.find(p => p.id.toString() === selectedPatientId);

  async function sendChatMessage(event, customBody) {
    if (event) event.preventDefault();
    const messageText = customBody || chatDraft.trim();
    if (!messageText || !activeThread.thread_id) {
      return;
    }

    setError('');
    try {
      await api.sendMessage(token, activeThread.thread_id, messageText);
      if (!customBody) setChatDraft('');
      if (selectedAppt) {
        await loadThreadForDoctor(selectedAppt.doctor_id);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handlePatientChange(patientId) {
    setSelectedPatientId(patientId);
    if (patientId) {
      loadRecords(patientId);
      try {
        const appts = await api.getAppointments(token, patientId);
        setAllAppointments(appts);
        const prescriptions = await api.getPrescriptions(token, patientId);
        setAllPrescriptions(prescriptions);
      } catch (err) {
        console.error("Failed to load patient's appointments or prescriptions", err);
      }
    } else {
      setRecords([]);
      setAllAppointments([]);
      setAllPrescriptions([]);
    }
  }

  async function handleUploadSubmit(e) {
    e.preventDefault();
    setError('');

    if (!uploadForm.file_name) {
      setError('Please provide a file description name.');
      return;
    }

    const payload = {
      patient_id: role === 'patient' ? '' : selectedPatientId,
      record_type: uploadForm.record_type,
      file_name: uploadForm.file_name,
    };

    try {
      await api.uploadRecord(token, payload);
      setShowUploadModal(false);
      setUploadForm({ patient_id: '', record_type: 'Laboratory Result', file_name: '' });
      
      const targetId = role === 'patient' ? '' : selectedPatientId;
      await loadRecords(targetId);
    } catch (err) {
      setError(err.message);
    }
  }

  function handleDownloadPDF(e, appt) {
    e.stopPropagation();
    api.thread(token, appt.doctor_id).then(data => {
      const messages = data.messages || [];
      const includeMedia = window.confirm("Would you like to also download audios and media attachments from this chat?");
      if (includeMedia) {
        messages.forEach((m, index) => {
          if (m.body.startsWith('[IMAGE]')) {
            const base64Data = m.body.replace('[IMAGE] ', '').trim();
            const extension = base64Data.split(';')[0].split('/')[1] || 'png';
            const link = document.createElement('a');
            link.href = base64Data;
            link.download = `Chat_Image_${index + 1}.${extension}`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          } else if (m.body.startsWith('[AUDIO]')) {
            // Create a simulated tiny WAV file
            const dummyWav = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6d, 0x74, 0x20])], { type: 'audio/wav' });
            const url = URL.createObjectURL(dummyWav);
            const link = document.createElement('a');
            link.href = url;
            const durationMatch = m.body.match(/\d+s/) || ['note'];
            link.download = `Voice_Note_${durationMatch[0]}.wav`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
          }
        });
      }
      downloadConsultationPDF(appt, messages, includeMedia);
    }).catch(err => {
      console.error("Failed to load thread for PDF generation", err);
      downloadConsultationPDF(appt, [], false);
    });
  }

  function handleOpenDetails(appt) {
    if (onStartCall && appt) {
      onStartCall(appt);
    } else {
      setSelectedAppt(appt);
      loadThreadForDoctor(appt);
      setIsDetailOpen(true);
    }
  }

  // Filter patients list based on search query
  const filteredPatients = patients.filter(p => {
    const fullName = `${p.user?.first_name || ''} ${p.user?.last_name || ''}`.toLowerCase();
    const aidNumber = (p.medical_aid_number || '').toLowerCase();
    const query = patientSearch.toLowerCase();
    return fullName.includes(query) || aidNumber.includes(query);
  });

  const patientVisits = allAppointments.filter(appt => appt.patient_id.toString() === selectedPatientId);
  const patientPrescriptions = allPrescriptions.filter(rx => rx.patient_id?.toString() === selectedPatientId || rx.patient?.toString() === selectedPatientId);

  return (
    <div className="records-page-container" style={{ padding: '24px', position: 'relative', zIndex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Consultation Records</h1>
          <p style={{ color: 'var(--muted)', margin: '4px 0 0 0' }}>
            {role === 'doctor' ? "Access patients' medical history, metrics, and reports." : 'View, print, and access consultation history summaries.'}
          </p>
        </div>
      </div>

      {error && <p className="form-message form-error" style={{ marginBottom: '16px' }}>{error}</p>}

      {role === 'patient' && (
        <div className="panel" style={{ overflowX: 'auto', padding: '0', borderRadius: '20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow-soft)' }}>
          {appointments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--muted)' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📁</div>
              <h3>No Consultation Records Found</h3>
              <p style={{ margin: 0 }}>You do not have any past consultation records yet.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
                  <th style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Doctor</th>
                  <th style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Date</th>
                  <th style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Time Slot</th>
                  <th style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Reason</th>
                  <th style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '16px 20px', color: 'var(--muted)', fontSize: '0.8rem', fontWeight: '800', letterSpacing: '0.05em', textTransform: 'uppercase', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {appointments.map((appt) => (
                  <tr
                    key={appt.id}
                    onClick={() => handleOpenDetails(appt)}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(26,128,199,0.04)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.15s ease' }}
                  >
                    <td style={{ padding: '16px 20px', fontWeight: 'bold' }}>{appt.doctor_name}</td>
                    <td style={{ padding: '16px 20px' }}>{formatDate(appt.date)}</td>
                    <td style={{ padding: '16px 20px', fontWeight: '600' }}>{appt.time_label} {appt.timezone && <span style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', fontWeight: 'normal' }}>({appt.timezone})</span>}</td>
                    <td style={{ padding: '16px 20px', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{appt.reason}</td>
                    <td style={{ padding: '16px 20px' }}>
                      <span style={{ fontWeight: 'bold', textTransform: 'uppercase', fontSize: '12px', color: appt.status === 'done' ? '#21b26f' : appt.status === 'cancelled' ? '#d84d4d' : 'var(--primary)' }}>
                        {appt.status}
                      </span>
                    </td>
                    <td style={{ padding: '16px 20px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDetails(appt)}
                          className="mini-button"
                          style={{ color: '#d97706', fontWeight: 'bold', borderColor: '#eab308', background: 'transparent' }}
                        >
                          <i className="fa-solid fa-comments" style={{ color: '#d97706' }}></i> Go to Chat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Details Modal overlay */}
      {isDetailOpen && selectedAppt && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(4px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 999999
        }} onClick={() => setIsDetailOpen(false)}>
          <div style={{
            width: 'min(94vw, 920px)',
            height: 'min(92vh, 800px)',
            background: '#ffffff',
            borderRadius: '24px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            zIndex: 1000000
          }} onClick={(e) => e.stopPropagation()}>
            
            {/* Header */}
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#ffffff' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--text)' }}>
                    {role === 'doctor' ? (selectedAppt.patient_name || 'Patient Consultation') : (selectedAppt.doctor_name || 'Dr. Medical Officer')}
                  </h2>
                  <span className={`status-pill ${selectedAppt.status || 'done'}`}>
                    {selectedAppt.status === 'booked' ? 'APPROVAL IN PROCESS' : (selectedAppt.status || 'COMPLETED').toUpperCase()}
                  </span>
                </div>
                <p style={{ margin: '4px 0 0 0', color: 'var(--muted)', fontSize: '14px' }}>
                  Consultation Ref: NC-REC-{selectedAppt.id}
                </p>
              </div>
              
              <button
                type="button"
                onClick={() => setIsDetailOpen(false)}
                style={{
                  border: 'none',
                  background: 'rgba(29, 44, 72, 0.06)',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: 'var(--text)'
                }}
              >
                ✕
              </button>
            </div>

            {/* General Info Sheet */}
            <div style={{ padding: '20px 24px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '14px' }}>
                <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Date</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>{formatDate(selectedAppt.date)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Time slot</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>{selectedAppt.time_label} {selectedAppt.timezone && <span style={{ fontSize: '11.5px', color: 'var(--muted)', fontWeight: 'normal' }}>({selectedAppt.timezone})</span>}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold', display: 'block', textTransform: 'uppercase' }}>Category</span>
                    <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text)' }}>{getConsultationCategory(selectedAppt.reason).label}</span>
                  </div>
                </div>

                {(() => {
                  const modalRx = allPrescriptions.find(rx => rx.appointment === selectedAppt.id || rx.patient_id === selectedAppt.patient_id || rx.title === selectedAppt.reason);
                  if (!modalRx) return null;
                  return (
                    <button
                      type="button"
                      onClick={() => setActiveViewPrescription(modalRx)}
                      style={{
                        background: 'transparent',
                        border: '1.5px solid #eab308',
                        color: '#d97706',
                        fontWeight: 'bold',
                        padding: '6px 14px',
                        borderRadius: '8px',
                        fontSize: '13px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <i className="fa-solid fa-file-prescription" style={{ color: '#d97706' }}></i> View Prescription
                    </button>
                  );
                })()}
              </div>

              <div style={{ background: '#ffffff', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '11px', color: 'var(--muted)', fontWeight: 'bold', display: 'block', textTransform: 'uppercase', marginBottom: '2px' }}>Reason for Consultation</span>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text)', fontWeight: 600 }}>{selectedAppt.reason || 'General medical consultation'}</p>
              </div>
            </div>

            {/* Embedded Active Chat */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, padding: '20px', background: '#ffffff' }}>
              <ChatPanel
                title={`Secure Messages & Logs`}
                subtitle="Review recommendations and instructions"
                messages={activeThread.messages}
                draft={chatDraft}
                setDraft={setChatDraft}
                onSend={sendChatMessage}
                currentUserRole={role}
                readOnly={true}
                loading={loadingThread}
              />
            </div>
          </div>
        </div>
      )}

      {/* DOCTOR CLINICAL WORKSPACE VIEW */}
      {role === 'doctor' && (
        <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: '24px', alignItems: 'start', marginTop: '8px' }}>
          {/* Patient Directory Sidepane */}
          <div className="panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', borderRadius: '20px', background: 'white', border: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Patient Directory</h3>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={patientSearch}
                onChange={(e) => setPatientSearch(e.target.value)}
                placeholder="Search by name or member ID..."
                style={{ width: '100%', padding: '9px 12px 9px 36px', borderRadius: '12px', border: '1px solid var(--border)', fontSize: '13.5px', outline: 'none' }}
              />
              <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: '13px' }}></i>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '520px', overflowY: 'auto', paddingRight: '4px' }}>
              {filteredPatients.length === 0 ? (
                <p style={{ color: 'var(--muted)', textAlign: 'center', fontSize: '13px', padding: '16px 0' }}>No patients found.</p>
              ) : (
                filteredPatients.map(p => {
                  const isActive = p.id.toString() === selectedPatientId;
                  return (
                    <div
                      key={p.id}
                      onClick={() => handlePatientChange(p.id.toString())}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        padding: '10px 12px',
                        borderRadius: '14px',
                        background: isActive ? 'rgba(26, 128, 199, 0.08)' : 'transparent',
                        border: isActive ? '1px solid rgba(26, 128, 199, 0.18)' : '1px solid transparent',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'rgba(29, 44, 72, 0.03)';
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{
                        width: '38px', height: '38px', borderRadius: '50%',
                        border: '1.5px solid #EF6C00', background: 'transparent',
                        color: '#EF6C00', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontWeight: 700, fontSize: '13px', flexShrink: 0, overflow: 'hidden'
                      }}>
                        {p.profile_pic ? <img src={p.profile_pic} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} /> : avatarFromName(`${p.user?.first_name || ''} ${p.user?.last_name || ''}`)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <strong style={{ display: 'block', fontSize: '14px', color: isActive ? 'var(--primary)' : 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {p.user?.first_name} {p.user?.last_name}
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>{p.medical_aid_number || 'CM-111111'}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Selected Patient clinical workspace panel */}
          {selectedPatient ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Profile Card Header */}
              <div className="panel" style={{ padding: '24px 24px 0 24px', borderRadius: '20px', background: 'white', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '20px' }}>
                  <div style={{
                    width: '64px', height: '64px', borderRadius: '50%',
                    border: '2px solid #EF6C00', background: 'transparent',
                    color: '#EF6C00', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '20px', flexShrink: 0, overflow: 'hidden'
                  }}>
                    {selectedPatient.profile_pic ? (
                      <img src={selectedPatient.profile_pic} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                    ) : avatarFromName(`${selectedPatient.user?.first_name || ''} ${selectedPatient.user?.last_name || ''}`)}
                  </div>

                  <div style={{ flex: 1 }}>
                    <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 800, color: 'var(--text)' }}>
                      {selectedPatient.user?.first_name} {selectedPatient.user?.last_name}
                    </h2>
                    <p style={{ margin: '6px 0 0 0', color: 'var(--muted)', fontSize: '13px' }}>
                      Member ID: <strong>{selectedPatient.medical_aid_number || 'CM-111111'}</strong> • <strong>{selectedPatient.plan || 'CellMed Gold'}</strong> • Medical Aid Membership: <strong>{selectedPatient.medical_aid_number || 'CM-111111'}</strong>
                    </p>
                  </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border)' }}>
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceTab('general')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: activeWorkspaceTab === 'general' ? '3px solid var(--primary)' : '3px solid transparent',
                      color: activeWorkspaceTab === 'general' ? 'var(--primary)' : 'var(--muted)',
                      fontWeight: 700,
                      fontSize: '14.5px',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    General Information
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWorkspaceTab('visits')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      borderBottom: activeWorkspaceTab === 'visits' ? '3px solid var(--primary)' : '3px solid transparent',
                      color: activeWorkspaceTab === 'visits' ? 'var(--primary)' : 'var(--muted)',
                      fontWeight: 700,
                      fontSize: '14.5px',
                      padding: '10px 16px',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    Visits & Prescription History
                  </button>
                </div>
              </div>

              {/* Workspace Content */}
              {activeWorkspaceTab === 'general' ? (
                /* Profile, Vitals & Clinical info card */
                <div className="panel" style={{ padding: '24px', borderRadius: '20px', background: 'white', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
                    <i className="fa-solid fa-chart-line" style={{ color: 'var(--primary)', fontSize: '18px' }}></i>
                    <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Clinical Metrics</h3>
                  </div>

                  {/* 4 Vitals cards grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '20px' }}>
                    {/* Weight */}
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 800, letterSpacing: '0.04em' }}>WEIGHT</span>
                        <strong style={{ display: 'block', fontSize: '20px', color: 'var(--text)', margin: '8px 0 2px 0' }}>
                          {selectedPatient?.weight ? (selectedPatient.weight.toString().toLowerCase().includes('kg') ? selectedPatient.weight : `${selectedPatient.weight} kg`) : 'Not set'}
                        </strong>
                        <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Patient Profile Record</span>
                      </div>
                      <svg width="100%" height="24" viewBox="0 0 100 24" fill="none" style={{ marginTop: '12px' }}>
                        <path d="M 0 18 Q 30 14, 60 10 T 100 6" stroke="#1a80c7" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="100" cy="6" r="3" fill="#1a80c7" />
                      </svg>
                    </div>

                    {/* Height */}
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 800, letterSpacing: '0.04em' }}>HEIGHT</span>
                        <strong style={{ display: 'block', fontSize: '20px', color: 'var(--text)', margin: '8px 0 2px 0' }}>
                          {selectedPatient?.height ? (selectedPatient.height.toString().toLowerCase().includes('cm') ? selectedPatient.height : `${selectedPatient.height} cm`) : 'Not set'}
                        </strong>
                        <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Patient Profile Record</span>
                      </div>
                      <svg width="100%" height="24" viewBox="0 0 100 24" fill="none" style={{ marginTop: '12px' }}>
                        <path d="M 0 20 Q 25 10, 60 14 T 100 8" stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="100" cy="8" r="3" fill="#10b981" />
                      </svg>
                    </div>

                    {/* Blood Type */}
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 800, letterSpacing: '0.04em' }}>BLOOD TYPE</span>
                        <strong style={{ display: 'block', fontSize: '20px', color: 'var(--text)', margin: '8px 0 2px 0' }}>
                          {selectedPatient?.blood_type || 'Not specified'}
                        </strong>
                        <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Patient Profile Record</span>
                      </div>
                      <svg width="100%" height="24" viewBox="0 0 100 24" fill="none" style={{ marginTop: '12px' }}>
                        <path d="M 0 16 Q 40 22, 70 8 T 100 12" stroke="#ffaa2b" strokeWidth="2.5" strokeLinecap="round" />
                        <circle cx="100" cy="12" r="3" fill="#ffaa2b" />
                      </svg>
                    </div>

                    {/* Emergency Contact */}
                    <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 800, letterSpacing: '0.04em' }}>EMERGENCY CONTACT</span>
                          <i className="fa-solid fa-phone" style={{ color: 'var(--primary)', fontSize: '12px' }}></i>
                        </div>
                        <strong style={{ display: 'block', fontSize: '15px', color: 'var(--text)', margin: '8px 0 4px 0' }}>
                          {selectedPatient?.emergency_contact || selectedPatient?.phone || 'Not provided'}
                        </strong>
                        <span style={{ fontSize: '12px', color: 'var(--muted)' }}>
                          {selectedPatient?.emergency_contact ? (selectedPatient?.user?.first_name ? `${selectedPatient.user.first_name}'s Contact` : 'Emergency Contact') : 'Primary Contact'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* 2 Subcards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px' }}>⚠️</span>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 800, letterSpacing: '0.04em' }}>ALLERGIES & CONTRAINDICATIONS</span>
                      </div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '14.5px', color: selectedPatient?.allergies ? '#ef4444' : 'var(--text)', fontWeight: 600 }}>
                        {selectedPatient?.allergies || 'No known allergies reported.'}
                      </p>
                      <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Verified Patient Profile Record</span>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '18px', borderRadius: '16px', border: '1px solid var(--border)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px' }}>📝</span>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 800, letterSpacing: '0.04em' }}>CHRONIC CONDITIONS & MEDICAL NOTES</span>
                      </div>
                      <p style={{ margin: '0 0 10px 0', fontSize: '14.5px', color: 'var(--text)', fontWeight: 600 }}>
                        {selectedPatient?.chronic_conditions || 'No chronic conditions reported.'}
                      </p>
                      <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>Verified Patient Profile Record</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Visits & Prescriptions History panel */
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                  {patientVisits.length === 0 ? (
                    <div className="panel" style={{ padding: '24px', textAlign: 'center', color: 'var(--muted)' }}>
                      <p style={{ margin: 0 }}>No past clinical visit summaries available.</p>
                    </div>
                  ) : (
                    patientVisits.map(appt => {
                      const rxGiven = patientPrescriptions.filter(rx => {
                        if (rx.appointment) {
                          return rx.appointment.toString() === appt.id.toString();
                        }
                        if (rx.created_at && appt.date) {
                          const rxDate = new Date(rx.created_at).toISOString().split('T')[0];
                          const apptDateStr = new Date(appt.date).toISOString().split('T')[0];
                          if (rxDate === apptDateStr) {
                            const sameDayVisits = patientVisits.filter(v => new Date(v.date).toISOString().split('T')[0] === apptDateStr);
                            return sameDayVisits[0]?.id === appt.id;
                          }
                        }
                        return false;
                      });
                      return (
                        <div key={appt.id} className="panel" style={{ padding: '20px', borderRadius: '20px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                            <div>
                              <strong style={{ fontSize: '15px' }}>Medical Consultation</strong>
                              <p style={{ margin: '2px 0 0 0', fontSize: '12.5px', color: 'var(--muted)' }}>
                                {formatDate(appt.date)} at {appt.time_label} {appt.timezone && <span style={{ fontSize: '11.5px', color: 'var(--muted)' }}>({appt.timezone})</span>}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenDetails(appt)}
                              className="text-button"
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#d97706', fontWeight: 'bold' }}
                            >
                              <i className="fa-solid fa-comments" style={{ color: '#d97706' }}></i> Go to Chat
                            </button>
                          </div>
                          
                          <div style={{ borderTop: '1.5px dashed var(--border)', margin: '12px 0' }} />

                          {/* Prescriptions issued list */}
                          <div style={{ marginBottom: '12px' }}>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 'bold', display: 'block', marginBottom: '6px' }}>Issued Prescriptions</span>
                            {rxGiven.length === 0 ? (
                              <p style={{ margin: 0, fontSize: '13px', color: 'var(--muted)', fontStyle: 'italic' }}>No prescription sheets issued during this consultation.</p>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {rxGiven.map(rx => (
                                  <div key={rx.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', border: '1px solid var(--border)', borderRadius: '10px', padding: '10px 14px' }}>
                                    <div>
                                      <strong style={{ fontSize: '13.5px', color: 'var(--text)' }}>℞ {rx.medication}</strong>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setActiveViewPrescription(rx)}
                                      style={{
                                        background: 'transparent',
                                        border: '1.5px solid #eab308',
                                        color: '#d97706',
                                        fontWeight: 'bold',
                                        padding: '5px 14px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: '5px'
                                      }}
                                    >
                                      <i className="fa-solid fa-eye" style={{ color: '#d97706' }}></i> View
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Bottom Confidentiality Notice Banner */}
              <div style={{
                marginTop: '12px',
                background: 'rgba(26, 128, 199, 0.04)',
                border: '1px solid rgba(26, 128, 199, 0.12)',
                borderRadius: '16px',
                padding: '16px 20px',
                display: 'flex',
                alignItems: 'center',
                gap: '14px'
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'rgba(26, 128, 199, 0.1)', color: 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', flexShrink: 0
                }}>
                  <i className="fa-solid fa-shield-halved"></i>
                </div>
                <div style={{ flex: 1 }}>
                  <strong style={{ display: 'block', fontSize: '13.5px', color: '#12213d' }}>Patient data is private and confidential.</strong>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Access is logged and monitored for security and compliance.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="panel" style={{ padding: '48px', textAlign: 'center', color: 'var(--muted)' }}>
              <p>Select a patient from the directory to review records.</p>
            </div>
          )}
        </div>
      )}

      {/* Add Document Modal for Doctors */}
      {showUploadModal && (
        <div className="modal-overlay" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)',
          display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 10
        }}>
          <div className="panel" style={{ width: '400px', padding: '24px' }}>
            <h3 style={{ marginTop: 0 }}>Add Medical Document</h3>
            <form onSubmit={handleUploadSubmit} className="auth-form" style={{ gap: '14px' }}>
              <label>
                Document Category
                <select
                  required
                  value={uploadForm.record_type}
                  onChange={(e) => setUploadForm({ ...uploadForm, record_type: e.target.value })}
                  style={{ width: '100%', padding: '10px', borderRadius: '8px', border: '1px solid var(--border)', background: 'white' }}
                >
                  <option value="Laboratory Result">Laboratory Result</option>
                  <option value="Radiology Report (X-Ray)">Radiology Report (X-Ray)</option>
                  <option value="Prescription Receipt">Prescription Receipt</option>
                  <option value="Clinical Referral Letter">Clinical Referral Letter</option>
                  <option value="Vaccination Log Card">Vaccination Log Card</option>
                  <option value="Other Attachment">Other Attachment</option>
                </select>
              </label>

              <label>
                Document File Name / Title
                <input
                  required
                  value={uploadForm.file_name}
                  onChange={(e) => setUploadForm({ ...uploadForm, file_name: e.target.value })}
                  placeholder="e.g. Blood Lipids Profile 2026.pdf"
                />
              </label>

              <label>
                Simulated Upload Status
                <div style={{ padding: '12px', background: 'rgba(33,178,111,0.06)', border: '1px dashed var(--success)', borderRadius: '8px', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                  <span>✓</span> File automatically linked securely.
                </div>
              </label>

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="submit" className="cta-button" style={{ flex: 1 }}>Save Document</button>
                <button type="button" className="secondary-button" style={{ flex: 1 }} onClick={() => setShowUploadModal(false)}>Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Official Prescription Printable Overlay Modal */}
      {activeViewPrescription && (
        <NectaCarePrescriptionTemplate
          prescription={activeViewPrescription}
          patient={selectedPatient}
          onClose={() => setActiveViewPrescription(null)}
        />
      )}
    </div>
  );
}

function ChatPanel({ title, subtitle, messages, draft, setDraft, onSend, currentUserRole, readOnly = false, loading = false }) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSec, setRecordingSec] = useState(0);
  const recordingTimer = useRef(null);
  const fileInputRef = useRef(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

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
    if (file.size > 2 * 1024 * 1024) {
      alert('Image file is too large. Please select an image under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      onSend(null, `[IMAGE] ${reader.result}`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  function renderMessageBody(body) {
    if (!body || typeof body !== 'string') {
      return <p style={{ fontStyle: 'italic', color: 'var(--muted)', margin: 0 }}>Communication log entry</p>;
    }
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
    <article className="panel chat-panel" style={{ display: 'flex', flexDirection: 'column', flex: 1, height: '100%', minHeight: '350px' }}>
      <div className="panel-heading notes-heading" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.1rem' }}>{title}</h2>
          <span className="notes-badge" style={{ fontSize: '11px' }}>{subtitle}</span>
        </div>
      </div>

      <div className="chat-list" style={{ flex: 1, overflowY: 'auto', padding: '16px 0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--muted)' }}>
            <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--primary)' }}></i>
            <p style={{ margin: 0, fontSize: '13px' }}>Loading consultation chat logs...</p>
          </div>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 20px', color: 'var(--muted)', background: '#f8fafc', borderRadius: '14px', border: '1.5px dashed var(--border)' }}>
            <div style={{ fontSize: '28px', marginBottom: '6px' }}>💬</div>
            <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: 'var(--text)', fontSize: '14px' }}>No chat messages in this consultation yet</p>
            <span style={{ fontSize: '12px' }}>Communication logs, voice notes, and clinical notes exchanged during the consultation will appear here.</span>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={`chat-message ${message.sender_role === currentUserRole ? 'me' : 'them'}`}>
              <strong style={{ fontSize: '11px', color: 'var(--muted)', display: 'block', marginBottom: '2px' }}>{message.sender_name}</strong>
              {renderMessageBody(message.body)}
            </div>
          ))
        )}
      </div>

      {readOnly ? (
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border)', background: '#f8fafc',
          color: 'var(--muted)', textAlign: 'center', fontSize: '13px', borderRadius: '0 0 16px 16px', fontWeight: '500'
        }}>
          <i className="fa-solid fa-lock" style={{ marginRight: '6px', color: '#1a80c7' }}></i>
          Past consultation record (Read Only View)
        </div>
      ) : (
        <form className="chat-form" onSubmit={onSend} style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
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
                  style={{ padding: '8px', background: 'rgba(29, 44, 72, 0.04)', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
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
                  onCapture={(capturedBase64) => {
                    onSend(null, `[IMAGE] ${capturedBase64}`);
                  }}
                />
                <textarea
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  rows={1}
                  placeholder="Write a message..."
                  style={{ flex: 1, resize: 'none', minHeight: '38px', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)', fontFamily: 'inherit' }}
                />
                <button type="submit" className="cta-button compact" style={{ minHeight: '38px', borderRadius: '10px', padding: '0 16px', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer' }}>
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
