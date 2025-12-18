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
const switchCamBtn = document.getElementById('switchCamBtn'); // NOUVEAU

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentMode = 'pen'; 

// NOUVEAU : Variable pour suivre quelle caméra est utilisée
// 'user' = frontale (selfie), 'environment' = arrière
let facingMode = 'user'; 
let currentStream = null;

// --- 1. Gestion de la Caméra ---

async function startCamera() {
    // Si un flux existe déjà, on l'arrête avant d'en lancer un nouveau
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: facingMode, // On utilise la variable dynamique
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        
        currentStream = stream;
        video.srcObject = stream;
        
        // GESTION DU MIROIR CSS
        // Si c'est la caméra selfie ('user'), on ajoute la classe miroir.
        // Si c'est la caméra arrière ('environment'), on l'enlève.
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
        alert("Impossible d'accéder à la caméra ou de changer de vue.");
    }
}

// NOUVEAU : Fonction pour basculer la caméra
switchCamBtn.addEventListener('click', () => {
    // Inverse le mode
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    // Relance la caméra
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


// --- 4. Sauvegarde Photo (MISE À JOUR IMPORTANTE) ---
saveBtn.addEventListener('click', () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Logique de miroir conditionnelle pour la sauvegarde
    if (facingMode === 'user') {
        // Si c'est un selfie, on inverse l'image pour qu'elle corresponde à l'écran
        tempCtx.translate(tempCanvas.width, 0);
        tempCtx.scale(-1, 1);
    } 
    // Si c'est la caméra arrière ('environment'), on ne fait RIEN (pas de scale -1)
    // pour que le texte reste lisible.

    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    
    // Reset transform pour dessiner le canvas de dessin par dessus
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);
    tempCtx.drawImage(canvas, 0, 0);

    try {
        const date = new Date().toISOString().slice(0,19).replace(/[:T]/g, '-');
        const fileName = `dessin-${facingMode}-${date}.png`; // Ajout du mode dans le nom

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