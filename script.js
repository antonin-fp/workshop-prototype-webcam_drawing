const video = document.getElementById('videoElement');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');

// Contrôles
const clearBtn = document.getElementById('clearBtn');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const colorPicker = document.getElementById('colorPicker');
const lineWidthRange = document.getElementById('lineWidth');
const saveBtn = document.getElementById('saveBtn');
const switchCamBtn = document.getElementById('switchCamBtn');

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentMode = 'pen'; 

// --- CHANGEMENT ICI ---
// On initialise sur 'environment' (arrière) au lieu de 'user' (avant)
let facingMode = 'environment'; 
let currentStream = null;

// --- 1. Gestion de la Caméra ---

async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: facingMode, 
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        
        currentStream = stream;
        video.srcObject = stream;
        
        // Gestion du Miroir :
        // Si on commence sur 'environment', la classe .mirrored ne sera PAS ajoutée.
        // C'est parfait car on ne veut pas d'effet miroir sur la caméra arrière.
        if (facingMode === 'user') {
            video.classList.add('mirrored');
        } else {
            video.classList.remove('mirrored');
        }

        video.onloadedmetadata = () => {
            video.play();
        };
    } catch (err) {
        console.error("Erreur:", err);
        alert("Impossible d'accéder à la caméra. Vérifiez HTTPS.");
    }
}

switchCamBtn.addEventListener('click', () => {
    // Bascule entre les deux modes
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    startCamera();
});

// Redimensionnement du canvas
video.addEventListener('canplay', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
});

// --- 2. Gestion des Outils ---
function setTool(mode) {
    currentMode = mode;
    if (mode === 'pen') {
        penBtn.classList.add('active');
        eraserBtn.classList.remove('active');
    } else {
        eraserBtn.classList.add('active');
        penBtn.classList.remove('active');
    }
}
penBtn.addEventListener('click', () => setTool('pen'));
eraserBtn.addEventListener('click', () => setTool('eraser'));


// --- 3. Fonctions de Dessin ---
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getPos(e);
    lastX = pos.x;
    lastY = pos.y;
}

function draw(e) {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();

    const pos = getPos(e);
    
    ctx.lineWidth = lineWidthRange.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (currentMode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = colorPicker.value;
    }

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastX = pos.x;
    lastY = pos.y;
}

function stopDrawing() {
    isDrawing = false;
    ctx.globalCompositeOperation = 'source-over';
}

// Events
canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0 || e.pointerType === 'touch') {
        canvas.setPointerCapture(e.pointerId);
        startDrawing(e);
    }
});
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerup', (e) => {
     canvas.releasePointerCapture(e.pointerId);
     stopDrawing();
});

clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});


// --- 4. Sauvegarde Photo ---
saveBtn.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    if (facingMode === 'user') {
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
    } 

    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    tempCtx.drawImage(canvas, 0, 0);

    try {
        const date = new Date().toISOString().slice(0,19).replace(/[:T]/g, '-');
        const fileName = `dessin-${facingMode}-${date}.png`;

        const link = document.createElement('a');
        link.download = fileName;
        link.href = tempCanvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) {
        console.error("Erreur sauvegarde:", err);
    }
});

// Lancement initial
startCamera();