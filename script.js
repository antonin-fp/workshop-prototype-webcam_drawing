const video = document.getElementById('videoElement');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const photoCanvas = document.getElementById('photoCanvas');
const photoCtx = photoCanvas.getContext('2d');
const container = document.getElementById('camera-container');

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
let lastX = 0; let lastY = 0;
let currentMode = 'pen';
let facingMode = 'environment'; // Caméra arrière par défaut
let currentStream = null;
let isLiveMode = true;

// --- 1. FONCTION CLÉ : Simuler object-fit: contain en JS ---
// Cette fonction sert à dessiner la vidéo centrée avec respect du ratio (bandes noires)
function drawImageContain(ctx, img, canvasWidth, canvasHeight) {
    // 1. Calculer le ratio d'échelle pour faire rentrer l'image
    const hRatio = canvasWidth / img.videoWidth;
    const vRatio = canvasHeight / img.videoHeight;
    const ratio = Math.min(hRatio, vRatio); // On prend le plus petit pour que ça rentre

    // 2. Calculer la position pour centrer
    const centerShift_x = (canvasWidth - img.videoWidth * ratio) / 2;
    const centerShift_y = (canvasHeight - img.videoHeight * ratio) / 2;

    // 3. Dessiner (sans aucun effet miroir)
    ctx.drawImage(
        img, 
        0, 0, img.videoWidth, img.videoHeight, // Source
        centerShift_x, centerShift_y, img.videoWidth * ratio, img.videoHeight * ratio // Destination
    );
}


// --- 2. Redimensionnement ---
function resizeCanvas() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Si pas de changement, on sort
    if (canvas.width === width && canvas.height === height) return;

    // Sauvegarde temporaire du dessin
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width; 
    tempCanvas.height = canvas.height;
    // On vérifie que le canvas a une taille > 0 avant de dessiner
    if (canvas.width > 0 && canvas.height > 0) {
        tempCanvas.getContext('2d').drawImage(canvas, 0, 0);
    }

    // Mise à jour de la taille réelle en mémoire
    canvas.width = width; canvas.height = height;
    photoCanvas.width = width; photoCanvas.height = height;

    // Restauration du dessin
    ctx.drawImage(tempCanvas, 0, 0, width, height);
}
// On écoute le redimensionnement (rotation écran)
window.addEventListener('resize', resizeCanvas);


// --- 3. Caméra ---
async function startCamera() {
    if (currentStream) currentStream.getTracks().forEach(t => t.stop());
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: facingMode, 
                width: { ideal: 1920 }, height: { ideal: 1080 } 
            } 
        });
        currentStream = stream;
        video.srcObject = stream;
        
        // Note: On a SUPPRIMÉ toute logique de classe .mirrored ici.
        // La vidéo s'affiche brute, telle quelle.

        video.onloadedmetadata = () => { 
            video.play(); 
            resizeCanvas(); 
        };
    } catch (err) { console.error(err); }
}

switchCamBtn.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    if (!isLiveMode) toggleMode(); // Retour au direct si on change de cam
    startCamera();
});


// --- 4. Mode Direct / Photo ---
function toggleMode() {
    isLiveMode = !isLiveMode;
    resizeCanvas(); // Sécurité taille

    if (isLiveMode) {
        video.classList.remove('hidden');
        photoCanvas.classList.add('hidden');
        toggleModeBtn.textContent = '❄️';
    } else {
        // Mode Figer : On dessine la vidéo sur le canvas photo avec la méthode "Contain"
        photoCtx.fillStyle = "#000"; // Fond noir
        photoCtx.fillRect(0, 0, photoCanvas.width, photoCanvas.height);
        
        drawImageContain(photoCtx, video, photoCanvas.width, photoCanvas.height);

        video.classList.add('hidden');
        photoCanvas.classList.remove('hidden');
        toggleModeBtn.textContent = '🎬';
    }
}
toggleModeBtn.addEventListener('click', toggleMode);


// --- 5. Outils & Dessin (Standard) ---
function setTool(mode) {
    currentMode = mode;
    if (mode === 'pen') { penBtn.classList.add('active'); eraserBtn.classList.remove('active'); }
    else { eraserBtn.classList.add('active'); penBtn.classList.remove('active'); }
}
penBtn.addEventListener('click', () => setTool('pen'));
eraserBtn.addEventListener('click', () => setTool('eraser'));

function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    let cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    let cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    return { x: cx - rect.left, y: cy - rect.top };
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

    if (currentMode === 'eraser') ctx.globalCompositeOperation = 'destination-out';
    else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = colorPicker.value;
    }
    ctx.beginPath(); ctx.moveTo(lastX, lastY); ctx.lineTo(pos.x, pos.y); ctx.stroke();
    lastX = pos.x; lastY = pos.y;
}
function stopDrawing() { isDrawing = false; ctx.globalCompositeOperation = 'source-over'; }

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
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    // On sauvegarde EXACTEMENT ce qui est à l'écran
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // 1. Fond Noir
    tempCtx.fillStyle = "#000";
    tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);

    // 2. Dessiner la vidéo/photo (méthode Contain)
    if (isLiveMode) {
        drawImageContain(tempCtx, video, tempCanvas.width, tempCanvas.height);
    } else {
        // En mode photo, c'est déjà dessiné correctement sur photoCanvas
        tempCtx.drawImage(photoCanvas, 0, 0);
    }

    // 3. Dessiner les traits
    tempCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `dessin-contain-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

startCamera();