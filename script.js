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
let facingMode = 'environment';
let currentStream = null;
let isLiveMode = true;

// --- 1. FONCTION DE DIMENSIONNEMENT STRICT ---
// Cette fonction calcule la taille exacte que doit prendre la vidéo pour rentrer 
// dans le conteneur sans déborder (contain), puis applique cette taille
// aux balises HTML directement.
function resizeLayout() {
    const containerW = container.clientWidth;
    const containerH = container.clientHeight;
    
    // Si la vidéo n'est pas chargée, on ne peut pas calculer le ratio
    if (video.videoWidth === 0 || video.videoHeight === 0) return;

    // Calcul du ratio pour "Fit" (Contain)
    const videoRatio = video.videoWidth / video.videoHeight;
    const containerRatio = containerW / containerH;

    let finalW, finalH;

    if (containerRatio > videoRatio) {
        // Le conteneur est plus large que la vidéo -> La hauteur est le facteur limitant
        finalH = containerH;
        finalW = finalH * videoRatio;
    } else {
        // Le conteneur est plus haut que la vidéo -> La largeur est le facteur limitant
        finalW = containerW;
        finalH = finalW / videoRatio;
    }

    // On arrondit pour éviter des flous
    finalW = Math.floor(finalW);
    finalH = Math.floor(finalH);

    // APPLIQUER LA TAILLE AUX ÉLÉMENTS
    // 1. Vidéo
    video.style.width = finalW + 'px';
    video.style.height = finalH + 'px';

    // 2. Canvas Dessin
    // On doit redimensionner le canvas sans perdre le dessin si possible
    // (Ici on reset pour simplifier car changer la résolution efface le contenu)
    if (canvas.width !== finalW || canvas.height !== finalH) {
        // Si on veut garder le dessin, il faudrait le copier dans un tempCanvas ici
        canvas.style.width = finalW + 'px';
        canvas.style.height = finalH + 'px';
        canvas.width = finalW;  // Résolution interne
        canvas.height = finalH; // Résolution interne
    }

    // 3. Canvas Photo
    photoCanvas.style.width = finalW + 'px';
    photoCanvas.style.height = finalH + 'px';
    photoCanvas.width = finalW;
    photoCanvas.height = finalH;
}

// On appelle le resize au changement de taille (rotation)
window.addEventListener('resize', resizeLayout);


// --- 2. Caméra ---
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
        
        // PAS DE MIROIR demandé
        video.classList.remove('mirrored'); 

        video.onloadedmetadata = () => { 
            video.play(); 
            // On attend un tout petit peu que les dimensions soient dispos
            setTimeout(resizeLayout, 100); 
        };
    } catch (err) { console.error(err); }
}

switchCamBtn.addEventListener('click', () => {
    facingMode = (facingMode === 'user') ? 'environment' : 'user';
    if (!isLiveMode) toggleMode();
    startCamera();
});


// --- 3. Mode Direct / Photo ---
function toggleMode() {
    isLiveMode = !isLiveMode;
    resizeLayout(); // Sécurité

    if (isLiveMode) {
        video.classList.remove('hidden');
        photoCanvas.classList.add('hidden');
        toggleModeBtn.textContent = '❄️';
    } else {
        // Comme le photoCanvas a EXACTEMENT la même taille que la vidéo (grâce à resizeLayout),
        // On dessine simplement l'image complète (0,0 à w,h). Plus de calculs complexes.
        photoCtx.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);

        video.classList.add('hidden');
        photoCanvas.classList.remove('hidden');
        toggleModeBtn.textContent = '🎬';
    }
}
toggleModeBtn.addEventListener('click', toggleMode);


// --- 4. Outils ---
function setTool(mode) {
    currentMode = mode;
    if (mode === 'pen') { penBtn.classList.add('active'); eraserBtn.classList.remove('active'); }
    else { eraserBtn.classList.add('active'); penBtn.classList.remove('active'); }
}
penBtn.addEventListener('click', () => setTool('pen'));
eraserBtn.addEventListener('click', () => setTool('eraser'));


// --- 5. Dessin ---
function getPos(e) {
    // Le canvas étant centré et dimensionné exactement, 
    // getBoundingClientRect donne les bonnes coordonnées relatives.
    const rect = canvas.getBoundingClientRect();
    let cx = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
    let cy = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
    
    // Le canvas interne a la même taille que le canvas CSS, donc pas de ratio à calculer
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


// --- 6. Sauvegarde Simplifiée ---
saveBtn.addEventListener('click', () => {
    // Créer un canvas de la taille EXACTE de la zone vidéo
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // Pas de fond noir nécessaire ici car on sauvegarde UNIQUEMENT la zone vidéo
    // (donc pas les bandes noires)
    
    if (isLiveMode) {
        // Comme tempCanvas a le même ratio que video, drawImage simple suffit
        tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);
    } else {
        tempCtx.drawImage(photoCanvas, 0, 0);
    }

    // Dessin
    tempCtx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = `dessin-strict-${Date.now()}.png`;
    link.href = tempCanvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
});

// Appel initial
startCamera();