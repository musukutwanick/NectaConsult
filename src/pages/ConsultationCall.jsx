import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import CameraModal from '../components/CameraModal';
import NectaCarePrescriptionTemplate from '../components/NectaCarePrescriptionTemplate';
import SignaturePad from '../components/SignaturePad';



export default function ConsultationCall({ role, token, patientName, doctorName, patientId, doctorId, appointmentId, onEndCall, appointmentStatus, readOnly = false }) {
  const localVideoRef = useRef(null);
  const messagesEndRef = useRef(null);
  const headerRef = useRef(null);
  const fileInputRef = useRef(null);

  const [isDarkMode, setIsDarkMode] = useState(false);
  const [stream, setStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  
  // Call state toggles
  const [activeCallType, setActiveCallType] = useState(null); // null, 'video', or 'voice'
  
  // Chat States
  const [threadId, setThreadId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [partnerTyping, setPartnerTyping] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState(null);

  const amITypingRef = useRef(false);
  const typingTimeoutRef = useRef(null);
  
  // Audio Recording States
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const recordTimerRef = useRef(null);

  // Dragging & Maximizing states
  const [isMaximized, setIsMaximized] = useState(true);
  const [position, setPosition] = useState({ x: window.innerWidth - 480, y: 80 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Voice playback states
  const [playingMsgId, setPlayingMsgId] = useState(null);
  const activeAudioRef = useRef(null);

  // Digital Prescription States
  const [showPrescriptionModal, setShowPrescriptionModal] = useState(false);
  const [prescDrugs, setPrescDrugs] = useState([{ name: '', dosage: '', instructions: '' }]);
  const [prescPatientAddress, setPrescPatientAddress] = useState('');
  const [prescPatientAge, setPrescPatientAge] = useState('');
  const [doctorRegNum, setDoctorRegNum] = useState('');
  const [doctorQualifications, setDoctorQualifications] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [doctorSignature, setDoctorSignature] = useState('');
  const [prescError, setPrescError] = useState('');
  const [activeViewPrescription, setActiveViewPrescription] = useState(null);

  const isReadOnlySession = Boolean(readOnly || appointmentStatus === 'done' || appointmentStatus === 'completed' || appointmentStatus === 'cancelled');

  useEffect(() => {
    const getProfile = api.getMe || api.me;
    if (getProfile && token) {
      getProfile(token).then(data => {
        const prof = data || {};
        if (prof.signature_data) setDoctorSignature(prof.signature_data);
        if (prof.doctor_registration_number) setDoctorRegNum(prof.doctor_registration_number);
        if (prof.doctor_qualifications) setDoctorQualifications(prof.doctor_qualifications);
        if (prof.clinic_address) setClinicAddress(prof.clinic_address);
      }).catch(e => console.error(e));
    }
  }, [token]);



  // Audio recording refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingStreamRef = useRef(null);

  // Audio cleanup
  useEffect(() => {
    return () => {
      if (activeAudioRef.current) {
        try {
          activeAudioRef.current.pause();
        } catch (e) {}
      }
      if (recordingStreamRef.current) {
        try {
          recordingStreamRef.current.getTracks().forEach(track => track.stop());
        } catch (e) {}
      }
    };
  }, []);

  // Handle resizing of browser window to keep floating chat visible
  useEffect(() => {
    function handleResize() {
      if (!isMaximized) {
        setPosition(prev => ({
          x: Math.min(prev.x, window.innerWidth - 460),
          y: Math.min(prev.y, window.innerHeight - 300)
        }));
      }
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isMaximized]);

  // Draggable mouse handlers
  const handleMouseDown = (e) => {
    if (isMaximized) return;
    // Don't drag if clicking buttons inside the header
    if (e.target.closest('button') || e.target.closest('a')) return;

    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      
      const newX = Math.max(0, Math.min(e.clientX - dragOffset.x, window.innerWidth - 200));
      const newY = Math.max(0, Math.min(e.clientY - dragOffset.y, window.innerHeight - 100));
      
      setPosition({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Fetch thread and messages on mount, with active polling
  useEffect(() => {
    async function loadThread() {
      try {
        let res;
        if (role === 'doctor') {
          res = await api.getPatientThread(token, patientId || '');
        } else {
          res = await api.thread(token, doctorId || '');
        }
        setThreadId(res.thread_id);
        setMessages(res.messages || []);
        const isPartnerTyping = role === 'doctor' ? res.is_patient_typing : res.is_doctor_typing;
        setPartnerTyping(!!isPartnerTyping);
      } catch (err) {
        console.error('Failed to load chat thread', err);
      }
    }

    loadThread();

    // Poll every 3 seconds for new messages
    const pollInterval = setInterval(loadThread, 3000);

    return () => {
      clearInterval(pollInterval);
    };
  }, [role, token, patientId, doctorId]);

  useEffect(() => {
    return () => {
      if (stream) {
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch (e) {}
      }
      if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    };
  }, [stream]);

  // Scroll to bottom of chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isRecording]);

  useEffect(() => {
    if (isRecording) {
      setRecordDuration(0);
      recordTimerRef.current = setInterval(() => {
        setRecordDuration((prev) => prev + 1);
      }, 1000);
    } else {
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
    }
  }, [isRecording]);

  function handleToggleMute() {
    if (stream) {
      stream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setMuted(!muted);
    }
  }

  function handleToggleVideo() {
    if (stream) {
      stream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoOff(!videoOff);
    }
  }

  const handleTextChange = (val) => {
    setTextInput(val);
    if (!threadId) return;

    if (val.trim() === '') {
      if (amITypingRef.current) {
        amITypingRef.current = false;
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        api.updateTypingStatus(token, threadId, false).catch(err => console.error(err));
      }
      return;
    }

    if (!amITypingRef.current) {
      amITypingRef.current = true;
      api.updateTypingStatus(token, threadId, true).catch(err => console.error(err));
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    typingTimeoutRef.current = setTimeout(() => {
      amITypingRef.current = false;
      api.updateTypingStatus(token, threadId, false).catch(err => console.error(err));
    }, 3000);
  };

  async function handleSendMessage(e) {
    if (e) e.preventDefault();
    if (!textInput.trim() || !threadId) return;

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    amITypingRef.current = false;

    try {
      const msg = await api.sendMessage(token, threadId, textInput.trim());
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      setTextInput('');
    } catch (err) {
      console.error('Failed to send message', err);
    }
  }

  async function handleSendAudio() {
    if (!isRecording) {
      audioChunksRef.current = [];
      
      let micStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        recordingStreamRef.current = micStream;
      } catch (err) {
        console.warn('Microphone stream access denied', err);
        alert('Microphone access is required to record voice messages. Please check your browser permissions.');
        return;
      }

      let recorder;
      try {
        recorder = new MediaRecorder(micStream, { mimeType: 'audio/webm' });
      } catch (e) {
        try {
          recorder = new MediaRecorder(micStream);
        } catch (err) {
          alert('Recording voice notes is not supported on this browser.');
          return;
        }
      }
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.start(250);
      setIsRecording(true);
    } else {
      setIsRecording(false);
      if (!threadId || !mediaRecorderRef.current) return;

      const recorder = mediaRecorderRef.current;
      
      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        
        // Stop and release the microphone stream tracks
        if (recordingStreamRef.current) {
          try {
            recordingStreamRef.current.getTracks().forEach(track => track.stop());
          } catch (e) {}
          recordingStreamRef.current = null;
        }

        // Convert recorded audio to Base64 to save directly in the message body
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64data = reader.result;
          
          const audioDuration = recordDuration || 1;
          const body = `[Voice Message]:${audioDuration}:${base64data}`;

          try {
            const msg = await api.sendMessage(token, threadId, body);
            setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
          } catch (err) {
            console.error('Failed to send voice message', err);
          }
        };
      };

      recorder.stop();
    }
  }

  function handlePlayAudio(msgId, base64data) {
    if (activeAudioRef.current) {
      try {
        activeAudioRef.current.pause();
      } catch (e) {}
      activeAudioRef.current = null;
    }

    if (playingMsgId === msgId) {
      setPlayingMsgId(null);
      return;
    }

    setPlayingMsgId(msgId);

    // If it's a real base64 voice note, play using HTML5 Audio
    if (base64data && base64data.startsWith('data:audio')) {
      try {
        const audio = new Audio(base64data);
        activeAudioRef.current = audio;
        
        audio.play().catch(err => {
          console.error('Audio playback failed', err);
          setPlayingMsgId(null);
        });

        audio.onended = () => {
          setPlayingMsgId(null);
          activeAudioRef.current = null;
        };
      } catch (err) {
        console.warn('Playback instantiation failed:', err);
        setPlayingMsgId(null);
      }
    } else {
      // Fallback for old/mock voice messages (uses Speech Synthesis tone beeps)
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) {
          setPlayingMsgId(null);
          return;
        }
        const ctx = new AudioContext();
        const stopNode = {
          pause: () => {
            try { ctx.close(); } catch(e){}
          }
        };
        activeAudioRef.current = stopNode;

        const osc = ctx.createOscillator();
        const gainNode = ctx.createGain();
        osc.connect(gainNode);
        gainNode.connect(ctx.destination);
        osc.type = 'triangle';
        let time = ctx.currentTime;
        const duration = 2; // play 2 second simulation
        const speakInterval = 0.22;
        
        for (let i = 0; i < duration; i += speakInterval) {
          const freq = 180 + Math.random() * 240;
          osc.frequency.setValueAtTime(freq, time + i);
          gainNode.gain.setValueAtTime(0.2, time + i);
          gainNode.gain.exponentialRampToValueAtTime(0.001, time + i + speakInterval - 0.03);
        }

        osc.start(time);
        osc.stop(time + duration);

        setTimeout(() => {
          setPlayingMsgId(curr => {
            if (curr === msgId) {
              activeAudioRef.current = null;
              return null;
            }
            return curr;
          });
        }, duration * 1000);
      } catch (err) {
        setPlayingMsgId(null);
      }
    }
  }

  async function handleIssuePrescription() {
    const validDrugs = prescDrugs.filter(d => d.name.trim().length > 0);
    if (validDrugs.length === 0) {
      setPrescError('Please prescribe at least one drug.');
      return;
    }

    try {
      const payload = {
        appointment: appointmentId || null,
        patient_id: patientId,
        appointment_id: appointmentId,
        title: 'Prescription from Doctor',
        medication: validDrugs[0].name,
        dosage: validDrugs[0].dosage,
        renewal_note: validDrugs[0].instructions,
        drugs_json: JSON.stringify(validDrugs),
        patient_address: prescPatientAddress,
        patient_age: prescPatientAge,
        doctor_registration_number: doctorRegNum,
        doctor_qualifications: doctorQualifications,
        doctor_address: clinicAddress,
        doctor_signature: doctorSignature
      };

      const created = await api.createPrescription(token, payload);

      const msgBody = `[PRESCRIPTION] ${validDrugs[0].name}|${validDrugs[0].dosage}|${validDrugs[0].instructions || ''}|${created.id}`;
      const msg = await api.sendMessage(token, threadId, msgBody);
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));

      setShowPrescriptionModal(false);
      setPrescDrugs([{ name: '', dosage: '', instructions: '' }]);
      setPrescError('');
    } catch (err) {
      setPrescError(err.message || 'Failed to issue prescription.');
    }
  }


  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !threadId) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result;
        const msg = await api.sendMessage(token, threadId, `[IMAGE] ${base64Data}`);
        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      } catch (err) {
        console.error('Failed to send image', err);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }

  const formatDuration = (sec) => {
    const mins = Math.floor(sec / 60);
    const secs = sec % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const rawPartner = role === 'doctor' ? patientName : doctorName;
  const partnerName = typeof rawPartner === 'string' && rawPartner.trim() ? rawPartner : (role === 'doctor' ? 'Patient' : 'Doctor');
  const partnerInitials = partnerName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase() || (role === 'doctor' ? 'P' : 'D');

  // Floating wrapper card style
  const floatingStyles = isMaximized ? {
    position: 'fixed', inset: 0, width: '100vw', height: '100vh',
    background: isDarkMode ? '#0b0f19' : '#f0f2f5', color: isDarkMode ? '#e2e8f0' : '#111b21', zIndex: 10000,
    display: 'flex', flexDirection: 'column',
    transition: 'all 0.15s ease-out',
    fontFamily: "'Inter', sans-serif"
  } : {
    position: 'fixed', left: `${position.x}px`, top: `${position.y}px`,
    width: '450px', height: '620px', maxHeight: '90vh',
    background: isDarkMode ? '#0b0f19' : '#ffffff', color: isDarkMode ? '#e2e8f0' : '#111b21', zIndex: 10000,
    display: 'flex', flexDirection: 'column',
    boxShadow: isDarkMode ? '0 20px 50px rgba(0,0,0,0.6)' : '0 20px 50px rgba(0,0,0,0.15)', 
    border: isDarkMode ? '1.5px solid #1e293b' : '1.5px solid #e9edef',
    borderRadius: '16px', overflow: 'hidden',
    cursor: isDragging ? 'grabbing' : 'grab',
    transition: isDragging ? 'none' : 'box-shadow 0.2s',
    fontFamily: "'Inter', sans-serif"
  };

  return (
    <>
      <style>{`
        @keyframes typingDot {
          0% { opacity: 0.2; transform: translateY(0); }
          20% { opacity: 1; transform: translateY(-2.5px); }
          40% { opacity: 0.2; transform: translateY(0); }
          100% { opacity: 0.2; transform: translateY(0); }
        }
      `}</style>
      {/* Background overlay only when maximized to isolate conversation focus */}
      {isMaximized && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(5, 7, 12, 0.75)',
          backdropFilter: 'blur(6px)', zIndex: 9999
        }} />
      )}

      <div style={floatingStyles}>
        {/* Drag handle line indicator in floating mode */}
        {!isMaximized && (
          <div 
            onMouseDown={handleMouseDown}
            style={{
              height: '8px', 
              background: isDarkMode ? '#131c2e' : '#ffffff', 
              display: 'flex', 
              justifyContent: 'center', alignItems: 'center', cursor: 'inherit',
              borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.02)' : '1px solid #e9edef'
            }}
          >
            <div style={{ width: '40px', height: '3px', borderRadius: '1.5px', background: isDarkMode ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.1)' }}></div>
          </div>
        )}

        {/* WhatsApp-Style Chat Header */}
        <header 
          onMouseDown={handleMouseDown}
          ref={headerRef}
          style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: isMaximized ? '16px 24px' : '12px 18px', 
            borderBottom: isDarkMode ? '1px solid #1e293b' : '1px solid #e9edef', 
            background: isDarkMode ? '#131c2e' : '#ffffff',
            color: isDarkMode ? '#e2e8f0' : '#111b21',
            cursor: isMaximized ? 'default' : 'inherit', userSelect: 'none'
          }}
        >
          {/* User Bio info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '50%', background: '#1a80c7', color: 'white',
              display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '15px'
            }}>
              {partnerInitials}
            </div>

            <div>
              <h3 style={{ margin: 0, fontSize: '14.5px', fontWeight: '700', color: isDarkMode ? '#e2e8f0' : '#111b21' }}>{partnerName}</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: partnerTyping ? 'bold' : 'normal' }}>
                <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }}></span>
                Active Consult
                {partnerTyping && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '3px', color: '#10b981' }}>
                    • typing
                    <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center', marginLeft: '2px' }}>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981', animation: 'typingDot 1.4s infinite both' }}></span>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981', animation: 'typingDot 1.4s infinite both', animationDelay: '0.2s' }}></span>
                      <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#10b981', animation: 'typingDot 1.4s infinite both', animationDelay: '0.4s' }}></span>
                    </span>
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Action Icons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Theme Toggle Button */}
            <button
              type="button"
              onClick={() => setIsDarkMode(!isDarkMode)}
              title={isDarkMode ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
              style={{ background: 'none', border: 'none', color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '15px', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1a80c7'}
              onMouseLeave={(e) => e.currentTarget.style.color = isDarkMode ? '#94a3b8' : '#64748b'}
            >
              <i className={isDarkMode ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}></i>
            </button>

            {/* Poll Call Controls - Disabled with diagonal line */}
            {/* Poll Call Controls - Clean icons with click alerts */}
            <button
              type="button"
              onClick={() => alert('Voice call is not yet available')}
              title="Voice call is not yet available"
              style={{
                background: 'none', border: 'none', color: isDarkMode ? '#94a3b8' : '#64748b',
                fontSize: '15px', cursor: 'pointer', transition: 'color 0.2s', padding: '4px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1a80c7'}
              onMouseLeave={(e) => e.currentTarget.style.color = isDarkMode ? '#94a3b8' : '#64748b'}
            >
              <i className="fa-solid fa-phone"></i>
            </button>
            <button
              type="button"
              onClick={() => alert('Video chat is not yet available')}
              title="Video chat is not yet available"
              style={{
                background: 'none', border: 'none', color: isDarkMode ? '#94a3b8' : '#64748b',
                fontSize: '15px', cursor: 'pointer', transition: 'color 0.2s', padding: '4px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1a80c7'}
              onMouseLeave={(e) => e.currentTarget.style.color = isDarkMode ? '#94a3b8' : '#64748b'}
            >
              <i className="fa-solid fa-video"></i>
            </button>

            {/* Maximize / Minimize Down Toggle Button */}
            <button
              type="button"
              onClick={() => setIsMaximized(!isMaximized)}
              title={isMaximized ? 'Restore Down (Floating)' : 'Maximize (Full Screen)'}
              style={{ background: 'none', border: 'none', color: isDarkMode ? '#94a3b8' : '#64748b', fontSize: '15px', cursor: 'pointer', transition: 'color 0.2s' }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#1a80c7'}
              onMouseLeave={(e) => e.currentTarget.style.color = isDarkMode ? '#94a3b8' : '#64748b'}
            >
              {isMaximized ? <i className="fa-solid fa-compress"></i> : <i className="fa-solid fa-expand"></i>}
            </button>

            <button
              type="button"
              onClick={onEndCall}
              style={{
                background: '#ef4444', color: 'white', border: 'none', width: '32px', height: '32px',
                borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', boxShadow: '0 4px 12px rgba(239, 68, 68, 0.25)'
              }}
              title="Close Consultation"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        </header>

        {/* WhatsApp-Style Scrollable Messages Area with Dashboard Pattern background */}
        <div style={{
          flex: 1, overflowY: 'auto', padding: '20px', 
          backgroundColor: isDarkMode ? '#131c2e' : '#efeae2',
          backgroundImage: "url('/pattern.png?v=2')",
          backgroundRepeat: 'repeat',
          backgroundSize: '800px auto',
          display: 'flex', flexDirection: 'column', gap: '14px'
        }}>
          {messages.map((msg) => {
            const msgBodyText = typeof msg.body === 'string' ? msg.body : (msg.body != null ? String(msg.body) : '');
            const isSelf = msg.sender_username === (role === 'doctor' ? 'dr.moyo' : 'lebo.mokoena') || msg.sender_role === role;
            const isAudio = msgBodyText.startsWith('[Voice Message]:');
            let duration = 0;
            let audioData = '';
            if (isAudio) {
              const parts = msgBodyText.split(':');
              duration = parts[1] || 0;
              audioData = parts.slice(2).join(':');
            }

            const isRx = msgBodyText.startsWith('[PRESCRIPTION]');


            return (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: isSelf ? 'flex-end' : 'flex-start',
                width: '100%'
              }}>
                <div style={{
                  maxWidth: '85%',
                  background: isSelf 
                    ? (isDarkMode ? '#005c4b' : '#d9fdd3') 
                    : (isDarkMode ? '#202c33' : '#ffffff'),
                  color: isDarkMode ? '#e9edef' : '#111b21',
                  padding: '10px 14px',
                  borderRadius: isSelf ? '14px 14px 0 14px' : '14px 14px 14px 0',
                  boxShadow: isDarkMode ? '0 1px 0.5px rgba(0,0,0,0.15)' : '0 1px 0.5px rgba(0,0,0,0.13)',
                  position: 'relative',
                  border: isSelf 
                    ? (isDarkMode ? '1px solid #005c4b' : '1px solid #c1ebd0') 
                    : (isDarkMode ? '1px solid #202c33' : '1px solid #e2e8f0')
                }}>
                  {isAudio ? (
                    /* Audio Pill UI */
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <button 
                        type="button" 
                        onClick={() => handlePlayAudio(msg.id, audioData)}
                        style={{
                          width: '28px', height: '28px', borderRadius: '50%', border: 'none',
                          background: '#1a80c7', color: 'white', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', cursor: 'pointer', fontSize: '11px'
                        }}
                      >
                        {playingMsgId === msg.id ? (
                          <i className="fa-solid fa-pause"></i>
                        ) : (
                          <i className="fa-solid fa-play"></i>
                        )}
                      </button>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <svg width="120" height="20" viewBox="0 0 120 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <rect x="0" y="6" width="2" height="8" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="5" y="3" width="2" height="14" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="10" y="8" width="2" height="4" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="15" y="2" width="2" height="16" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="20" y="6" width="2" height="8" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="25" y="4" width="2" height="12" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="30" y="8" width="2" height="4" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="35" y="1" width="2" height="18" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="40" y="6" width="2" height="8" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="45" y="5" width="2" height="10" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="50" y="8" width="2" height="4" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="55" y="3" width="2" height="14" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="60" y="6" width="2" height="8" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="65" y="4" width="2" height="12" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="70" y="8" width="2" height="4" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                          <rect x="75" y="1" width="2" height="18" rx="1" fill={isSelf ? '#1a80c7' : '#94a3b8'} />
                        </svg>
                        <span style={{ fontSize: '9px', color: isDarkMode ? '#8696a0' : '#64748b' }}>Voice message ({duration}s)</span>
                      </div>
                    </div>
                  ) : isRx ? (
                    /* Prescription pill card */
                    (() => {
                      const parts = msgBodyText.replace('[PRESCRIPTION] ', '').split('|');
                      const medication = parts[0] || 'Medication';
                      const dosage = parts[1] || 'Instructions';
                      const renewal = parts[2] || '';
                      const prescId = parts[3] || null;

                      const prescObj = {
                        id: prescId || 1,
                        medication: medication,
                        dosage: dosage,
                        renewal_note: renewal,
                        patient_name: partnerName,
                        doctor_name: doctorName,
                        doctor_registration_number: doctorRegNum,
                        doctor_qualifications: doctorQualifications,
                        doctor_address: clinicAddress,
                        doctor_signature: doctorSignature
                      };

                      return (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '240px', padding: '4px 0', textAlign: 'left' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isDarkMode ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.06)', paddingBottom: '6px' }}>
                            <i className="fa-solid fa-file-prescription" style={{ color: '#f27224', fontSize: '18px' }}></i>
                            <span style={{ fontWeight: 'bold', fontSize: '11px', color: isDarkMode ? '#e2e8f0' : '#1e293b', letterSpacing: '0.02em' }}>OFFICIAL NECTACARE SCRIPT</span>
                          </div>
                          <div>
                            <div style={{ fontWeight: 'bold', fontSize: '13px', color: '#1a80c7' }}>{medication}</div>
                            <div style={{ fontSize: '11.5px', color: isDarkMode ? '#cbd5e1' : '#475569', marginTop: '2px', lineHeight: '1.3' }}>{dosage}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveViewPrescription(prescObj)}
                            style={{
                              background: '#10b981', color: 'white', border: 'none', padding: '6px 10px',
                              borderRadius: '6px', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer',
                              display: 'inline-flex', alignItems: 'center', gap: '4px', marginTop: '4px'
                            }}
                          >
                            <i className="fa-solid fa-print"></i> View & Print Official Script
                          </button>
                        </div>
                      );
                    })()

                  ) : msgBodyText.startsWith('[IMAGE]') ? (
                    (() => {
                      const src = msgBodyText.replace('[IMAGE] ', '').trim();

                      return (
                        <div style={{ marginTop: '4px' }}>
                          <img
                            src={src}
                            alt="Sent attachment"
                            style={{ 
                              maxWidth: '100%', 
                              maxHeight: '200px', 
                              borderRadius: '8px', 
                              cursor: 'pointer', 
                              border: isDarkMode ? '1px solid #374151' : '1px solid #e2e8f0' 
                            }}
                            onClick={() => setSelectedImagePreview(src)}
                          />
                        </div>
                      );
                    })()
                  ) : (
                    /* Text message bubble */
                    <p style={{ margin: 0, fontSize: '13px', lineHeight: '1.45' }}>{msgBodyText}</p>
                  )}
                  <span style={{
                    display: 'block',
                    textAlign: 'right',
                    fontSize: '9px',
                    color: isDarkMode ? '#8696a0' : '#64748b',
                    marginTop: '4px'
                  }}>
                    {(() => {
                      if (!msg.sent_at) return 'Just now';
                      try {
                        const d = new Date(msg.sent_at);
                        return isNaN(d.getTime()) ? 'Just now' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      } catch (e) {
                        return 'Just now';
                      }
                    })()}
                  </span>
                </div>
              </div>
            );
          })}

          <div ref={messagesEndRef} />
        </div>

        {/* WhatsApp-Style Bottom Input Area */}
        <footer style={{
          padding: '12px 20px', 
          borderTop: isDarkMode ? '1px solid #1e293b' : '1px solid #e9edef', 
          background: isDarkMode ? '#131c2e' : '#ffffff',
          display: 'flex', alignItems: 'center', gap: '12px'
        }}>
          {isReadOnlySession ? (
            <div style={{
              flex: 1,
              padding: '12px 18px',
              background: isDarkMode ? '#090d16' : '#f8fafc',
              border: isDarkMode ? '1px solid #1e293b' : '1px solid var(--border)',
              borderRadius: '16px',
              color: isDarkMode ? '#94a3b8' : 'var(--muted)',
              textAlign: 'center',
              fontSize: '13.5px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}>
              <i className="fa-solid fa-lock" style={{ color: '#1a80c7' }}></i>
              Consultation session completed (Read Only View)
            </div>
          ) : (
            <>
              {role === 'doctor' && !isRecording && (
                <button
                  type="button"
                  onClick={() => setShowPrescriptionModal(true)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: '#f27224', color: 'white', border: 'none',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', fontSize: '15px', transition: 'background 0.2s',
                    boxShadow: '0 4px 12px rgba(242, 114, 36, 0.25)', flexShrink: 0
                  }}
                  title="Give Prescription"
                >
                  <i className="fa-solid fa-file-prescription"></i>
                </button>
              )}

              {/* Audio Recording display status */}
              {isRecording ? (
                <div style={{ 
                  flex: 1, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '10px', 
                  background: isDarkMode ? '#090d16' : '#f0f2f5', 
                  padding: '10px 14px', 
                  borderRadius: '20px' 
                }}>
                  <span style={{
                    display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                    background: '#ef4444', animation: 'pulse 1s infinite'
                  }}></span>
                  <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#ef4444', flex: 1 }}>
                    Recording ({formatDuration(recordDuration)})
                  </span>
                  <button 
                    type="button" 
                    onClick={() => setIsRecording(false)}
                    style={{ background: 'transparent', border: 'none', color: isDarkMode ? '#94a3b8' : '#64748b', cursor: 'pointer', fontSize: '11px' }}
                  >
                    <i className="fa-solid fa-trash-can"></i> Discard
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSendMessage} style={{ flex: 1, display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {/* Attachment Button & Popover */}
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <button
                      type="button"
                      onClick={() => setShowAttachMenu(!showAttachMenu)}
                      style={{
                        background: 'none', border: 'none', color: isDarkMode ? '#94a3b8' : '#64748b',
                        fontSize: '18px', cursor: 'pointer', padding: '0 4px', display: 'flex', alignItems: 'center',
                        flexShrink: 0
                      }}
                      title="Attach Photo or File"
                    >
                      <i className="fa-solid fa-paperclip"></i>
                    </button>
                    {showAttachMenu && (
                      <div
                        style={{
                          position: 'absolute',
                          bottom: '45px',
                          left: '0',
                          background: isDarkMode ? '#1e293b' : '#ffffff',
                          border: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px rgba(0,0,0,0.25)',
                          padding: '6px',
                          zIndex: 1000,
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
                            cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '500',
                            color: isDarkMode ? '#f8fafc' : '#1e293b'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = isDarkMode ? '#334155' : '#f1f5f9'}
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
                            cursor: 'pointer', textAlign: 'left', fontSize: '13px', fontWeight: '500',
                            color: isDarkMode ? '#f8fafc' : '#1e293b'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = isDarkMode ? '#334155' : '#f1f5f9'}
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
                    style={{ display: 'none' }}
                    accept="image/*"
                    onChange={handleImageUpload}
                  />
                  <CameraModal
                    isOpen={isCameraOpen}
                    onClose={() => setIsCameraOpen(false)}
                    onCapture={async (capturedBase64) => {
                      if (!threadId) return;
                      try {
                        const msg = await api.sendMessage(token, threadId, `[IMAGE] ${capturedBase64}`);
                        setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
                      } catch (err) {
                        console.error('Failed to send camera photo', err);
                      }
                    }}
                  />

                  <input
                    type="text"
                    placeholder="Type your message here..."
                    value={textInput}
                    onChange={(e) => handleTextChange(e.target.value)}
                    style={{
                      flex: 1, 
                      background: isDarkMode ? '#090d16' : '#f0f2f5', 
                      border: isDarkMode ? '1px solid #374151' : 'none', 
                      color: isDarkMode ? 'white' : '#111b21',
                      padding: '10px 16px', borderRadius: '20px', fontSize: '13.5px', outline: 'none'
                    }}
                  />
                  {textInput.trim() && (
                    <button
                      type="submit"
                      style={{
                        background: '#1a80c7', color: 'white', border: 'none', width: '36px', height: '36px',
                        borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: '12px', flexShrink: 0
                      }}
                    >
                      <i className="fa-solid fa-paper-plane"></i>
                    </button>
                  )}
                </form>
              )}

              {/* Record Audio Button */}
              <button
                type="button"
                onClick={handleSendAudio}
                style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: isRecording ? '#ef4444' : (isDarkMode ? '#1e293b' : '#f0f2f5'), 
                  color: isRecording ? 'white' : (isDarkMode ? 'white' : '#64748b'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', fontSize: '14px', border: isDarkMode ? '1px solid #374151' : 'none',
                  flexShrink: 0
                }}
              >
                {isRecording ? <i className="fa-solid fa-circle-check"></i> : <i className="fa-solid fa-microphone"></i>}
              </button>
            </>
          )}
        </footer>

        {/* ── CALLING INTERFACE OVERLAY (WhatsApp calling screen) ── */}
        {activeCallType && (
          <div style={{
            position: 'absolute', inset: 0, background: '#090d16', zIndex: 100,
            display: 'flex', flexDirection: 'column', padding: '20px'
          }}>
            {/* Call Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 'bold' }}>
                  {activeCallType === 'video' ? 'Video Call' : 'Voice Call'}
                </h3>
                <p style={{ margin: '2px 0 0 0', color: '#94a3b8', fontSize: '12px' }}>
                  Secure connection
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveCallType(null)}
                style={{
                  background: '#1e293b', color: '#e2e8f0', border: 'none', padding: '6px 12px',
                  borderRadius: '12px', fontWeight: '600', fontSize: '11px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}
              >
                <i className="fa-solid fa-comments"></i> Back to Chat
              </button>
            </div>

            {/* Simulated calling frames */}
            <div style={{
              flex: 1, background: '#111827', borderRadius: '12px', border: '1px solid #1e293b',
              display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'hidden'
            }}>
              {activeCallType === 'video' ? (
                /* Video call layout */
                videoOff ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: '80px', height: '80px', borderRadius: '50%', background: '#1a80c7',
                      display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '28px',
                      fontWeight: 'bold', margin: '0 auto 12px', color: 'white'
                    }}>
                      {partnerName ? partnerName[0] : 'U'}
                    </div>
                    <h4 style={{ fontSize: '13px' }}>Camera Disabled</h4>
                  </div>
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', background: '#1f2937' }}>
                    {stream ? (
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
                      />
                    ) : (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ animation: 'pulse 2s infinite', fontSize: '48px', marginBottom: '12px' }}>🫀</div>
                        <h4 style={{ fontSize: '13px' }}>Connecting feeds...</h4>
                      </div>
                    )}
                  </div>
                )
              ) : (
                /* Voice call layout */
                <div style={{ textAlign: 'center' }}>
                  <div style={{
                    width: '100px', height: '100px', borderRadius: '50%', background: '#1a80c7',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    fontSize: '40px', fontWeight: 'bold', margin: '0 auto 16px', animation: 'pulse 2s infinite'
                  }}>
                    <i className="fa-solid fa-user" style={{ color: 'white' }}></i>
                  </div>
                  <h3 style={{ fontSize: '15px' }}>Encrypted Call</h3>
                  <p style={{ color: '#94a3b8', fontSize: '12px' }}>Nectacare Secure Audio</p>
                </div>
              )}

              {/* Local Video PIP window for Video Calls */}
              {activeCallType === 'video' && stream && !videoOff && (
                <div style={{
                  position: 'absolute', bottom: '16px', right: '16px', width: '110px', height: '80px',
                  borderRadius: '8px', overflow: 'hidden', border: '2px solid white', background: 'black',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.5)'
                }}>
                  <video
                    autoPlay
                    playsInline
                    muted
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    ref={(el) => {
                      if (el) el.srcObject = stream;
                    }}
                  />
                </div>
              )}
            </div>

            {/* Call Control panel */}
            <div style={{
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '12px', marginTop: '20px'
            }}>
              <button
                type="button"
                onClick={handleToggleMute}
                style={{
                  width: '44px', height: '44px', borderRadius: '50%', border: 'none',
                  background: muted ? '#ef4444' : '#1e293b', color: 'white', cursor: 'pointer', fontSize: '16px',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'background 0.2s'
                }}
              >
                {muted ? <i className="fa-solid fa-microphone-slash"></i> : <i className="fa-solid fa-microphone"></i>}
              </button>

              {activeCallType === 'video' && (
                <button
                  type="button"
                  onClick={handleToggleVideo}
                  style={{
                    width: '44px', height: '44px', borderRadius: '50%', border: 'none',
                    background: videoOff ? '#ef4444' : '#1e293b', color: 'white', cursor: 'pointer', fontSize: '16px',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'background 0.2s'
                  }}
                >
                  {videoOff ? <i className="fa-solid fa-video-slash"></i> : <i className="fa-solid fa-video"></i>}
                </button>
              )}

              <button
                type="button"
                onClick={() => setActiveCallType(null)} // return to chat
                style={{
                  width: '44px', height: '44px', borderRadius: '50%', border: 'none',
                  background: '#1e293b', color: 'white', cursor: 'pointer', fontSize: '16px',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'background 0.2s'
                }}
                title="Open Chat"
              >
                <i className="fa-solid fa-comments"></i>
              </button>

              <button
                type="button"
                onClick={onEndCall}
                style={{
                  width: '100px', height: '44px', borderRadius: '22px', border: 'none',
                  background: '#ef4444', color: 'white', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold',
                  display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px', transition: 'background 0.2s'
                }}
              >
                <i className="fa-solid fa-phone-slash"></i> End
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── OFFICIAL NECTACARE PRESCRIPTION ISSUING MODAL ── */}
      {showPrescriptionModal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(5, 7, 12, 0.85)',
          zIndex: 20000, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '12px', backdropFilter: 'blur(6px)', overflowY: 'auto'
        }}>
          <div style={{
            background: '#ffffff', color: '#0f172a', borderRadius: '8px',
            width: '100%', maxWidth: '440px', padding: '14px 16px', boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
            display: 'flex', flexDirection: 'column', gap: '8px', fontFamily: "'Inter', Arial, sans-serif"
          }}>
            {/* Header controls bar */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0D2B68', paddingBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-file-prescription" style={{ color: '#EF6C00', fontSize: '16px' }}></i>
                <h3 style={{ margin: 0, fontSize: '13px', fontWeight: '800', color: '#0D2B68' }}>
                  Issue Official NectaCare Prescription
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer', color: '#64748b' }}
              >✕</button>
            </div>

            {/* ═══ Precision Unstretched Prescription Paper Container ═══ */}
            <div className="nectacare-prescription-paper" style={{
              position: 'relative',
              width: '100%',
              maxWidth: '400px',
              aspectRatio: '723 / 1024',
              backgroundImage: 'url(/nectacare_official_prescription_template.png)',
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
              borderRadius: '4px',
              boxShadow: '0 8px 25px rgba(0,0,0,0.25)',
              fontFamily: "'Inter', Arial, sans-serif",
              boxSizing: 'border-box',
              overflow: 'hidden',
              margin: '0 auto',
              maxHeight: '76vh'
            }}>
              {/* Top-left Official NectaCare (Pvt) Ltd Logo Overlay */}
              <div style={{
                position: 'absolute', top: '3.2%', left: '5.2%', width: '32%', height: '17.5%',
                display: 'flex', alignItems: 'center', justifyContent: 'flex-start', background: '#ffffff'
              }}>
                <img
                  src="/nectacare-logo.png"
                  alt="NECTACARE (Pvt) Ltd"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </div>

              {/* Precision Aligned Input Overlays */}

              {/* 1. Patient Name (Non-bold) */}
              <div style={{
                position: 'absolute', top: '27.4%', left: '25.0%', width: '68.5%', height: '3.8%',
                display: 'flex', alignItems: 'center', fontWeight: '500', color: '#0F172A', fontSize: '11.5px', textTransform: 'uppercase'
              }}>
                {partnerName}
              </div>

              {/* 2. Patient Address (Editable Input, Non-bold) */}
              <div style={{
                position: 'absolute', top: '31.6%', left: '25.0%', width: '68.5%', height: '5.2%',
                display: 'flex', alignItems: 'center'
              }}>
                <input
                  type="text"
                  placeholder="Enter Patient Address..."
                  value={prescPatientAddress}
                  onChange={(e) => setPrescPatientAddress(e.target.value)}
                  style={{
                    width: '95%', height: '80%', border: '1px dashed #3b82f6', borderRadius: '3px',
                    padding: '2px 4px', fontSize: '10px', fontWeight: '500', color: '#0F172A', background: 'rgba(239, 246, 255, 0.85)', outline: 'none'
                  }}
                />
              </div>

              {/* 3. Age If Under 12 (Editable Input, Non-bold) */}
              <div style={{
                position: 'absolute', top: '37.6%', left: '61.5%', width: '13.5%', height: '4.2%',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <input
                  type="text"
                  placeholder="Age"
                  value={prescPatientAge}
                  onChange={(e) => setPrescPatientAge(e.target.value)}
                  style={{
                    width: '90%', height: '80%', border: '1px dashed #3b82f6', borderRadius: '3px',
                    textAlign: 'center', fontSize: '10px', fontWeight: '500', color: '#0F172A', background: 'rgba(239, 246, 255, 0.85)', outline: 'none'
                  }}
                />
              </div>

              {/* 4. Prescribing Doctor Practice Number / AHFOZ (Editable Input, Non-bold) */}
              <div style={{
                position: 'absolute', top: '51.5%', left: '75.8%', width: '18.5%', height: '6.0%',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                <input
                  type="text"
                  value={doctorRegNum}
                  onChange={(e) => setDoctorRegNum(e.target.value)}
                  placeholder="AHFOZ 40289"
                  style={{
                    width: '90%', height: '75%', textAlign: 'center', border: '1px dashed #3b82f6', borderRadius: '3px',
                    fontWeight: '500', fontSize: '10px', color: '#0F172A', background: 'rgba(239, 246, 255, 0.85)', outline: 'none'
                  }}
                />
              </div>

              {/* 5. Drugs Prescribed (Single Line Item per drug, Non-bold) */}
              <div style={{
                position: 'absolute', top: '46.5%', left: '6.0%', width: '68.0%', height: '29.5%',
                padding: '3px 4px', display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1px' }}>
                  <span style={{ fontSize: '8px', fontWeight: '700', color: '#0D2B68' }}>PRESCRIBED ITEMS:</span>
                  {prescDrugs.length < 5 && (
                    <button
                      type="button"
                      onClick={() => setPrescDrugs([...prescDrugs, { name: '' }])}
                      style={{ background: '#EF6C00', color: 'white', border: 'none', padding: '1px 5px', borderRadius: '2px', fontSize: '8px', fontWeight: 'bold', cursor: 'pointer' }}
                    >
                      + Add Item
                    </button>
                  )}
                </div>

                {prescDrugs.map((drug, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '3px', alignItems: 'center', background: 'rgba(255, 255, 255, 0.95)', padding: '2px 4px', borderRadius: '3px', border: '1px solid #93c5fd' }}>
                    <span style={{ fontSize: '9px', color: '#EF6C00', fontWeight: '600' }}>#{idx + 1}</span>
                    <input
                      type="text"
                      required
                      placeholder="Drug Name & Strength / Dosage (e.g. Amoxicillin 500mg TDS)"
                      value={drug.name}
                      onChange={(e) => {
                        const updated = [...prescDrugs];
                        updated[idx].name = e.target.value;
                        setPrescDrugs(updated);
                      }}
                      style={{ flex: 1, padding: '2px 4px', borderRadius: '2px', border: '1px solid #cbd5e1', fontSize: '9px', fontWeight: '500', outline: 'none' }}
                    />
                    {prescDrugs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setPrescDrugs(prescDrugs.filter((_, i) => i !== idx))}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '9px', padding: '0 2px' }}
                      >✕</button>
                    )}
                  </div>
                ))}
              </div>

              {/* 6. Doctor Signature (Saved Signature from Profile) */}
              <div style={{
                position: 'absolute', top: '80.2%', left: '6.0%', width: '34.0%', height: '3.8%',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}>
                {doctorSignature ? (
                  <img src={doctorSignature} alt="Doctor Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
                ) : (
                  <span style={{ fontSize: '8.5px', color: '#64748B', fontStyle: 'italic' }}>Digitally Signed</span>
                )}
              </div>

              {/* 7. Date (Non-bold) */}
              <div style={{
                position: 'absolute', top: '80.2%', left: '46.5%', width: '28.0%', height: '3.8%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', color: '#0F172A', fontSize: '11.5px'
              }}>
                {new Date().toLocaleDateString('en-GB')}
              </div>

              {/* 8. Doctor Name ONLY (Non-bold, aligned) */}
              <div style={{
                position: 'absolute', top: '84.8%', left: '25.0%', width: '68.5%', height: '7.0%',
                display: 'flex', alignItems: 'center', fontWeight: '500', fontSize: '11.5px', color: '#0F172A'
              }}>
                {doctorName || 'Dr. Medical Officer'}
              </div>
            </div>


            {prescError && (
              <div style={{ color: '#ef4444', fontSize: '11px', fontWeight: '600', textAlign: 'center' }}>
                {prescError}
              </div>
            )}

            {/* Redesigned Transparent Action Buttons with Yellow Border for Issue */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button
                type="button"
                onClick={() => setShowPrescriptionModal(false)}
                style={{
                  padding: '5px 14px', borderRadius: '5px', border: '1px solid #cbd5e1',
                  background: 'transparent', color: '#64748b', fontWeight: '600', fontSize: '11px', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleIssuePrescription}
                style={{
                  padding: '5px 16px', borderRadius: '5px',
                  border: '1.5px solid #eab308', background: 'transparent', color: '#d97706',
                  fontWeight: '600', fontSize: '11px', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  transition: 'all 0.2s ease'
                }}
              >
                <i className="fa-solid fa-paper-plane" style={{ fontSize: '10px' }}></i> Issue
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Official Prescription Printable Overlay Modal */}
      {activeViewPrescription && (
        <NectaCarePrescriptionTemplate
          prescription={activeViewPrescription}
          onClose={() => setActiveViewPrescription(null)}
        />
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
    </>
  );
}
