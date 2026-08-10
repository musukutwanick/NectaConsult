import { createPortal } from 'react-dom';

export default function NectaCarePrescriptionTemplate({ prescription, patient, doctor, onClose }) {
  // Parse drugs json if exists or construct array from medication & dosage
  let drugsList = [];
  try {
    if (prescription?.drugs_json) {
      drugsList = JSON.parse(prescription.drugs_json);
    }
  } catch (e) {
    drugsList = [];
  }

  if (drugsList.length === 0 && (prescription?.medication || prescription?.dosage || prescription?.title)) {
    const med = prescription.medication || prescription.title || 'Prescribed Medication';
    const dos = prescription.dosage ? ` - Dosage: ${prescription.dosage}` : '';
    drugsList = [{
      name: `${med}${dos}`
    }];
  }

  const patientName = patient?.title || patient?.user?.full_name || prescription?.patient_name || '';
  const patientAddress = patient?.address || prescription?.patient_address || '';
  const patientAge = prescription?.patient_age || (patient?.date_of_birth ? getAge(patient.date_of_birth) : '');

  const doctorName = doctor?.title || doctor?.user?.full_name || prescription?.doctor_name || '';
  const doctorRegNum = doctor?.doctor_registration_number || prescription?.doctor_registration_number || '';
  const doctorQualifications = doctor?.doctor_qualifications || prescription?.doctor_qualifications || '';
  const doctorAddress = doctor?.clinic_address || prescription?.doctor_address || prescription?.clinic_address || '';
  const doctorSignature = doctor?.signature_data || prescription?.doctor_signature || '';
  const dateStr = prescription?.created_at ? new Date(prescription.created_at).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB');

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

  function handlePrint() {
    window.print();
  }

  /* ── Canvas Download using exact template background (723x1024) ── */
  function handleDownloadImage() {
    const W = 723, H = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    const bgImg = new Image();
    bgImg.crossOrigin = 'anonymous';
    bgImg.src = '/nectacare_official_prescription_template.png';

    bgImg.onload = () => {
      // 1. Draw background template
      ctx.drawImage(bgImg, 0, 0, W, H);
      renderTextAndDownload();

      function renderTextAndDownload() {
        ctx.fillStyle = '#0F172A';

        // 1. Patient Name (Non-bold)
        ctx.font = '500 14px "Inter", sans-serif';
        ctx.fillText(patientName.toUpperCase(), 185, 304);

        // 2. Patient Address (Non-bold)
        ctx.font = '400 13px "Inter", sans-serif';
        ctx.fillText(patientAddress, 185, 350);

        // 3. Age If Under 12
        if (patientAge) {
          ctx.font = '500 14px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(patientAge, 490, 412);
          ctx.textAlign = 'left';
        }

        // 4. Practice Number / AHFOZ (Prescribing Doctor Number)
        if (doctorRegNum) {
          ctx.font = '500 13px "Inter", sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText(doctorRegNum, 610, 560);
          ctx.textAlign = 'left';
        }

        // 5. Prescribed Drugs List (Non-bold)
        let startY = 500;
        drugsList.forEach((drug, idx) => {
          ctx.fillStyle = '#0F172A';
          ctx.font = '500 13px "Inter", sans-serif';
          ctx.fillText(`${idx + 1}. ${drug.name || drug.medication}`, 50, startY);
          startY += 24;
        });

        // 6. Date (Non-bold)
        ctx.fillStyle = '#0F172A';
        ctx.font = '500 14px "Inter", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dateStr, 440, 840);
        ctx.textAlign = 'left';

        // 7. Doctor Details Block (Name, Qualifications under name, Address below qualifications)
        ctx.fillStyle = '#0F172A';
        ctx.textAlign = 'left';
        let docY = 890;

        ctx.font = '600 13px "Inter", sans-serif';
        ctx.fillText(doctorName || 'Doctor', 185, docY);

        if (doctorQualifications) {
          docY += 16;
          ctx.font = '500 11px "Inter", sans-serif';
          ctx.fillStyle = '#334155';
          ctx.fillText(doctorQualifications, 185, docY);
        }

        if (doctorAddress) {
          docY += 15;
          ctx.font = '400 10px "Inter", sans-serif';
          ctx.fillStyle = '#475569';
          ctx.fillText(doctorAddress, 185, docY);
        }

        // 8. Doctor Signature
        if (doctorSignature && doctorSignature.startsWith('data:image')) {
          const sigImg = new Image();
          sigImg.onload = () => {
            ctx.drawImage(sigImg, 50, 810, 180, 42);
            triggerDownload();
          };
          sigImg.onerror = () => triggerDownload();
          sigImg.src = doctorSignature;
        } else {
          ctx.fillStyle = '#64748B';
          ctx.font = 'italic 11px "Inter", sans-serif';
          ctx.fillText(`Digitally Signed`, 50, 836);
          triggerDownload();
        }
      }
    };

    function triggerDownload() {
      const link = document.createElement('a');
      link.download = `NectaCare_Prescription_${(patientName || 'Patient').replace(/\s+/g, '_')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    }
  }

  return createPortal(
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', background: 'rgba(15, 23, 42, 0.85)', backdropFilter: 'blur(6px)',
      display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 999999999, overflowY: 'auto', padding: '16px'
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '420px', width: '100%', maxHeight: '96vh' }}>

        {/* Action Header Bar */}
        <div className="no-print" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '2px 0'
        }}>
          <button type="button" onClick={onClose} style={{
            background: 'transparent',
            border: '1.5px solid #eab308',
            color: '#d97706',
            padding: '6px 16px',
            borderRadius: '8px',
            fontWeight: 'bold',
            fontSize: '13px',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            ← Back
          </button>

          <button
            type="button"
            onClick={handleDownloadImage}
            title="Download Prescription Sheet"
            style={{
              background: 'transparent',
              border: '1.5px solid #eab308',
              color: '#d97706',
              padding: '6px 14px',
              borderRadius: '8px',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <i className="fa-solid fa-download"></i>
          </button>
        </div>

        {/* ═══ Precision Unstretched Prescription Paper Container ═══ */}
        <div className="nectacare-prescription-paper" style={{
          position: 'relative',
          width: '100%',
          maxWidth: '420px',
          aspectRatio: '723 / 1024',
          backgroundImage: 'url(/nectacare_official_prescription_template.png)',
          backgroundSize: 'contain',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          borderRadius: '4px',
          boxShadow: '0 10px 35px rgba(0,0,0,0.3)',
          fontFamily: "'Inter', Arial, sans-serif",
          boxSizing: 'border-box',
          overflow: 'hidden',
          margin: '0 auto'
        }}>
          {/* Exact Positioned Non-Bold Text Overlays */}

          {/* 1. Patient Name (Non-bold) */}
          <div style={{
            position: 'absolute', top: '27.4%', left: '25.0%', width: '68.5%', height: '3.8%',
            display: 'flex', alignItems: 'center', fontWeight: '500', color: '#0F172A', fontSize: '11.5px', textTransform: 'uppercase'
          }}>
            {patientName}
          </div>

          {/* 2. Patient Address (Non-bold) */}
          <div style={{
            position: 'absolute', top: '31.6%', left: '25.0%', width: '68.5%', height: '5.2%',
            display: 'flex', alignItems: 'center', fontWeight: '400', color: '#0F172A', fontSize: '11px', lineHeight: '1.2'
          }}>
            {patientAddress}
          </div>

          {/* 3. Age If Under 12 (Non-bold) */}
          <div style={{
            position: 'absolute', top: '37.6%', left: '61.5%', width: '13.5%', height: '4.2%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', color: '#0F172A', fontSize: '11.5px'
          }}>
            {patientAge}
          </div>

          {/* 4. Prescribing Doctor Practice Number / AHFOZ (Non-bold) */}
          <div style={{
            position: 'absolute', top: '51.5%', left: '75.8%', width: '18.5%', height: '6.0%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', color: '#0F172A', fontSize: '11px'
          }}>
            {doctorRegNum}
          </div>

          {/* 5. Drugs Prescribed (Non-bold) */}
          <div style={{
            position: 'absolute', top: '46.5%', left: '6.0%', width: '68.0%', height: '29.5%',
            padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: '6px', overflowY: 'auto'
          }}>
            {drugsList.map((item, idx) => (
              <div key={idx} style={{ fontSize: '11.5px', fontWeight: '500', color: '#0F172A', paddingBottom: '3px', borderBottom: idx < drugsList.length - 1 ? '1px dashed #cbd5e1' : 'none' }}>
                {idx + 1}. {item.name || item.medication}
              </div>
            ))}
          </div>

          {/* 6. Doctor Signature */}
          <div style={{
            position: 'absolute', top: '80.2%', left: '6.0%', width: '34.0%', height: '3.8%',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {doctorSignature ? (
              <img src={doctorSignature} alt="Doctor Signature" style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '9px', color: '#64748B', fontStyle: 'italic' }}>Digitally Signed</span>
            )}
          </div>

          {/* 7. Date (Non-bold) */}
          <div style={{
            position: 'absolute', top: '80.2%', left: '46.5%', width: '28.0%', height: '3.8%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '500', color: '#0F172A', fontSize: '11.5px'
          }}>
            {dateStr}
          </div>

          {/* 8. Doctor Details Block (Name, Qualifications under name, Address below qualifications) */}
          <div style={{
            position: 'absolute', top: '84.8%', left: '25.0%', width: '68.5%', height: '12.0%',
            display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', color: '#0F172A',
            textAlign: 'left'
          }}>
            <div style={{ fontWeight: '600', fontSize: '11.5px', color: '#0F172A', lineHeight: '1.2' }}>
              {doctorName || 'Doctor'}
            </div>

            {doctorQualifications ? (
              <div style={{ fontWeight: '500', fontSize: '10.5px', color: '#334155', marginTop: '2px', lineHeight: '1.2' }}>
                {doctorQualifications}
              </div>
            ) : null}

            {doctorAddress ? (
              <div style={{ fontWeight: '400', fontSize: '10px', color: '#475569', marginTop: '2px', lineHeight: '1.2' }}>
                {doctorAddress}
              </div>
            ) : null}
          </div>
        </div>

      </div>
    </div>,
    document.body
  );
}
