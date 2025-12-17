const video = document.getElementById('videoElement');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');

// Contrôles
const clearBtn = document.getElementById('clearBtn');
const penBtn = document.getElementById('penBtn');
const eraserBtn = document.getElementById('eraserBtn');
const colorPicker = document.getElementById('colorPicker');
const lineWidthRange = document.getElementById('lineWidth');
// NOUVEAU : Référence au bouton sauvegarder
const saveBtn = document.getElementById('saveBtn');

let isDrawing = false;
let lastX = 0;
let lastY = 0;
let currentMode = 'pen'; // 'pen' ou 'eraser'

// --- 1. Gestion de la Caméra ---
async function startCamera() {
    try {
        // On demande une haute résolution si possible pour une meilleure photo
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'user', // 'user' pour caméra frontale (selfie), 'environment' pour arrière
                width: { ideal: 1920 },
                height: { ideal: 1080 }
            } 
        });
        video.srcObject = stream;
        // Important : on attend que la vidéo joue pour dimensionner le canvas
        video.onloadedmetadata = () => {
            video.play();
        };
    } catch (err) {
        console.error("Erreur:", err);
        alert("Erreur d'accès caméra (Vérifiez HTTPS et permissions).");
    }
}

// On redimensionne le canvas quand la taille de la vidéo est connue
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
    // Calcul précis du ratio entre la taille affichée et la résolution réelle
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
    // e.preventDefault() est déplacé dans les écouteurs pour ne pas bloquer les clics boutons
}

function draw(e) {
    if (!isDrawing) return;
     // Empêche le scroll uniquement quand on dessine
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

// --- 4. Écouteurs Dessin ---
// Utilisation de 'pointerdown' qui gère mieux souris ET tactile unifiés
canvas.addEventListener('pointerdown', (e) => {
    // On ne dessine que si c'est le clic gauche ou le doigt (pointerType 'touch')
    if (e.button === 0 || e.pointerType === 'touch') {
        // Capture le pointeur pour que le dessin continue même si on sort du canvas
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


// --- 5. NOUVEAU : Fonction de Sauvegarde Photo ---

saveBtn.addEventListener('click', () => {
    // a. Créer un canvas temporaire en mémoire
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');

    // b. Lui donner la même taille que la vidéo
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;

    // c. GÉRER L'EFFET MIROIR :
    // Le CSS inverse la vidéo visuellement, mais pas les données brutes.
    // Il faut donc inverser le contexte temporaire avant de dessiner la vidéo.
    tempCtx.translate(tempCanvas.width, 0);
    tempCtx.scale(-1, 1);

    // d. Dessiner l'image actuelle de la vidéo sur le canvas temporaire
    tempCtx.drawImage(video, 0, 0, tempCanvas.width, tempCanvas.height);

    // e. Annuler l'inversion pour que le dessin, lui, soit dans le bon sens
    tempCtx.setTransform(1, 0, 0, 1, 0, 0);

    // f. Dessiner le contenu du canvas de dessin par dessus la vidéo
    tempCtx.drawImage(canvas, 0, 0);

    // g. Convertir le résultat en image PNG et télécharger
    try {
        // Générer un nom de fichier avec la date
        const date = new Date().toISOString().slice(0,19).replace(/[:T]/g, '-');
        const fileName = `dessin-camera-${date}.png`;

        // Créer un lien invisible pour déclencher le téléchargement
        const link = document.createElement('a');
        link.download = fileName;
        // Transforme le canvas temporaire en URL de données image
        link.href = tempCanvas.toDataURL('image/png', 1.0); // 1.0 = qualité max
        document.body.appendChild(link);
        link.click(); // Simule le clic
        document.body.removeChild(link); // Nettoyage

    } catch (err) {
        console.error("Erreur lors de la sauvegarde:", err);
        alert("Impossible de sauvegarder l'image (problème de sécurité navigateur).");
    }
});

// Lancement
startCamera();