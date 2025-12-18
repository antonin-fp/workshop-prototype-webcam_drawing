const video = document.getElementById('videoElement');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const photoCanvas = document.getElementById('photoCanvas');
const photoCtx = photoCanvas.getContext('2d');
const cameraContainer = document.getElementById('camera-container');

// Contrôles
const clearBtn = document.getElementById('clearBtn');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const colorPicker = document.getElementById('colorPicker');
const lineWidthRange = document.getElementById('lineWidth');
const saveBtn = document.getElementById('saveBtn');
const switchCamBtn = document.getElementById('switchCamBtn');
const toggleModeBtn = document.getElementById('toggleModeBtn');

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentMode = 'pen'; 
let facingMode = 'environment'; 
let currentStream = null;
let isLiveMode = true;

// --- 1. Utilitaires de Dimensionnement ---

// Cette fonction s'assure que la résolution interne du canvas
// correspond exactement à la taille affichée à l'écran
function resizeCanvas() {
    // On donne aux canvas la taille exacte du conteneur affiché
    const width = cameraContainer.clientWidth;
    const height = cameraContainer.clientHeight;

    // Mise à jour de la résolution interne (sans effacer si possible)
    if (canvas.width !== width || canvas.height !== height) {
        // Sauvegarde du dessin actuel si besoin (optionnel, ici on reset au resize pour simplifier)
        canvas.width = width;
        canvas.height = height;
        photoCanvas.width = width;
        photoCanvas.height = height;
    }
}

// On écoute le redimensionnement de la fenêtre (rotation téléphone)
window.addEventListener('resize', resizeCanvas);


// --- 2. Gestion Caméra ---

async function startCamera() {
    if (currentStream) {
        currentStream.getTracks().forEach(track => track.stop());
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: facingMode, 
                // On demande une résolution standard, le CSS gérera l'affichage
                width: { ideal: 1280 },
                height: { ideal: 720 }
            } 
        });
        
        currentStream = stream;
        video.srcObject = stream;
        
        if (facingMode === 'user') {
            video.classList.add('mirrored');
        } else {
            video.classList.remove('mirrored');
        }

        video.onloadedmetadata = () => {
            video.play();
            resizeCanvas(); // Ajuste la taille une fois la vidéo prête
        };
    } catch (err) {
        console.error("Erreur:", err);
        alert("Erreur accès caméra.");
    }
}

switchCamBtn.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    if (!isLiveMode) toggleMode();
    startCamera();
});

// --- 3. Mode Direct / Photo ---

function toggleMode() {
    isLiveMode = !isLiveMode;

    if (isLiveMode) {
        video.classList.remove('hidden');
        photoCanvas.classList.add('hidden');
        toggleModeBtn.textContent = '❄️';
    } else {
        // IMPORTANT : Pour dessiner la vidéo sur le canvas en mode "contain",
        // il faut calculer le ratio pour ne pas déformer l'image (garder aspect ratio)
        
        photoCtx.clearRect(0, 0, photoCanvas.width, photoCanvas.height);
        
        // Calcul des dimensions de l'image vidéo pour la centrer (simuler object-fit: contain)
        const vRatio = video.videoWidth / video.videoHeight;
        const cRatio = photoCanvas.width / photoCanvas.height;
        let drawW, drawH, startX, startY;

        if (vRatio > cRatio) {
            // La vidéo est plus large que le canvas (bandes noires haut/bas)
            drawW = photoCanvas.width;
            drawH = drawW / vRatio;
            startX = 0;
            startY = (photoCanvas.height - drawH) / 2;
        } else {
            // La vidéo est plus haute (bandes noires gauche/droite)
            drawH = photoCanvas.height;
            drawW = drawH * vRatio;
            startY = 0;
            startX = (photoCanvas.width - drawW) / 2;
        }

        if (facingMode === 'user') {
            photoCtx.translate(photoCanvas.width, 0);
            photoCtx.scale(-1, 1);
            // Inversion des coordonnées X si miroir
             startX = (photoCanvas.width - drawW) / 2; // Reste centré
             // Petit hack car le scale inversé impacte le dessin, on dessine "à l'envers"
             // mais drawImage gère bien si on a translate avant.
        }

        photoCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, startX, startY, drawW, drawH);
        
        photoCtx.setTransform(1, 0, 0, 1, 0, 0);

        video.classList.add('hidden');
        photoCanvas.classList.remove('hidden');
        toggleModeBtn.textContent = '🎬';
    }
}
toggleModeBtn.addEventListener('click', toggleMode);


// --- 4. Outils ---
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


// --- 5. Dessin ---
function getPos(e) {
    // Comme le canvas fait exactement la taille de l'élément visuel
    // grâce à resizeCanvas(), le calcul est simplifié :
    const rect = canvas.getBoundingClientRect();
    
    let clientX, clientY;
    if (e.changedTouches && e.changedTouches.length > 0) {
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    return {
        x: clientX - rect.left,
        y: clientY - rect.top
    };
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
clearBtn.addEventListener('click', () => ctx.clearRect(0, 0, canvas.width, canvas.height));


// --- 6. Sauvegarde ---
saveBtn.addEventListener('click', () => {
    // On crée un canvas temporaire de la taille de l'écran (WYSWYG)
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // On utilise la taille actuelle affichée
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Fond noir (si bandes noires)
    tempCtx.fillStyle = "#000000";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    if (isLiveMode) {
        // En mode Live, on doit redessiner la vidéo manuellement pour simuler le "contain"
        // exactement comme on a fait dans toggleMode()
        const vRatio = video.videoWidth / video.videoHeight;
        const cRatio = tempCanvas.width / tempCanvas.height;
        let drawW, drawH, startX, startY;

        if (vRatio > cRatio) {
            drawW = tempCanvas.width;
            drawH = drawW / vRatio;
            startX = 0;
            startY = (tempCanvas.height - drawH) / 2;
        } else {
            drawH = tempCanvas.height;
            drawW = drawH * vRatio;
            startY = 0;
            startX = (tempCanvas.width - drawW) / 2;
        }

        if (facingMode === 'user') {
            tempCtx.translate(tempCanvas.width, 0);
            tempCtx.scale(-1, 1);
            // Corriger le X si scale inversé
            // La logique de dessin miroir peut être complexe, 
            // le plus simple est de garder le drawImage tel quel avec le contexte inversé
        }
        
        tempCtx.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, startX, startY, drawW, drawH);
        tempCtx.setTransform(1, 0, 0, 1, 0, 0);

    } else {
        // En mode photo, le photoCanvas a déjà l'image correcte
        tempCtx.drawImage(photoCanvas, 0, 0);
    }

    // Dessin
    tempCtx.drawImage(canvas, 0, 0);

    try {
        const date = new Date().toISOString().slice(0,19).replace(/[:T]/g, '-');
        const fileName = `dessin-${date}.png`;
        const link = document.createElement('a');
        link.download = fileName;
        link.href = tempCanvas.toDataURL('image/png');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (err) { console.error(err); }
});

startCamera();