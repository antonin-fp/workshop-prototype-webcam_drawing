const video = document.getElementById('videoElement');
const canvas = document.getElementById('drawingCanvas');
const ctx = canvas.getContext('2d');
const clearBtn = document.getElementById('clearBtn');
const colorPicker = document.getElementById('colorPicker');
const lineWidthRange = document.getElementById('lineWidth');

let isDrawing = false;
let lastX = 0;
let lastY = 0;

// --- 1. Gestion de la Caméra ---

async function startCamera() {
    try {
        // On demande la vidéo, de préférence la caméra arrière ('environment') sur mobile
        // Si 'environment' n'est pas dispo, le navigateur prendra la caméra par défaut.
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { facingMode: 'environment' } 
        });
        video.srcObject = stream;
    } catch (err) {
        console.error("Erreur d'accès à la caméra:", err);
        alert("Impossible d'accéder à la caméra. Vérifiez que vous êtes en HTTPS.");
    }
}

// Ajuster la taille du canvas à celle de la vidéo une fois chargée
video.addEventListener('loadedmetadata', () => {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
});


// --- 2. Fonctions de Dessin ---

// Fonction pour obtenir les coordonnées correctes (Souris ou Tactile)
function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    // Facteur d'échelle car la taille CSS diffère de la résolution réelle
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;

    if (e.changedTouches) { // Tactile
        clientX = e.changedTouches[0].clientX;
        clientY = e.changedTouches[0].clientY;
    } else { // Souris
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
    e.preventDefault(); // Empêche le scroll sur mobile
}

function draw(e) {
    if (!isDrawing) return;
    const pos = getPos(e);
    
    ctx.strokeStyle = colorPicker.value;
    ctx.lineWidth = lineWidthRange.value;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();

    lastX = pos.x;
    lastY = pos.y;
    e.preventDefault();
}

function stopDrawing() {
    isDrawing = false;
}

// --- 3. Écouteurs d'événements ---

// Souris
canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mouseout', stopDrawing);

// Tactile (Mobile)
canvas.addEventListener('touchstart', startDrawing, { passive: false });
canvas.addEventListener('touchmove', draw, { passive: false });
canvas.addEventListener('touchend', stopDrawing);

// Bouton Effacer
clearBtn.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
});

// Lancement au chargement
startCamera();