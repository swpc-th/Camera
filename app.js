(() => {
  'use strict';

  // ----- Config -----
  const FRAME_SRC = 'assets/frame.png';
  const OUTPUT_W = 1038;
  const OUTPUT_H = 1515;
  const COUNTDOWN_FROM = 3; // unused now (capture is instant) — kept in case countdown is wanted back
  // Photo window bounding box — must match assets/frame.png exactly.
  const WINDOW = { x: 136, y: 300, w: 755, h: 991 };

  // ----- Elements -----
  const video = document.getElementById('video');
  const frameOverlay = document.getElementById('frame-overlay');
  const cameraScreen = document.getElementById('camera-screen');
  const resultScreen = document.getElementById('result-screen');
  const captureBtn = document.getElementById('capture-btn');
  const switchBtn = document.getElementById('switch-btn');
  const retakeBtn = document.getElementById('retake-btn');
  const downloadBtn = document.getElementById('download-btn');
  const countdownEl = document.getElementById('countdown');
  const statusEl = document.getElementById('camera-status');
  const outputImage = document.getElementById('output-image');
  const workCanvas = document.getElementById('work-canvas');
  const inappHint = document.getElementById('inapp-hint');

  let currentStream = null;
  let facingMode = 'user';   // 'user' = front, 'environment' = back
  let isCapturing = false;
  let frameImg = null;
  let currentBlob = null;
  let currentImageUrl = null;

  // Heuristic: is this an in-app browser (LINE, Messenger, Instagram, etc.)?
  // These often block camera access or downloads even though they render the page.
  const isInAppBrowser = /Line|FBAN|FBAV|Instagram|MicroMessenger|Twitter/i.test(navigator.userAgent);
  if (inappHint) inappHint.style.display = isInAppBrowser ? 'block' : 'none';

  // ----- Preload frame template -----
  function preloadFrame() {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { frameImg = img; resolve(); };
      img.onerror = () => { frameImg = null; resolve(); }; // still allow app to run without frame
      img.src = FRAME_SRC;
    });
  }

  // ----- Camera -----
  async function startCamera(mode) {
    stopCamera();
    statusEl.textContent = 'กำลังขอสิทธิ์เข้าถึงกล้อง…';
    try {
      const constraints = {
        audio: false,
        video: {
          facingMode: { ideal: mode }
          // Intentionally no width/height/aspectRatio constraints here.
          // Forcing an exact resolution (especially an unusual ratio like
          // our card's 1060x1484) makes many phones digitally crop/zoom
          // into the sensor to satisfy it, instead of giving the real
          // field of view. We let the camera give its native stream and
          // do all cropping ourselves in composite() below, which already
          // handles any actual videoWidth/videoHeight correctly.
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      currentStream = stream;
      video.srcObject = stream;
      video.classList.toggle('mirrored', mode === 'user');
      statusEl.textContent = '';
    } catch (err) {
      console.error(err);
      statusEl.textContent = 'ไม่สามารถเข้าถึงกล้องได้ กรุณาอนุญาตการใช้งานกล้องในเบราว์เซอร์';
    }
  }

  function stopCamera() {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
      currentStream = null;
    }
  }

  switchBtn.addEventListener('click', () => {
    facingMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera(facingMode);
  });

  // ----- Capture (instant, no countdown) -----
  captureBtn.addEventListener('click', () => {
    if (isCapturing) return;
    isCapturing = true;
    captureBtn.disabled = true;
    composite();
    isCapturing = false;
    captureBtn.disabled = false;
    showScreen('result');
  });
  // ----- Composite photo + frame -----
  function composite() {
    workCanvas.width = OUTPUT_W;
    workCanvas.height = OUTPUT_H;
    const ctx = workCanvas.getContext('2d');

    // Layer 1: the card background is opaque frame art, so paint the photo
    // ONLY inside the window rect (cover-fit crop), not across the whole canvas.
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    const winRatio = WINDOW.w / WINDOW.h;
    const videoRatio = vw / vh;

    let sx, sy, sw, sh;
    if (videoRatio > winRatio) {
      sh = vh;
      sw = vh * winRatio;
      sx = (vw - sw) / 2;
      sy = 0;
    } else {
      sw = vw;
      sh = vw / winRatio;
      sx = 0;
      sy = (vh - sh) / 2;
    }

    ctx.save();
    ctx.beginPath();
    ctx.rect(WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
    ctx.clip();
    if (facingMode === 'user') {
      // mirror to match the on-screen preview
      ctx.translate(WINDOW.x * 2 + WINDOW.w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(video, sx, sy, sw, sh, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
    } else {
      ctx.drawImage(video, sx, sy, sw, sh, WINDOW.x, WINDOW.y, WINDOW.w, WINDOW.h);
    }
    ctx.restore();

    // Layer 2: frame template (the standee character + alley scene, with a face-shaped cutout)
    if (frameImg) {
      ctx.drawImage(frameImg, 0, 0, OUTPUT_W, OUTPUT_H);
    }

    // Turn the composited canvas into a real <img> so:
    // 1) iOS Safari's long-press "Save Image" context menu works (it does NOT work on <canvas>)
    // 2) we have a File/Blob ready for the Web Share API
    workCanvas.toBlob((blob) => {
      if (!blob) return;
      if (currentImageUrl) URL.revokeObjectURL(currentImageUrl);
      currentBlob = blob;
      currentImageUrl = URL.createObjectURL(blob);
      outputImage.src = currentImageUrl;
    }, 'image/png', 0.95);
  }

  // ----- Screens -----
  function showScreen(name) {
    if (name === 'result') {
      cameraScreen.classList.remove('active');
      resultScreen.classList.add('active');
    } else {
      resultScreen.classList.remove('active');
      cameraScreen.classList.add('active');
    }
  }

  retakeBtn.addEventListener('click', () => {
    showScreen('camera');
  });

  // ----- Save / Download -----
  // Priority order:
  // 1) Web Share API with a File — on iOS/Android this opens the native share
  //    sheet with a direct "Save Image" / "Save to Photos" option. This is the
  //    only reliable one-tap way to land the PNG in the camera roll on iOS.
  // 2) Classic <a download> — works on desktop and most Android browsers.
  // 3) Fallback: tell the user to long-press the <img> above (works everywhere,
  //    including in-app browsers that block downloads/share).
  downloadBtn.addEventListener('click', async () => {
    if (!currentBlob) return;
    const filename = `digital-card-${Date.now()}.png`;
    const file = new File([currentBlob], filename, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Digital Card' });
        return;
      } catch (err) {
        if (err && err.name === 'AbortError') return; // user cancelled share sheet
        // fall through to next method on real failures
      }
    }

    try {
      const url = URL.createObjectURL(currentBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error(err);
      statusEl && (statusEl.textContent = '');
    }
  });

  // ----- Init -----
  (async function init() {
    await preloadFrame();
    frameOverlay.src = FRAME_SRC;
    await startCamera(facingMode);
  })();
})();
