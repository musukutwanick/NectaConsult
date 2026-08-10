import React, { useState, useEffect, useRef } from 'react';

export default function CameraModal({ isOpen, onClose, onCapture }) {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState(null);
  const [facingMode, setFacingMode] = useState('user');
  const videoRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setCapturedImage(null);
      setCameraError(null);
      return;
    }
    startCamera(facingMode);
    return () => {
      stopCamera();
    };
  }, [isOpen, facingMode]);

  async function startCamera(mode) {
    stopCamera();
    setCameraError(null);

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError("Live camera preview is unavailable over unencrypted HTTP. Tap 'Device Camera / Gallery' below.");
      return;
    }

    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode },
        audio: false
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn("Camera facingMode access failed, trying simple video constraint", err);
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (fallbackErr) {
        console.warn("Camera access failed", fallbackErr);
        setCameraError("Webcam stream is disabled or unavailable. Tap 'Device Camera / Gallery' below.");
      }
    }
  }

  function stopCamera() {
    if (stream) {
      try {
        stream.getTracks().forEach(track => track.stop());
      } catch(e) {}
      setStream(null);
    }
  }

  function takeSnapshot() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImage(dataUrl);
  }

  function handleSend() {
    if (capturedImage) {
      onCapture(capturedImage);
      handleClose();
    }
  }

  function handleClose() {
    stopCamera();
    setCapturedImage(null);
    onClose();
  }

  function handleNativeCameraCapture(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onCapture(reader.result);
      handleClose();
    };
    reader.readAsDataURL(file);
  }

  if (!isOpen) return null;

  return (
    <div className="camera-modal-overlay" style={{
      position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.75)',
      zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px'
    }}>
      <div className="camera-modal-content" style={{
        background: '#1e293b', color: 'white', borderRadius: '16px',
        maxWidth: '480px', width: '100%', overflow: 'hidden', boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column'
      }}>
        {/* Header */}
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #334155' }}>
          <h3 style={{ margin: 0, fontSize: '16px', display: 'flex', alignItems: 'center', gap: '10px', color: '#f8fafc' }}>
            <i className="fa-solid fa-camera" style={{ color: '#3b82f6' }}></i> Take Photo
          </h3>
          <button onClick={handleClose} type="button" style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer', padding: '4px' }}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Hidden Native Device Camera Input */}
        <input
          type="file"
          ref={cameraInputRef}
          accept="image/*"
          capture="environment"
          onChange={handleNativeCameraCapture}
          style={{ display: 'none' }}
        />

        {/* Camera / Preview Area */}
        <div style={{ position: 'relative', width: '100%', background: '#0f172a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '280px', maxHeight: '360px', overflow: 'hidden' }}>
          {capturedImage ? (
            <img src={capturedImage} alt="Captured preview" style={{ maxWidth: '100%', maxHeight: '360px', objectFit: 'contain' }} />
          ) : cameraError ? (
            <div style={{ padding: '24px', textAlign: 'center', color: '#cbd5e1', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px' }}>
              <i className="fa-solid fa-camera-rotate" style={{ fontSize: '36px', color: '#94a3b8' }}></i>
              <p style={{ margin: 0, fontSize: '13.5px', color: '#cbd5e1', lineHeight: '1.4' }}>{cameraError}</p>
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                style={{
                  background: '#3b82f6', color: 'white', border: 'none',
                  padding: '12px 22px', borderRadius: '10px', cursor: 'pointer',
                  fontWeight: 700, fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '8px',
                  boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
                }}
              >
                <i className="fa-solid fa-camera"></i> Open Phone/Laptop Camera
              </button>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{ width: '100%', height: '100%', maxHeight: '360px', objectFit: 'cover' }}
              />
              <button
                type="button"
                title="Switch Camera"
                onClick={() => setFacingMode(prev => prev === 'user' ? 'environment' : 'user')}
                style={{
                  position: 'absolute', top: '12px', right: '12px',
                  background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none',
                  borderRadius: '50%', width: '36px', height: '36px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px'
                }}
              >
                <i className="fa-solid fa-rotate"></i>
              </button>
            </>
          )}
        </div>

        {/* Action Buttons */}
        <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', gap: '12px', background: '#1e293b', flexWrap: 'wrap' }}>
          {capturedImage ? (
            <>
              <button
                type="button"
                onClick={() => setCapturedImage(null)}
                style={{ background: '#475569', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <i className="fa-solid fa-rotate-left"></i> Retake
              </button>
              <button
                type="button"
                onClick={handleSend}
                style={{ background: '#22c55e', color: 'white', border: 'none', padding: '10px 24px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <i className="fa-solid fa-paper-plane"></i> Send Photo
              </button>
            </>
          ) : (
            <>
              {!cameraError && (
                <button
                  type="button"
                  onClick={takeSnapshot}
                  style={{
                    background: '#ef4444', color: 'white', border: 'none',
                    padding: '12px 24px', borderRadius: '30px', cursor: 'pointer',
                    fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px',
                    boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  <i className="fa-solid fa-camera"></i> Snap Photo
                </button>
              )}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                style={{
                  background: '#0284c7', color: 'white', border: 'none',
                  padding: '12px 20px', borderRadius: '30px', cursor: 'pointer',
                  fontWeight: 700, fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px'
                }}
              >
                <i className="fa-solid fa-mobile-screen-button"></i> Device Camera / Gallery
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
