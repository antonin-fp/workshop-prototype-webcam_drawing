// --- ÉLÉMENTS DOM ---
const video = document.getElementById('videoElement');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const photoCanvas = document.getElementById('photoCanvas');
const photoCtx = photoCanvas.getContext('2d');
const mainContainer = document.getElementById('main-container');
const cameraWrapper = document.getElementById('camera-wrapper');

// UI
const uiWrapper = document.getElementById('ui-wrapper');
const toolbar = document.getElementById('toolbar');
const toggleIcon = document.getElementById('toggleIcon');

// Panels
const settingsPanel = document.getElementById('settingsPanel');
const eraserPanel = document.getElementById('eraserPanel');

// Boutons
const sideSwitchBtn = document.getElementById('sideSwitchBtn');
const toggleModeBtn = document.getElementById('toggleModeBtn');
const switchCamBtn = document.getElementById('switchCamBtn');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const saveBtn = document.getElementById('saveBtn');
const trashBtn = document.getElementById('trashBtn');
const toggleMenuBtn = document.getElementById('toggleMenuBtn');

// Inputs
const colorBtn = document.getElementById('colorBtn');
const colorIcon = document.getElementById('colorIcon');
const colorPicker = document.getElementById('colorPicker');
const lineWidthRange = document.getElementById('lineWidth');
const widthValue = document.getElementById('widthValue');
const eraserWidthRange = document.getElementById('eraserWidth');
const eraserWidthValue = document.getElementById('eraserWidthValue');

let isDrawing = false;
let lastX = 0; let lastY = 0;
let currentMode = 'pen';
let facingMode = 'environment';
let currentStream = null;
let isLiveMode = true;
let isToolbarCollapsed = false;

// Init
ctx.strokeStyle = colorPicker.value;
colorIcon.style.color = colorPicker.value;
updatePanelPosition(); 
settingsPanel.classList.remove('hidden-panel');


// --- UI LOGIC ---

function updatePanelPosition() {
    if (uiWrapper.classList.contains('right')) {
        settingsPanel.classList.add('anchor-right');
        settingsPanel.classList.remove('anchor-left');
        eraserPanel.classList.add('anchor-right');
        eraserPanel.classList.remove('anchor-left');
    } else {
        settingsPanel.classList.add('anchor-left');
        settingsPanel.classList.remove('anchor-right');
        eraserPanel.classList.add('anchor-left');
        eraserPanel.classList.remove('anchor-right');
    }
}

sideSwitchBtn.addEventListener('click', () => {
    uiWrapper.classList.toggle('right');
    uiWrapper.classList.toggle('left');
    updatePanelPosition();
});

toggleMenuBtn.addEventListener('click', () => {
    isToolbarCollapsed = !isToolbarCollapsed;
    toolbar.classList.toggle('collapsed');
    toggleIcon.className = isToolbarCollapsed ? "fa-solid fa-chevron-up" : "fa-solid fa-chevron-down";
});

penBtn.addEventListener('click', () => {
    currentMode = 'pen';
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = colorPicker.value;
    
    penBtn.classList.add('active');
    eraserBtn.classList.remove('active');
    
    settingsPanel.classList.remove('hidden-panel');
    eraserPanel.classList.add('hidden-panel');
});

eraserBtn.addEventListener('click', () => {
    currentMode = 'eraser';
    ctx.globalCompositeOperation = 'destination-out';
    
    eraserBtn.classList.add('active');
    penBtn.classList.remove('active');
    
    eraserPanel.classList.remove('hidden-panel');
    settingsPanel.classList.add('hidden-panel');
});

colorBtn.addEventListener('click', () => colorPicker.click());
colorPicker.addEventListener('input', (e) => {
    const col = e.target.value;
    colorIcon.style.color = col;
    if (currentMode === 'pen') ctx.strokeStyle = col;
});

lineWidthRange.addEventListener('input', (e) => widthValue.textContent = e.target.value + 'px');
eraserWidthRange.addEventListener('input', (e) => eraserWidthValue.textContent = e.target.value + 'px');


// --- LAYOUT & CAM ---

function resizeLayout() {
    const availableW = mainContainer.clientWidth;
    const availableH = mainContainer.clientHeight;
    if (video.videoWidth === 0) return;

    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = availableW / availableH;
    let finalW, finalH;

    if (containerRatio > videoRatio) {
        finalH = availableH; finalW = finalH * videoRatio;
    } else {
        finalW = availableW; finalH = finalW / videoRatio;
    }
    finalW = Math.floor(finalW); finalH = Math.floor(finalH);

    cameraWrapper.style.width = finalW + 'px';
    cameraWrapper.style.height = finalH + 'px';
    if (canvas.width !== finalW || canvas.height !== finalH) {
        canvas.width = finalW; canvas.height = finalH;
    }
    photoCanvas.width = finalW; photoCanvas.height = finalH;
}
window.addEventListener('resize', resizeLayout);

async function startCamera() {
    if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } } 
        });
        currentStream = stream;
        video.srcObject = stream;
        video.classList.remove('mirrored'); 
        video.onloadedmetadata = () => { video.play(); setTimeout(resizeLayout, 100); };
    } catch (err) { console.error(err); }
}

switchCamBtn.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    if (!isLiveMode) toggleMode();
    startCamera();
});

function toggleMode() {
    isLiveMode = !isLiveMode;
    resizeLayout();
    if (isLiveMode) {
        video.classList.remove('hidden'); photoCanvas.classList.add('hidden');
        toggleModeBtn.innerHTML = '<i class="fa-solid fa-snowflake"></i>';
    } else {
        photoCtx.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);
        video.classList.add('hidden'); photoCanvas.classList.remove('hidden');
        toggleModeBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
    }
}
toggleModeBtn.addEventListener('click', toggleMode);


// --- DESSIN ---

trashBtn.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));

function startDrawing(e) {
    isDrawing = true;
    const rect = canvas.getBoundingClientRect();
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    lastX = cx - rect.left; lastY = cy - rect.top;
}

function draw(e) {
    if (!isDrawing) return;
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    const cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    const x = cx - rect.left; const y = cy - rect.top;

    ctx.lineWidth = (currentMode === 'pen') ? lineWidthRange.value : eraserWidthRange.value;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(x, y); ctx.stroke();
    lastX = x; lastY = y;
}

canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0 || e.pointerType === 'touch') {
        canvas.setPointerCapture(e.pointerId); startDrawing(e);
    }
});
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerup', (e) => {
     canvas.releasePointerCapture(e.pointerId); isDrawing = false;
});

saveBtn.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width; tempCanvas.height = canvas.height;
    if (isLiveMode) tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    else tempCtx.drawImage(photoCanvas, 0, 0);
    tempCtx.drawImage(canvas, 0, 0);
    const link = document.createElement('a');
    link.download = `dessin-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
});

startCamera();