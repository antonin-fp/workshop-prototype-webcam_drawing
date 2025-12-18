const video = document.getElementById('videoElement');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
// NOUVEAU : Référence au canvas photo
const photoCanvas = document.getElementById('photoCanvas');
const photoCtx = photoCanvas.getContext('2d');

// Contrôles
const clearBtn = document.getElementById('clearBtn');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const colorPicker = document.getElementById('colorPicker');
const lineWidthRange = document.getElementById('lineWidth');
const saveBtn = document.getElementById('saveBtn');
const switchCamBtn = document.getElementById('switchCamBtn');
const toggleModeBtn = document.getElementById('toggleModeBtn'); // NOUVEAU

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentMode = 'pen';
let facingMode = 'environment';
let currentStream = null;
// NOUVEAU : État pour savoir si on est en direct ou sur photo figée
let isLiveMode = true;


// --- 1. Gestion de la Caméra ---

async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        currentStream = stream;
        video.srcObject = stream;

        if (facingMode === 'user') {
            video.classList.add('mirrored');
        } else {
            video.classList.remove('mirrored');
        }
        video.onloadedmetadata = () => { video.play(); };
    } catch (err) {
        console.error("Erreur:", err);
        alert("Impossible d'accéder à la caméra.");
    }
}

switchCamBtn.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    // Si on change de caméra, on force le retour au mode direct
    if (!isLiveMode) toggleMode();
    startCamera();
});

// Redimensionnement des DEUX canvas quand la vidéo change
video.addEventListener('canplay', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    // Le canvas photo doit aussi avoir la bonne taille
    photoCanvas.width = video.videoWidth;
    photoCanvas.height = video.videoHeight;
});


// --- 2. NOUVEAU : Gestion des Modes (Direct / Photo) ---

function toggleMode() {
    isLiveMode = !isLiveMode;

    if (isLiveMode) {
        // Passage en mode DIRECT
        video.classList.remove('hidden');
        photoCanvas.classList.add('hidden');
        toggleModeBtn.textContent = '❄️'; // Icône pour "Figer"
        toggleModeBtn.title = "Figer l'image";
    } else {
        // Passage en mode PHOTO FIGÉE
        // 1. On copie la frame actuelle de la vidéo sur le photoCanvas
        photoCtx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
        
        // Gestion importante du miroir pour la photo figée
        if (facingMode === 'user') {
            photoCtx.translate(photoCanvas.width, 0);
            photoCtx.scale(-1, 1);
        }
        photoCtx.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);
        // Reset de la transformation pour ne pas impacter les futurs dessins
        photoCtx.setTransform(1, 0, 0, 1, 0, 0);

        // 2. On cache la vidéo et on montre le canvas photo
        video.classList.add('hidden');
        photoCanvas.classList.remove('hidden');
        toggleModeBtn.textContent = '🎬'; // Icône pour "Direct"
        toggleModeBtn.title = "Retour au direct";
    }
}

toggleModeBtn.addEventListener('click', toggleMode);


// --- 3. Gestion des Outils & Dessin (Inchangé) ---
function setTool(mode) {
    currentMode = mode;
    if (mode === 'pen') {
        penBtn.classList.add('active'); eraserBtn.classList.remove('active');
    } else {
        eraserBtn.classList.add('active'); penBtn.classList.remove('active');
    }
}
penBtn.addEventListener('click', () => setTool('pen'));
eraserBtn.addEventListener('click', () => setTool('eraser'));

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    let clientX, clientY;
    if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX; clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX; clientY = e.clientY;
    }
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
}

function startDrawing(e) {
    isDrawing = true;
    const pos = getPos(e); lastX = pos.x; lastY = pos.y;
}

function draw(e) {
    if (!isDrawing) return;
    if (e.cancelable) e.preventDefault();
    const pos = getPos(e);
    ctx.lineWidth = lineWidthRange.value;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (currentMode === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
    } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = colorPicker.value;
    }
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    lastX = pos.x; lastY = pos.y;
}

function stopDrawing() {
    isDrawing = false; ctx.globalCompositeOperation = 'source-over';
}

canvas.addEventListener('pointerdown', (e) => {
    if (e.button === 0 || e.pointerType === 'touch') {
        canvas.setPointerCapture(e.pointerId); startDrawing(e);
    }
});
canvas.addEventListener('pointermove', draw);
canvas.addEventListener('pointerup', (e) => {
     canvas.releasePointerCapture(e.pointerId); stopDrawing();
});

clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});


// --- 4. Sauvegarde Photo (MISE À JOUR) ---
saveBtn.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // DÉTERMINER LA SOURCE DU FOND
    // Si on est en direct, le fond est la balise <video>
    // Si on est en photo figée, le fond est le <canvas id="photoCanvas">
    const backgroundSource = isLiveMode ? video : photoCanvas;

    // GESTION DU MIROIR A LA SAUVEGARDE
    // On n'applique l'inversion QUE si on est en mode DIRECT ET en caméra SELFIE.
    // Si on est en mode PHOTO FIGÉE, l'image est déjà inversée sur le photoCanvas.
    if (isLiveMode && facingMode === 'user') {
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
    }

    // 1. Dessiner le fond (vidéo ou photo figée)
    tempCtx.drawImage(backgroundSource, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Reset transform
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    // 2. Dessiner les traits par dessus
    tempCtx.drawImage(canvas, 0, 0);

    try {
        const date = new Date().toISOString().slice(0,19).replace(/[:T]/g, '-');
        // Nom de fichier différent selon le mode
        const modeSuffix = isLiveMode ? 'live' : 'snapshot';
        const fileName = `dessin-${modeSuffix}-${date}.png`;

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