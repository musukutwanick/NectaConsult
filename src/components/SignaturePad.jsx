import { useRef, useState, useEffect } from 'react';

export default function SignaturePad({ initialSignature, onSave, height = 160 }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid line for reference
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    ctx.setLineDash([]); // reset line dash

    // Preload initial signature if exists
    if (initialSignature && initialSignature.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        setHasDrawn(true);
      };
      img.src = initialSignature;
    }
  }, [initialSignature]);

  function getCoordinates(e) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
  }

  function startDrawing(e) {
    e.preventDefault();
    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = '#1d2c48'; // Deep blue/dark ink color
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const { x, y } = getCoordinates(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function stopDrawing(e) {
    if (!isDrawing) return;
    if (e) e.preventDefault();
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (canvas && onSave) {
      const dataUrl = canvas.toDataURL('image/png');
      onSave(dataUrl);
    }
  }

  function handleClear() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Redraw reference line
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(20, canvas.height - 30);
    ctx.lineTo(canvas.width - 20, canvas.height - 30);
    ctx.stroke();
    ctx.setLineDash([]);

    setHasDrawn(false);
    if (onSave) onSave('');
  }

  return (
    <div className="signature-pad-container" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        position: 'relative',
        border: '2px dashed #cbd5e1',
        borderRadius: '10px',
        background: '#ffffff',
        overflow: 'hidden',
        touchAction: 'none'
      }}>
        <canvas
          ref={canvasRef}
          width={500}
          height={height}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{ width: '100%', height: `${height}px`, display: 'block', cursor: 'crosshair' }}
        />
        {!hasDrawn && (
          <div style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#94a3b8',
            fontSize: '13px',
            fontWeight: '500'
          }}>
            <i className="fa-solid fa-pen-nib" style={{ marginRight: '6px' }}></i>
            Draw signature using mouse or touch here
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          onClick={handleClear}
          style={{
            background: 'none',
            border: '1px solid #cbd5e1',
            color: '#64748b',
            fontSize: '12px',
            padding: '4px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: '600'
          }}
        >
          <i className="fa-solid fa-eraser" style={{ marginRight: '4px' }}></i>
          Clear
        </button>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic' }}>
          Digitally signed via mouse / touch pad
        </span>
      </div>
    </div>
  );
}
