const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const container = document.getElementById("game-container");
let gameState = 'START'; 

// --- Asset Loading ---
const bubbleImg = new Image(); bubbleImg.src = '../images/png/thought-bubble.png';
const bgImgs = [1, 2, 3].map(i => { let img = new Image(); img.src = `../images/png/city${i}.png`; return img; });
const tiles = [];
for (let i = 1; i <= 3; i++) { let img = new Image(); img.src = `../images/png/Tiles/${i}.png`; tiles.push(img); }
const animations = { idle: [], run: [] };
for (let i = 1; i <= 8; i++) {
    let imgIdle = new Image(); imgIdle.src = `../images/png/Idle (${i}).png`; animations.idle.push(imgIdle);
    let imgRun = new Image(); imgRun.src = `../images/png/Run (${i}).png`; animations.run.push(imgRun);
}

const positiveWords = ["Breathe", "Calm", "Courage", "Hope", "Peace", "Believe", "Resilience"];
const harmfulWords = ["Doubt", "Fear", "Worry", "Negative", "Stuck", "Stress"];

let level = 1, collected = 0, required = 5, frame = 0, frameTimer = 0;
let player = { x: 50, y: 300, w: 70, h: 70, dx: 0, dy: 0, grounded: false, facingRight: true };
let cameraX = 0, platforms = [], bubbles = [], keys = {};

// --- Input Handling ---
window.addEventListener("keydown", (e) => { 
    if (e.code === "Space") e.preventDefault();
    keys[e.code] = true; 
    if (e.code === "Space" && player.grounded) { player.dy = -15; player.grounded = false; }
    
    if (e.code === 'Escape') {
        if (gameState === 'GAME') { gameState = 'PAUSE'; showScreen('pauseScreen'); }
        else if (gameState === 'PAUSE') { gameState = 'GAME'; document.querySelectorAll('.screen').forEach(s => s.style.display = 'none'); }
    }
});
window.addEventListener("keyup", (e) => { keys[e.code] = false; });

// --- Core Game Functions ---
function startGame() {
    level = 1;
    gameState = 'GAME';
    initLevel();
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
}

function showScreen(id) {
    document.querySelectorAll('.screen').forEach(s => s.style.display = 'none');
    const screen = document.getElementById(id);
    if (screen) screen.style.display = 'flex';
}

function extendLevel() {
    let last = platforms[platforms.length - 1] || {x: -200, y: 350};
    let x = last.x + 200;
    let y = Math.max(100, Math.min(350, last.y + (Math.random() * 200 - 100)));
    
    // First platform
    platforms.push({x: x, y: y, w: 100, tile: Math.floor(Math.random() * 3)});
    // Second platform (Added back for variety)
    platforms.push({x: x + 50, y: (y > 250 ? 150 : 350), w: 80, tile: Math.floor(Math.random() * 3)});
    
    if (Math.random() < 0.4) {
        let isHarmful = Math.random() < 0.3;
        let word = isHarmful ? harmfulWords[Math.floor(Math.random() * harmfulWords.length)] : positiveWords[Math.floor(Math.random() * positiveWords.length)];
        bubbles.push({x: x + 50, y: y - 50, caught: false, word: word, harmful: isHarmful});
    }
}

function initLevel() {
    player.x = 50; player.y = 250; player.dy = 0; cameraX = 0; collected = 0;
    required = level * 8;
    platforms = [{x: 0, y: 350, w: 300, tile: 0}];
    bubbles = [];
    for(let i=0; i<15; i++) extendLevel();
    
    if(document.getElementById("req")) document.getElementById("req").innerText = required;
    if(document.getElementById("coll")) document.getElementById("coll").innerText = collected;
    if(document.getElementById("lvl")) document.getElementById("lvl").innerText = level;
}

// --- Game Loop ---
function update() {
    if (gameState === 'GAME') {
        if (keys["ArrowRight"]) { player.dx = 6; player.facingRight = true; }
        else if (keys["ArrowLeft"]) { player.dx = -6; player.facingRight = false; }
        else player.dx *= 0.7;
        
        player.x += player.dx;
        player.dy += 0.8;
        player.y += player.dy;

        if (platforms.length > 0 && platforms[platforms.length - 1].x < cameraX + 1200) extendLevel();

        player.grounded = false;
        platforms.forEach(p => {
            if (p.x > cameraX - 100 && p.x < cameraX + 900 && player.x + player.w > p.x && player.x < p.x + p.w && player.y + player.h > p.y && player.y + player.h < p.y + 30 && player.dy > 0) {
                player.y = p.y - player.h; player.dy = 0; player.grounded = true;
            }
        });

        bubbles.forEach(b => { 
            if (!b.caught && Math.hypot((player.x + player.w/2) - b.x, (player.y + player.h/2) - b.y) < 50) { 
                b.caught = true; 
                collected = b.harmful ? Math.max(0, collected - 1) : collected + 1;
                if(document.getElementById("coll")) document.getElementById("coll").innerText = collected; 
                if (collected >= required) {
                    if (level < 3) { level++; initLevel(); }
                    else { gameState = 'START'; showScreen('startScreen'); }
                }
            } 
        });

        if (player.x > 300) cameraX = player.x - 300;
        if (player.y > 500) initLevel();

        ctx.clearRect(0, 0, 800, 400);
        if (bgImgs[level-1]?.complete) {
            let offset = (cameraX * 0.5) % 800;
            ctx.drawImage(bgImgs[level-1], -offset, 0, 800, 400);
            ctx.drawImage(bgImgs[level-1], 800 - offset, 0, 800, 400);
        }

        ctx.save();
        ctx.translate(-cameraX, 0);
        platforms.forEach(p => { if (p.x > cameraX - 100 && p.x < cameraX + 900) ctx.drawImage(tiles[p.tile], p.x, p.y, p.w, 20); });
        bubbles.forEach(b => { 
            if (!b.caught && b.x > cameraX - 100 && b.x < cameraX + 900) { 
                ctx.drawImage(bubbleImg, b.x - 55, b.y - 55, 110, 110); 
                ctx.fillStyle = b.harmful ? "#b71c1c" : "#0d47a1"; 
                ctx.font = "bold 14px Arial"; ctx.textAlign = "center"; 
                ctx.fillText(b.word, b.x, b.y - 5); 
            } 
        });
        
        frameTimer++; if (frameTimer % 6 === 0) frame = (frame + 1) % 8;
        let action = (Math.abs(player.dx) > 0.5) ? 'run' : 'idle';
        ctx.save();
        ctx.translate(player.x + player.w/2, player.y + player.h/2);
        if (!player.facingRight) ctx.scale(-1, 1);
        if (animations[action][frame]?.complete) {
            ctx.drawImage(animations[action][frame], -player.w/2, -player.h/2 + 5, player.w, player.h);
        }
        ctx.restore(); ctx.restore();
    }
    requestAnimationFrame(update);
}

update();