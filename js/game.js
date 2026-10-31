/* Mindful Space — Student Life. No libraries or network connection required. */
(() => {
  'use strict';

  const canvas = document.getElementById('gameCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const overlays = document.querySelectorAll('.game-screen');
  const pauseButton = document.getElementById('pauseGame');
  const liveStatus = document.getElementById('gameStatus');
  const scoreLabel = document.getElementById('coll');
  const requiredLabel = document.getElementById('req');
  const levelLabel = document.getElementById('lvl');
  const message = document.getElementById('gameMessage');
  const difficultyName = document.getElementById('difficultyName');
  const winQuote = document.getElementById('winQuote');

  const loadImage = path => {
    const img = new Image();
    img.src = path;
    return img;
  };
  const backgrounds = [1, 2, 3].map(n => loadImage(`../images/png/city${n}.png`));
  const tiles = [1, 2, 3].map(n => loadImage(`../images/png/Tiles/${n}.png`));
  const thoughtBubble = loadImage('../images/png/thought-bubble.png');
  const sprites = {
    idle: Array.from({length: 10}, (_, i) => loadImage(`../images/png/Idle (${i + 1}).png`)),
    run: Array.from({length: 8}, (_, i) => loadImage(`../images/png/Run (${i + 1}).png`)),
    jump: Array.from({length: 12}, (_, i) => loadImage(`../images/png/Jump (${i + 1}).png`))
  };
  const positiveWords = ['Breathe', 'Calm', 'Courage', 'Hope', 'Peace', 'Believe', 'Resilience'];
  const challengingWords = ['Doubt', 'Fear', 'Worry', 'Stress'];
  const rand = (min, max) => min + Math.random() * (max - min);
  const clamp = (n, low, high) => Math.max(low, Math.min(high, n));
  const imageReady = img => img && img.complete && img.naturalWidth > 0;

  // The main route uses generated jumps that are tested against the actual
  // jump physics. More demanding levels have shorter platforms and bigger gaps.
  // Bonus/stepping-stone platforms make the route genuinely different each run.
  const difficulties = [
    {name: 'Challenging', gap: [118, 181], width: [119, 174], rise: 65, minY: 252, maxY: 366, harm: 0.08, extra: 0.40, bubbleEvery: [2, 3]},
    {name: 'Hard', gap: [148, 215], width: [95, 146], rise: 85, minY: 233, maxY: 367, harm: 0.14, extra: 0.52, bubbleEvery: [3, 4]},
    {name: 'Expert', gap: [174, 238], width: [74, 116], rise: 99, minY: 222, maxY: 368, harm: 0.19, extra: 0.65, bubbleEvery: [3, 5]}
  ];
  const JUMP_SPEED = -12.5;
  const GRAVITY = 0.64;
  const RUN_SPEED = 5.5;
  // Descending intersection with the next platform, in physics frames.
  function landingFrames(verticalChange) {
    let height = 0;
    let verticalSpeed = JUMP_SPEED;
    for (let frame = 1; frame <= 65; frame++) {
      verticalSpeed = Math.min(verticalSpeed + GRAVITY, 15);
      height += verticalSpeed;
      if (verticalSpeed >= 0 && height >= verticalChange) return frame;
    }
    return 0;
  }
  // Leave a safety margin at both ends, so a good jump has landing room.
  function reachableGap(verticalChange) {
    return Math.max(0, landingFrames(verticalChange) * RUN_SPEED - 27);
  }
  function randomInt(min, max) { return Math.floor(rand(min, max + 1)); }

  // Original positive messages; deck persists to avoid repeating a quote
  // until the others have been seen, including between browser visits.
  const endingQuotes = [
    'Progress is made one small step at a time.',
    'You can be proud of how far you have travelled.',
    'A new day brings room for a new beginning.',
    'A difficult moment does not define your whole story.',
    'Every challenge can teach you something about your strength.',
    'It is okay to move forward at your own pace.',
    'Give yourself credit for showing up and trying.',
    'Small moments of kindness can make a big difference.',
    'Your journey does not need to look like anybody else’s.',
    'Pausing for a moment can be part of moving forward.',
    'You have already made it through so much.',
    'An imperfect step forward is still a step forward.'
  ];
  let quoteDeck = {remaining: [], last: -1};
  try {
    const stored = JSON.parse(localStorage.getItem('mindful-space-quote-deck-v1'));
    if (stored && Array.isArray(stored.remaining) &&
        stored.remaining.every(n => Number.isInteger(n) && n >= 0 && n < endingQuotes.length) &&
        new Set(stored.remaining).size === stored.remaining.length &&
        Number.isInteger(stored.last) && stored.last >= -1 && stored.last < endingQuotes.length) {
      quoteDeck = stored;
    }
  } catch (_) { /* Offline/private browsing can restrict storage. */ }
  function nextEndingQuote() {
    if (!quoteDeck.remaining.length) {
      const shuffled = endingQuotes.map((_, i) => i);
      for (let i = shuffled.length - 1; i > 0; --i) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      if (shuffled[0] === quoteDeck.last) {
        [shuffled[0], shuffled[1]] = [shuffled[1], shuffled[0]];
      }
      quoteDeck.remaining = shuffled;
    }
    quoteDeck.last = quoteDeck.remaining.shift();
    try { localStorage.setItem('mindful-space-quote-deck-v1', JSON.stringify(quoteDeck)); }
    catch (_) { /* Continue with the in-memory deck. */ }
    return endingQuotes[quoteDeck.last];
  }

  let state = 'START';
  let level = 1;
  let collected = 0;
  let required = 5;
  let cameraX = 0;
  let platforms = [];
  let bubbles = [];
  let generated = 0;
  let lastMainPlatform = null;
  let lastCheckpointIndex = 0;
  let previousHarm = false;
  let nextBubbleAt = 2;
  let lastTime = 0;
  let accumulator = 0;
  let animationTime = 0;
  let checkpoint = {x: 50, y: 250};
  let jumpBuffer = 0;
  let coyoteTime = 0;
  let noticeFrames = 0;

  const player = {x: 50, y: 250, w: 60, h: 67, vx: 0, vy: 0, grounded: false, facingRight: true};
  const keys = new Set();
  const pressedPointers = new Map();
  const touch = {left: false, right: false};

  function say(value) { liveStatus.textContent = value; }
  function show(screenId) {
    overlays.forEach(screen => { screen.hidden = screen.id !== screenId; });
    pauseButton.hidden = state !== 'GAME';
    // A release outside a button must never leave the character running.
    touch.left = false;
    touch.right = false;
    pressedPointers.clear();
    document.querySelectorAll('.touch-control').forEach(btn => btn.classList.remove('pressed'));
    if (screenId) document.getElementById(screenId)?.querySelector('button')?.focus({preventScroll: true});
    else canvas.focus({preventScroll: true});
  }
  function updateScore() {
    levelLabel.textContent = String(level);
    scoreLabel.textContent = String(collected);
    requiredLabel.textContent = String(required);
    difficultyName.textContent = difficulties[level - 1].name;
  }
  function addSegment() {
    const mode = difficulties[level - 1];
    const prev = lastMainPlatform;
    // Pick an independent height and gap on EVERY segment. Reject unsafe
    // combinations rather than relying on a fixed repeating pattern.
    let newY;
    let gap;
    let valid = false;
    for (let attempt = 0; attempt < 24; attempt++) {
      newY = clamp(prev.y + rand(-mode.rise, mode.rise), mode.minY, mode.maxY);
      gap = rand(...mode.gap);
      if (gap <= reachableGap(newY - prev.y)) { valid = true; break; }
    }
    // Fallback guarantees reachability even on a run of unusually high jumps.
    if (!valid) {
      newY = clamp(prev.y + rand(-mode.rise * 0.7, mode.rise), mode.minY, mode.maxY);
      gap = Math.min(rand(...mode.gap), reachableGap(newY - prev.y) - 3);
    }
    gap = Math.max(76, gap);
    const main = {
      x: prev.x + prev.w + gap,
      y: newY,
      w: rand(...mode.width),
      tile: randomInt(0, tiles.length - 1),
      main: true,
      index: ++generated,
      checkpoint: generated % 5 === 0
    };
    platforms.push(main);
    lastMainPlatform = main;

    // Fewer bubbles: one on every 2–3, 3–4 or 3–5 main platforms by level.
    // Nothing spawns on the platforms between them. Every level has an endless
    // supply, so a missed bubble can never make the game unwinnable.
    if (generated >= nextBubbleAt) {
      const harmful = generated > 2 && !previousHarm && Math.random() < mode.harm;
      previousHarm = harmful;
      const needsJump = !harmful && Math.random() < 0.36;
      bubbles.push({
        x: main.x + main.w * rand(0.36, 0.64),
        y: main.y - (needsJump ? rand(105, 119) : rand(69, 77)),
        word: (harmful ? challengingWords : positiveWords)[randomInt(0, (harmful ? challengingWords : positiveWords).length - 1)],
        harmful,
        caught: false
      });
      nextBubbleAt = generated + randomInt(...mode.bubbleEvery);
    }

    // Randomly positioned narrow stepping stones: extra route options, not
    // required to cross the gap. Only place one if it won't overlap the mains.
    if (gap > 120 && Math.random() < mode.extra) {
      const w = rand(53, level === 3 ? 72 : 84);
      platforms.push({
        x: prev.x + prev.w + gap * rand(0.34, 0.66) - w / 2,
        y: Math.min(prev.y, main.y) - rand(6, 32),
        w,
        tile: randomInt(0, tiles.length - 1), main: false, checkpoint: false
      });
    }

    // Occasional raised platform creates another path and a rare reward.
    // Both position and height vary; bonus bubbles are deliberately uncommon.
    if (Math.random() < mode.extra * 0.62 && main.y > mode.minY + 30) {
      const upperW = rand(56, Math.min(92, main.w - 8));
      const upperY = main.y - rand(68, 92);
      const upperX = main.x + (main.w - upperW) * rand(0.12, 0.88);
      platforms.push({x: upperX, y: upperY, w: upperW,
        tile: randomInt(0, tiles.length - 1), main: false, checkpoint: false});
      if (generated >= nextBubbleAt - 1 && Math.random() < 0.18) {
        bubbles.push({x: upperX + upperW / 2, y: upperY - 72,
          word: positiveWords[randomInt(0, positiveWords.length - 1)],
          harmful: false, caught: false, bonus: true});
      }
    }
  }
  function setupLevel() {
    required = 3 + 2 * level; // 5, 7, 9: harder with fewer pickups
    collected = 0;
    cameraX = 0;
    generated = 0;
    lastCheckpointIndex = 0;
    previousHarm = false;
    nextBubbleAt = randomInt(...difficulties[level - 1].bubbleEvery);
    player.x = 60;
    player.y = 260;
    player.vx = 0;
    player.vy = 0;
    player.grounded = false;
    player.facingRight = true;
    checkpoint = {x: 60, y: 260};
    jumpBuffer = coyoteTime = noticeFrames = 0;
    message.textContent = '';
    platforms = [{x: 0, y: 344, w: 380, tile: 0, main: true, index: 0, checkpoint: false}];
    lastMainPlatform = platforms[0];
    // The starting platform remains bubble-free to teach movement first.
    bubbles = [];
    // Generate ahead, then continue infinitely as the player advances.
    for (let i = 0; i < 10; i++) addSegment();
    updateScore();
    say(`Level ${level}: ${difficulties[level - 1].name}. Collect ${required} encouraging thoughts.`);
  }
  function startGame() {
    level = 1;
    setupLevel();
    resumeGame();
  }
  function resumeGame() {
    state = 'GAME';
    keys.clear();
    show(null);
    say(`Level ${level} resumed.`);
  }
  function pauseGame() {
    if (state !== 'GAME') return;
    state = 'PAUSE';
    keys.clear();
    show('pauseScreen');
    say('Game paused.');
  }
  function quitGame() {
    state = 'START';
    keys.clear();
    show('startScreen');
    say('On the start screen.');
  }
  function nextLevel() {
    if (state !== 'LEVEL_COMPLETE') return;
    level += 1;
    setupLevel();
    resumeGame();
  }
  function requestJump() {
    if (state === 'GAME') jumpBuffer = 10;
  }

  document.getElementById('startGame').addEventListener('click', startGame);
  document.getElementById('showControls').addEventListener('click', () => show('controlScreen'));
  document.getElementById('backToStart').addEventListener('click', () => show('startScreen'));
  document.getElementById('resumeGame').addEventListener('click', resumeGame);
  document.getElementById('quitGame').addEventListener('click', quitGame);
  document.getElementById('nextLevel').addEventListener('click', nextLevel);
  document.getElementById('playAgain').addEventListener('click', startGame);
  document.getElementById('winHome').addEventListener('click', quitGame);
  pauseButton.addEventListener('click', pauseGame);

  const gameplayKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'KeyA', 'KeyD', 'KeyW', 'Space']);
  window.addEventListener('keydown', event => {
    if (event.code === 'Escape' && !event.repeat) {
      if (state === 'GAME') pauseGame();
      else if (state === 'PAUSE') resumeGame();
      return;
    }
    if (state !== 'GAME') return;
    if (gameplayKeys.has(event.code)) event.preventDefault();
    if (!event.repeat && ['Space', 'ArrowUp', 'KeyW'].includes(event.code)) requestJump();
    keys.add(event.code);
  });
  window.addEventListener('keyup', event => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    if (state === 'GAME') pauseGame();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state === 'GAME') pauseGame();
  });

  const controls = Array.from(document.querySelectorAll('.touch-control'));
  function refreshTouch() {
    touch.left = [...pressedPointers.values()].includes('left');
    touch.right = [...pressedPointers.values()].includes('right');
    for (const btn of controls) btn.classList.toggle('pressed', [...pressedPointers.values()].includes(btn.dataset.control));
  }
  for (const button of controls) {
    button.addEventListener('pointerdown', event => {
      if (state !== 'GAME') return;
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pressedPointers.set(event.pointerId, button.dataset.control);
      if (button.dataset.control === 'jump') requestJump();
      refreshTouch();
    });
    const release = event => {
      pressedPointers.delete(event.pointerId);
      refreshTouch();
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  }

  function tick() {
    if (state !== 'GAME') return;
    animationTime += 1;
    const left = keys.has('ArrowLeft') || keys.has('KeyA') || touch.left;
    const right = keys.has('ArrowRight') || keys.has('KeyD') || touch.right;
    const direction = Number(right) - Number(left);
    if (direction) {
      player.vx = clamp(player.vx + direction * 0.9, -RUN_SPEED, RUN_SPEED);
      player.facingRight = direction > 0;
    } else {
      player.vx *= 0.70;
      if (Math.abs(player.vx) < 0.1) player.vx = 0;
    }
    player.x = Math.max(0, player.x + player.vx);
    if (player.grounded) coyoteTime = 7;
    else coyoteTime = Math.max(0, coyoteTime - 1);
    if (jumpBuffer > 0) jumpBuffer -= 1;
    if (jumpBuffer > 0 && coyoteTime > 0) {
      player.vy = JUMP_SPEED;
      player.grounded = false;
      jumpBuffer = 0;
      coyoteTime = 0;
    }
    const oldFeet = player.y + player.h;
    player.vy = Math.min(player.vy + GRAVITY, 15);
    player.y += player.vy;
    player.grounded = false;
    for (const platform of platforms) {
      if (player.vy >= 0 && oldFeet <= platform.y + 7 &&
          player.y + player.h >= platform.y && player.x + player.w > platform.x + 6 &&
          player.x < platform.x + platform.w - 6) {
        player.y = platform.y - player.h;
        player.vy = 0;
        player.grounded = true;
        // Checkpoints occur every five main platforms. Falling now
        // requires replaying a short stretch, instead of respawning at every step.
        if (platform.checkpoint && platform.index > lastCheckpointIndex &&
            player.x + player.w / 2 > platform.x + 25 &&
            player.x + player.w / 2 < platform.x + platform.w - 25) {
          checkpoint = {x: clamp(platform.x + platform.w / 2 - player.w / 2,
            platform.x + 8, platform.x + platform.w - player.w - 8), y: platform.y - player.h};
          lastCheckpointIndex = platform.index;
          notice('Checkpoint reached! Your place is saved.', true);
        }
        break;
      }
    }
    if (player.y > H + 110) {
      player.x = checkpoint.x;
      player.y = checkpoint.y - 18;
      player.vx = player.vy = 0;
      const lostThought = collected > 0;
      if (lostThought) { collected -= 1; updateScore(); }
      notice(lostThought ? 'Back to checkpoint — one thought lost. Try again!' :
        'Back to checkpoint — you can do this!', true);
    }
    cameraX = Math.max(0, player.x - W * 0.3);
    while (lastMainPlatform.x < cameraX + W + 450) addSegment();
    // Trim old geometry only behind the last checkpoint. Retain any missed
    // bubbles near that checkpoint so falling doesn't erase a second chance.
    if (platforms.length > 38) {
      const cutoff = Math.min(checkpoint.x - 250, cameraX - 500);
      platforms = platforms.filter(p => p.x + p.w > cutoff);
      bubbles = bubbles.filter(b => !b.caught && b.x > cutoff);
    }
    for (const bubble of bubbles) {
      if (bubble.caught) continue;
      const closestX = clamp(bubble.x, player.x, player.x + player.w);
      const closestY = clamp(bubble.y, player.y, player.y + player.h);
      if (Math.hypot(closestX - bubble.x, closestY - bubble.y) > 29) continue;
      bubble.caught = true;
      collected = bubble.harmful ? Math.max(0, collected - 1) : collected + 1;
      updateScore();
      notice(bubble.harmful ? `${bubble.word}: −1. Keep going!` :
        `${bubble.word}: +1${bubble.bonus ? ' bonus!' : '!'}`, false);
      if (collected >= required) {
        state = level === 3 ? 'WIN' : 'LEVEL_COMPLETE';
        if (state === 'WIN') winQuote.textContent = `“${nextEndingQuote()}”`;
        show(level === 3 ? 'winScreen' : 'levelCompleteScreen');
        say(level === 3 ? `You completed Student Life! ${winQuote.textContent}` : `Level ${level} complete.`);
        break;
      }
    }
    if (noticeFrames > 0 && --noticeFrames === 0) message.textContent = '';
  }
  function notice(text, announce) {
    message.textContent = text;
    noticeFrames = 120;
    if (announce) say(text);
  }
  function drawBackground() {
    const bg = backgrounds[level - 1];
    ctx.fillStyle = '#9fdaef';
    ctx.fillRect(0, 0, W, H);
    if (imageReady(bg)) {
      const offset = (cameraX * 0.23) % W;
      ctx.drawImage(bg, -offset, 0, W, H);
      ctx.drawImage(bg, W - offset, 0, W, H);
    }
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    drawBackground();
    ctx.save();
    ctx.translate(-Math.round(cameraX), 0);
    for (const p of platforms) {
      if (p.x + p.w < cameraX - 100 || p.x > cameraX + W + 100) continue;
      ctx.fillStyle = '#538d6c';
      ctx.fillRect(p.x, p.y, p.w, 22);
      if (imageReady(tiles[p.tile])) ctx.drawImage(tiles[p.tile], p.x, p.y, p.w, 24);
      if (p.checkpoint) {
        // Checkpoint flags show where a safe respawn can be activated.
        ctx.fillStyle = lastCheckpointIndex >= p.index ? '#236445' : '#31506b';
        ctx.fillRect(p.x + p.w / 2, p.y - 45, 3, 45);
        ctx.beginPath();
        ctx.moveTo(p.x + p.w / 2 + 3, p.y - 45);
        ctx.lineTo(p.x + p.w / 2 + 35, p.y - 35);
        ctx.lineTo(p.x + p.w / 2 + 3, p.y - 25);
        ctx.closePath(); ctx.fill();
      }
    }
    for (const b of bubbles) {
      if (b.caught || b.x < cameraX - 100 || b.x > cameraX + W + 100) continue;
      if (imageReady(thoughtBubble)) ctx.drawImage(thoughtBubble, b.x - 51, b.y - 48, 102, 102);
      else {
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(b.x, b.y, 42, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = b.harmful ? '#922b35' : b.bonus ? '#166345' : '#18497a';
      ctx.textAlign = 'center';
      ctx.font = 'bold 15px Arial, sans-serif';
      ctx.fillText(b.word, b.x, b.y + 3, 94);
      if (b.bonus) { ctx.font = 'bold 10px Arial, sans-serif'; ctx.fillText('BONUS', b.x, b.y + 18); }
    }
    const action = !player.grounded ? 'jump' : Math.abs(player.vx) > 0.7 ? 'run' : 'idle';
    const animation = sprites[action];
    const frame = Math.floor(animationTime / (action === 'run' ? 5 : 8)) % animation.length;
    ctx.save();
    ctx.translate(player.x + player.w / 2, player.y + player.h / 2);
    if (!player.facingRight) ctx.scale(-1, 1);
    if (imageReady(animation[frame])) ctx.drawImage(animation[frame], -player.w / 2, -player.h / 2, player.w, player.h);
    else {
      ctx.fillStyle = '#215b84'; ctx.fillRect(-player.w / 2, -player.h / 2, player.w, player.h);
    }
    ctx.restore();
    ctx.restore();
  }
  function loop(now) {
    const elapsed = Math.min(0.1, (now - (lastTime || now)) / 1000);
    lastTime = now;
    accumulator += elapsed;
    const step = 1 / 60;
    let passes = 0;
    while (accumulator >= step && passes < 6) { tick(); accumulator -= step; passes += 1; }
    if (passes === 6) accumulator = 0;
    draw();
    window.requestAnimationFrame(loop);
  }
  setupLevel();
  show('startScreen');
  window.requestAnimationFrame(loop);
})();
