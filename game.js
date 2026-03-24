'use strict';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const ui = {
  score: document.getElementById('score'),
  timeAlive: document.getElementById('timeAlive'),
  phaseValue: document.getElementById('phaseValue'),
  phaseName: document.getElementById('phaseName'),
  comboValue: document.getElementById('comboValue'),
  integrityFill: document.getElementById('integrityFill'),
  integrityValue: document.getElementById('integrityValue'),
  pressureFill: document.getElementById('pressureFill'),
  pressureValue: document.getElementById('pressureValue'),
  shapeName: document.getElementById('shapeName'),
  meterFill: document.getElementById('meterFill'),
  meterLabel: document.getElementById('meterLabel'),
  statusText: document.getElementById('statusText'),
  warning: document.getElementById('warning'),
  gameOverText: document.getElementById('gameOverText'),
  summaryScore: document.getElementById('summaryScore'),
  summaryTime: document.getElementById('summaryTime'),
  summaryPhase: document.getElementById('summaryPhase'),
  formBadges: Array.from(document.querySelectorAll('[data-form-badge]')),
  overlays: {
    menu: document.getElementById('menuOverlay'),
    pause: document.getElementById('pauseOverlay'),
    gameOver: document.getElementById('gameOverOverlay')
  },
  buttons: {
    start: document.getElementById('startBtn'),
    resume: document.getElementById('resumeBtn'),
    restart: document.getElementById('restartBtn'),
    restartFromPause: document.getElementById('restartFromPauseBtn'),
    menu: document.getElementById('menuBtn'),
    menuFromGameOver: document.getElementById('menuFromGameOverBtn')
  },
  muteButtons: Array.from(document.querySelectorAll('[data-mute-toggle]'))
};

const W = canvas.width;
const H = canvas.height;
const LANES = [230, 360, 490];
const SHAPES = ['circle', 'triangle', 'square'];

const GAME_STATE = Object.freeze({
  MENU: 'MENU',
  PLAYING: 'PLAYING',
  PAUSED: 'PAUSED',
  GAMEOVER: 'GAMEOVER'
});

const COLORS = {
  cyan: '#00f6ff',
  magenta: '#ff36d6',
  yellow: '#ffe45b',
  red: '#ff4d6d',
  white: '#eafcff',
  violet: '#b261ff'
};

const SHAPE_COLORS = {
  circle: COLORS.cyan,
  triangle: COLORS.magenta,
  square: COLORS.yellow
};

const HAZARD_TYPES = {
  blocker: {
    width: 66,
    height: 66,
    damage: 28,
    speedScale: 1.0,
    shape: 'square'
  },
  laser: {
    width: 32,
    height: 128,
    damage: 22,
    speedScale: 1.08,
    shape: 'triangle'
  },
  barrier: {
    width: 96,
    height: 52,
    damage: 24,
    speedScale: 0.95,
    shape: 'square'
  },
  drone: {
    width: 46,
    height: 46,
    damage: 18,
    speedScale: 1.12,
    shape: 'circle'
  }
};

const PHASES = [
  {
    name: 'Warmup Drift',
    obstacleDelay: [1.45, 1.75],
    pickupDelay: [0.88, 1.14],
    hazardWeights: { blocker: 0.58, laser: 0.18, barrier: 0.24, drone: 0.0 },
    waveWeights: { single: 0.72, staggered: 0.18, safeLane: 0.10, double: 0.0, zigzag: 0.0 },
    pickupWeights: { turbo: 0.34, core: 0.40, score: 0.16, push: 0.10 }
  },
  {
    name: 'Pulse Traffic',
    obstacleDelay: [1.20, 1.46],
    pickupDelay: [0.84, 1.10],
    hazardWeights: { blocker: 0.42, laser: 0.24, barrier: 0.24, drone: 0.10 },
    waveWeights: { single: 0.45, staggered: 0.22, safeLane: 0.15, double: 0.18, zigzag: 0.0 },
    pickupWeights: { turbo: 0.30, core: 0.36, score: 0.20, push: 0.14 }
  },
  {
    name: 'Laser Weave',
    obstacleDelay: [1.00, 1.24],
    pickupDelay: [0.80, 1.04],
    hazardWeights: { blocker: 0.28, laser: 0.28, barrier: 0.22, drone: 0.22 },
    waveWeights: { single: 0.30, staggered: 0.22, safeLane: 0.16, double: 0.18, zigzag: 0.14 },
    pickupWeights: { turbo: 0.28, core: 0.34, score: 0.20, push: 0.18 }
  },
  {
    name: 'Glitch Crossfire',
    obstacleDelay: [0.88, 1.08],
    pickupDelay: [0.76, 1.00],
    hazardWeights: { blocker: 0.24, laser: 0.25, barrier: 0.21, drone: 0.30 },
    waveWeights: { single: 0.18, staggered: 0.26, safeLane: 0.14, double: 0.22, zigzag: 0.20 },
    pickupWeights: { turbo: 0.26, core: 0.32, score: 0.18, push: 0.24 }
  },
  {
    name: 'Collapse Vector',
    obstacleDelay: [0.76, 0.96],
    pickupDelay: [0.74, 0.96],
    hazardWeights: { blocker: 0.20, laser: 0.24, barrier: 0.22, drone: 0.34 },
    waveWeights: { single: 0.14, staggered: 0.24, safeLane: 0.12, double: 0.24, zigzag: 0.26 },
    pickupWeights: { turbo: 0.24, core: 0.30, score: 0.18, push: 0.28 }
  }
];

const audio = {
  enabled: true,
  context: null,
  master: null,

  unlock() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    if (!this.context) {
      this.context = new AudioCtx();
      this.master = this.context.createGain();
      this.master.gain.value = 0.06;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      this.context.resume();
    }
  },

  play(options) {
    if (!this.enabled) {
      return;
    }

    this.unlock();
    if (!this.context || !this.master) {
      return;
    }

    const {
      frequency = 440,
      duration = 0.08,
      type = 'sine',
      volume = 0.7,
      frequencyEnd = frequency,
      detune = 0
    } = options;

    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gainNode = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.linearRampToValueAtTime(frequencyEnd, now + duration);
    oscillator.detune.value = detune;

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(volume * 0.16, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.master);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  },

  pickup() {
    this.play({ frequency: 620, frequencyEnd: 880, duration: 0.09, type: 'triangle', volume: 0.8 });
  },

  score() {
    this.play({ frequency: 540, frequencyEnd: 740, duration: 0.12, type: 'square', volume: 0.6 });
  },

  damage() {
    this.play({ frequency: 220, frequencyEnd: 120, duration: 0.14, type: 'sawtooth', volume: 0.9 });
  },

  turbo() {
    this.play({ frequency: 320, frequencyEnd: 1200, duration: 0.16, type: 'sawtooth', volume: 0.85 });
  },

  form() {
    this.play({ frequency: 480, frequencyEnd: 640, duration: 0.07, type: 'triangle', volume: 0.55 });
  },

  ui() {
    this.play({ frequency: 410, frequencyEnd: 470, duration: 0.06, type: 'sine', volume: 0.4 });
  },

  mismatch() {
    this.play({ frequency: 300, frequencyEnd: 220, duration: 0.08, type: 'square', volume: 0.5 });
  },

  toggle() {
    this.enabled = !this.enabled;
    updateMuteButtons();
    if (this.enabled) {
      this.ui();
    }
  }
};

class Obstacle {
  constructor(config) {
    this.reset(config);
  }

  reset(config) {
    const stats = HAZARD_TYPES[config.type];
    this.type = config.type;
    this.shape = config.shape || stats.shape;
    this.x = config.x;
    this.y = config.y;
    this.baseY = config.y;
    this.lane = config.lane;
    this.width = config.width || stats.width;
    this.height = config.height || stats.height;
    this.damage = config.damage || stats.damage;
    this.speedScale = config.speedScale || stats.speedScale;
    this.waveAmplitude = config.waveAmplitude || 0;
    this.waveSpeed = config.waveSpeed || 0;
    this.waveOffset = config.waveOffset || Math.random() * Math.PI * 2;
    this.age = 0;
    this.active = true;
  }

  update(dt, scrollSpeed) {
    this.age += dt;
    this.x -= dt * scrollSpeed * this.speedScale;

    if (this.waveAmplitude > 0) {
      this.y = this.baseY + Math.sin(this.age * this.waveSpeed + this.waveOffset) * this.waveAmplitude;
    }
  }

  getBounds() {
    return {
      x: this.x - this.width / 2,
      y: this.y - this.height / 2,
      width: this.width,
      height: this.height
    };
  }
}

class Pickup {
  constructor(config) {
    this.reset(config);
  }

  reset(config) {
    this.type = config.type;
    this.shape = config.shape || null;
    this.x = config.x;
    this.y = config.y;
    this.lane = config.lane;
    this.size = config.size || 20;
    this.spin = config.spin || 3.4;
    this.speedScale = config.speedScale || 0.92;
    this.pulse = config.pulse || Math.random() * Math.PI * 2;
    this.rotation = config.rotation || 0;
    this.active = true;
  }

  update(dt, scrollSpeed) {
    this.x -= dt * scrollSpeed * this.speedScale;
    this.pulse += dt * 5.6;
    this.rotation += dt * this.spin;
  }

  getBounds() {
    const size = this.size * 1.9;
    return {
      x: this.x - size / 2,
      y: this.y - size / 2,
      width: size,
      height: size
    };
  }
}

const game = {
  state: GAME_STATE.MENU,
  rafId: 0,
  lastFrameTime: 0,
  timeAlive: 0,
  score: 0,
  distance: 0,
  phase: 1,
  highestPhase: 1,
  globalSpeed: 1,
  obstacleTimer: 1.3,
  pickupTimer: 0.9,
  gridOffset: 0,
  stars: [],
  particles: [],
  floaters: [],
  obstacles: [],
  pickups: [],
  shake: 0,
  flash: 0,
  combo: 0,
  comboTimer: 0,
  statusText: 'Match forms with cores to recover integrity and push the wall back.',
  statusTone: COLORS.white,
  statusTimer: 3.5,
  lastHelpfulPickupAt: 0,
  lastHUD: {}
};

const player = {
  x: 220,
  y: LANES[1],
  lane: 1,
  targetY: LANES[1],
  width: 60,
  height: 42,
  shape: 'triangle',
  integrity: 100,
  maxIntegrity: 100,
  turbo: 28,
  turboActive: 0,
  invulnerable: 0,
  hitTint: 0,
  trailTimer: 0
};

const glitchWall = {
  x: -190,
  pressure: 0.14,
  pressureBias: 0,
  danger: 0
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function chooseRandom(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function weightedChoice(weights) {
  const entries = Object.entries(weights).filter(([, value]) => value > 0);
  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  let roll = Math.random() * total;

  for (const [key, value] of entries) {
    roll -= value;
    if (roll <= 0) {
      return key;
    }
  }

  return entries.length ? entries[entries.length - 1][0] : null;
}

function formatTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const remainingSeconds = String(totalSeconds % 60).padStart(2, '0');
  return `${minutes}:${remainingSeconds}`;
}

function formatShape(shape) {
  return shape.charAt(0).toUpperCase() + shape.slice(1);
}

function getPhaseConfig() {
  return PHASES[Math.min(PHASES.length - 1, game.phase - 1)];
}

function getPlayerBounds() {
  return {
    x: player.x - player.width / 2,
    y: player.y - player.height / 2,
    width: player.width,
    height: player.height
  };
}

function rectsOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function setStatus(message, duration, tone) {
  game.statusText = message;
  game.statusTimer = duration;
  game.statusTone = tone || COLORS.white;
}

function clearEntities() {
  game.obstacles.length = 0;
  game.pickups.length = 0;
  game.particles.length = 0;
  game.floaters.length = 0;
}

function initStars() {
  game.stars = Array.from({ length: 95 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H * 0.67,
    size: Math.random() * 1.9 + 0.4,
    speed: Math.random() * 15 + 6,
    alpha: Math.random() * 0.75 + 0.18
  }));
}

function showOverlay(name) {
  Object.values(ui.overlays).forEach((overlay) => {
    overlay.classList.remove('show');
  });

  if (name) {
    ui.overlays[name].classList.add('show');
  }
}

function stopLoop() {
  if (game.rafId) {
    cancelAnimationFrame(game.rafId);
    game.rafId = 0;
  }
}

function startLoop() {
  if (game.rafId) {
    return;
  }

  game.lastFrameTime = performance.now();
  game.rafId = requestAnimationFrame(frame);
}

function resetWorld() {
  clearEntities();
  game.timeAlive = 0;
  game.score = 0;
  game.distance = 0;
  game.phase = 1;
  game.highestPhase = 1;
  game.globalSpeed = 1;
  game.obstacleTimer = 1.42;
  game.pickupTimer = 0.94;
  game.gridOffset = 0;
  game.shake = 0;
  game.flash = 0;
  game.combo = 0;
  game.comboTimer = 0;
  game.lastHelpfulPickupAt = 0;
  setStatus('Match forms with cores to recover integrity and push the wall back.', 3.6, COLORS.white);

  player.y = LANES[1];
  player.lane = 1;
  player.targetY = LANES[1];
  player.shape = 'triangle';
  player.integrity = player.maxIntegrity;
  player.turbo = 28;
  player.turboActive = 0;
  player.invulnerable = 0;
  player.hitTint = 0;
  player.trailTimer = 0;

  glitchWall.x = -190;
  glitchWall.pressure = 0.14;
  glitchWall.pressureBias = 0;
  glitchWall.danger = 0;
}

function updateMuteButtons() {
  const label = audio.enabled ? 'Sound: On' : 'Sound: Off';
  ui.muteButtons.forEach((button) => {
    button.textContent = label;
  });
}

function updateSummary(reason) {
  ui.gameOverText.textContent = reason;
  ui.summaryScore.textContent = String(Math.floor(game.score)).padStart(6, '0');
  ui.summaryTime.textContent = formatTime(game.timeAlive);
  ui.summaryPhase.textContent = String(game.highestPhase).padStart(2, '0');
}

function updateHUD(force = false) {
  const comboMultiplier = (1 + game.combo * 0.12).toFixed(1);
  const pressurePercent = Math.round(Math.max(glitchWall.pressure, glitchWall.danger) * 100);
  const pressureLabel =
    pressurePercent < 30 ? 'Stable' :
    pressurePercent < 60 ? 'Tense' :
    pressurePercent < 80 ? 'Critical' :
    'Collapse';

  const nextHUD = {
    score: String(Math.floor(game.score)).padStart(6, '0'),
    timeAlive: formatTime(game.timeAlive),
    phaseValue: String(game.phase).padStart(2, '0'),
    phaseName: getPhaseConfig().name,
    comboValue: `Combo x${comboMultiplier}`,
    integrityValue: `${Math.round(player.integrity)} / ${player.maxIntegrity}`,
    shapeName: formatShape(player.shape),
    meterLabel: `Turbo ${Math.round(player.turbo)}%`,
    pressureValue: `${pressureLabel} ${pressurePercent}%`,
    statusText: game.statusText
  };

  for (const [key, value] of Object.entries(nextHUD)) {
    if (force || game.lastHUD[key] !== value) {
      ui[key].textContent = value;
      game.lastHUD[key] = value;
    }
  }

  const integrityWidth = `${(player.integrity / player.maxIntegrity) * 100}%`;
  const turboWidth = `${player.turbo}%`;
  const pressureWidth = `${pressurePercent}%`;

  if (force || game.lastHUD.integrityWidth !== integrityWidth) {
    ui.integrityFill.style.width = integrityWidth;
    game.lastHUD.integrityWidth = integrityWidth;
  }

  if (force || game.lastHUD.turboWidth !== turboWidth) {
    ui.meterFill.style.width = turboWidth;
    game.lastHUD.turboWidth = turboWidth;
  }

  if (force || game.lastHUD.pressureWidth !== pressureWidth) {
    ui.pressureFill.style.width = pressureWidth;
    game.lastHUD.pressureWidth = pressureWidth;
  }

  if (force || game.lastHUD.statusTone !== game.statusTone) {
    ui.statusText.style.color = game.statusTone;
    game.lastHUD.statusTone = game.statusTone;
  }

  const warningActive = game.state === GAME_STATE.PLAYING && glitchWall.danger > 0.48;
  ui.warning.classList.toggle('active', warningActive);

  ui.formBadges.forEach((badge) => {
    badge.classList.toggle('active', badge.dataset.formBadge === player.shape);
  });
}

function addParticle(x, y, color, options = {}) {
  game.particles.push({
    x,
    y,
    vx: options.vx || randomBetween(-120, 120),
    vy: options.vy || randomBetween(-70, 70),
    life: options.life || 0.55,
    maxLife: options.life || 0.55,
    color,
    size: options.size || randomBetween(2, 4)
  });
}

function burst(x, y, color, count = 16, scale = 1) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomBetween(80, 220) * scale;
    addParticle(x, y, color, {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomBetween(0.32, 0.7),
      size: randomBetween(2, 5)
    });
  }
}

function addFloater(x, y, text, color) {
  game.floaters.push({
    x,
    y,
    text,
    color,
    life: 1.0,
    maxLife: 1.0
  });
}

function emitTrail() {
  const color = player.turboActive > 0 ? COLORS.yellow : SHAPE_COLORS[player.shape];
  addParticle(player.x - 24, player.y, color, {
    vx: randomBetween(-200, -100),
    vy: randomBetween(-28, 28),
    life: randomBetween(0.22, 0.42),
    size: randomBetween(2, 4)
  });
}

function createObstacle(type, lane, xOffset = 0, overrides = {}) {
  const stats = HAZARD_TYPES[type];
  const laneIndex = clamp(lane, 0, LANES.length - 1);

  game.obstacles.push(new Obstacle({
    type,
    lane: laneIndex,
    x: W + 120 + xOffset,
    y: LANES[laneIndex],
    width: stats.width,
    height: stats.height,
    damage: stats.damage,
    speedScale: stats.speedScale,
    shape: stats.shape,
    ...overrides
  }));
}

function createPickup(type, lane, xOffset = 0, overrides = {}) {
  const laneIndex = clamp(lane, 0, LANES.length - 1);

  game.pickups.push(new Pickup({
    type,
    lane: laneIndex,
    x: W + 110 + xOffset,
    y: LANES[laneIndex],
    ...overrides
  }));
}

function chooseLane(preferPlayerLane = false) {
  if (preferPlayerLane && Math.random() < 0.5) {
    return player.lane;
  }

  return Math.floor(Math.random() * LANES.length);
}

function chooseDifferentLane(currentLane) {
  const options = [0, 1, 2].filter((lane) => lane !== currentLane);
  return chooseRandom(options);
}

function chooseShapeForCore() {
  if (Math.random() < 0.62) {
    return player.shape;
  }

  return chooseRandom(SHAPES);
}

function spawnHazardWave() {
  const config = getPhaseConfig();
  const pattern = weightedChoice(config.waveWeights);

  if (!pattern) {
    return;
  }

  if (pattern === 'single') {
    createObstacle(weightedChoice(config.hazardWeights), chooseLane(game.phase === 1));
    return;
  }

  if (pattern === 'staggered') {
    const firstLane = chooseLane(game.phase <= 2);
    const secondLane = chooseDifferentLane(firstLane);
    createObstacle(weightedChoice(config.hazardWeights), firstLane);
    createObstacle(weightedChoice(config.hazardWeights), secondLane, 180);
    return;
  }

  if (pattern === 'safeLane') {
    const safeLane = chooseLane(false);
    [0, 1, 2]
      .filter((lane) => lane !== safeLane)
      .forEach((lane, index) => {
        createObstacle(index === 0 ? 'laser' : 'barrier', lane, index * 18);
      });
    return;
  }

  if (pattern === 'double') {
    const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
    createObstacle(weightedChoice(config.hazardWeights), lanes[0], 0);
    createObstacle(weightedChoice(config.hazardWeights), lanes[1], 40);
    return;
  }

  const lane = chooseLane(false);
  const otherLane = chooseDifferentLane(lane);
  createObstacle('drone', lane, 0, {
    waveAmplitude: 52 + game.phase * 6,
    waveSpeed: 4.5 + game.phase * 0.3
  });
  createObstacle(Math.random() < 0.5 ? 'laser' : 'blocker', otherLane, 170);
}

function spawnPickupWave() {
  const config = getPhaseConfig();
  const weights = { ...config.pickupWeights };
  const noSupportFor = game.timeAlive - game.lastHelpfulPickupAt;

  if (player.integrity < 68) {
    weights.core += 0.18;
    weights.push += 0.08;
  }

  if (player.turbo < 55) {
    weights.turbo += 0.14;
  }

  if (noSupportFor > 8) {
    weights.core += 0.18;
    weights.push += 0.16;
  }

  const type = weightedChoice(weights);
  const lane = chooseLane(game.phase <= 2);

  if (type === 'turbo') {
    createPickup('turbo', lane, 0, { size: 16, spin: 4.2 });
    if (Math.random() < 0.35) {
      createPickup('turbo', lane, 72, { size: 15, spin: 4.2 });
    }
    return;
  }

  if (type === 'core') {
    createPickup('core', lane, 0, { shape: chooseShapeForCore(), size: 19, spin: 2.8 });

    if (game.phase >= 3 && Math.random() < 0.45) {
      createPickup('core', chooseDifferentLane(lane), 110, {
        shape: chooseRandom(SHAPES.filter((shape) => shape !== player.shape)),
        size: 17,
        spin: 2.6
      });
    }
    return;
  }

  if (type === 'score') {
    createPickup('score', lane, 0, { size: 16, spin: 3.8 });
    createPickup('score', lane, 74, { size: 16, spin: 3.8 });
    return;
  }

  createPickup('push', lane, 0, { size: 19, spin: 2.2 });
}

function increaseCombo(amount = 1) {
  game.combo = clamp(game.combo + amount, 0, 6);
  game.comboTimer = 4.5;
}

function resetCombo() {
  game.combo = 0;
  game.comboTimer = 0;
}

function pushWall(amount, retreatPixels) {
  glitchWall.pressureBias = clamp(glitchWall.pressureBias - amount, -0.4, 0.7);
  glitchWall.x = clamp(glitchWall.x - retreatPixels, -220, player.x - 24);
  game.lastHelpfulPickupAt = game.timeAlive;
}

function stressWall(amount, forwardPixels) {
  glitchWall.pressureBias = clamp(glitchWall.pressureBias + amount, -0.4, 0.7);
  glitchWall.x = clamp(glitchWall.x + forwardPixels, -220, player.x - 24);
}

function handlePickup(pickup) {
  const scoreMultiplier = 1 + game.combo * 0.12;

  if (pickup.type === 'turbo') {
    player.turbo = clamp(player.turbo + 24, 0, 100);
    game.score += 90 * scoreMultiplier;
    increaseCombo();
    pushWall(0.05, 12);
    setStatus('Turbo cells routed.', 1.2, COLORS.yellow);
    addFloater(pickup.x, pickup.y - 24, '+Turbo', COLORS.yellow);
    burst(pickup.x, pickup.y, COLORS.yellow, 10, 0.8);
    audio.pickup();
    return;
  }

  if (pickup.type === 'score') {
    game.score += 190 * scoreMultiplier;
    increaseCombo(2);
    pushWall(0.03, 10);
    setStatus('Score shard spike.', 1.0, COLORS.white);
    addFloater(pickup.x, pickup.y - 24, `+${Math.round(190 * scoreMultiplier)}`, COLORS.white);
    burst(pickup.x, pickup.y, COLORS.white, 10, 0.7);
    audio.score();
    return;
  }

  if (pickup.type === 'push') {
    game.score += 70 * scoreMultiplier;
    increaseCombo();
    pushWall(0.2, 78);
    player.turbo = clamp(player.turbo + 8, 0, 100);
    setStatus('Glitch relay pushed the wall back.', 1.4, COLORS.red);
    addFloater(pickup.x, pickup.y - 24, 'WALL BACK', COLORS.red);
    burst(pickup.x, pickup.y, COLORS.red, 14, 0.95);
    audio.pickup();
    return;
  }

  if (pickup.shape === player.shape) {
    const restored = Math.min(20, player.maxIntegrity - player.integrity);
    player.integrity = clamp(player.integrity + 20, 0, player.maxIntegrity);
    game.score += 130 * scoreMultiplier;
    increaseCombo();
    pushWall(0.18, 50);
    setStatus(`${formatShape(player.shape)} core aligned.`, 1.4, SHAPE_COLORS[player.shape]);
    addFloater(pickup.x, pickup.y - 24, restored > 0 ? `+${restored} INT` : 'PERFECT', SHAPE_COLORS[player.shape]);
    burst(pickup.x, pickup.y, SHAPE_COLORS[player.shape], 14, 0.9);
    audio.pickup();
    return;
  }

  player.turbo = clamp(player.turbo - 8, 0, 100);
  stressWall(0.08, 8);
  resetCombo();
  setStatus(`Mismatch. ${formatShape(pickup.shape)} core rejected.`, 1.4, COLORS.red);
  addFloater(pickup.x, pickup.y - 24, 'MISMATCH', COLORS.red);
  burst(pickup.x, pickup.y, COLORS.red, 10, 0.7);
  audio.mismatch();
}

function handleMissedPickup(pickup) {
  if (pickup.type === 'core' && pickup.shape === player.shape) {
    stressWall(0.05, 10);
  }

  if (pickup.type === 'push' && glitchWall.danger > 0.42) {
    stressWall(0.03, 8);
  }
}

function damagePlayer(amount, reason, sourceX, sourceY) {
  if (player.invulnerable > 0 || game.state !== GAME_STATE.PLAYING) {
    return;
  }

  player.integrity = clamp(player.integrity - amount, 0, player.maxIntegrity);
  player.invulnerable = 1.0;
  player.hitTint = 1.0;
  game.shake = Math.max(game.shake, 14);
  game.flash = Math.max(game.flash, 0.22);
  stressWall(0.18, 24);
  resetCombo();
  setStatus(`Integrity hit. -${amount}.`, 1.2, COLORS.red);
  addFloater(sourceX, sourceY - 24, `-${amount}`, COLORS.red);
  burst(sourceX, sourceY, COLORS.red, 16, 1.0);
  audio.damage();

  if (player.integrity <= 0) {
    endRun(reason || 'Integrity collapsed under impact.');
  }
}

function moveLane(direction) {
  player.lane = clamp(player.lane + direction, 0, LANES.length - 1);
  player.targetY = LANES[player.lane];
}

function setPlayerShape(shape) {
  if (!SHAPES.includes(shape) || player.shape === shape || game.state !== GAME_STATE.PLAYING) {
    return;
  }

  player.shape = shape;
  burst(player.x, player.y, SHAPE_COLORS[shape], 8, 0.55);
  setStatus(`${formatShape(shape)} mode engaged.`, 0.95, SHAPE_COLORS[shape]);
  audio.form();
}

function cycleShape(direction) {
  const currentIndex = SHAPES.indexOf(player.shape);
  const nextIndex = (currentIndex + direction + SHAPES.length) % SHAPES.length;
  setPlayerShape(SHAPES[nextIndex]);
}

function activateTurbo() {
  if (game.state !== GAME_STATE.PLAYING || player.turbo < 100 || player.turboActive > 0) {
    return;
  }

  player.turbo = 0;
  player.turboActive = 1.6;
  game.flash = Math.max(game.flash, 0.18);
  pushWall(0.08, 30);
  setStatus('Turbo burst online.', 1.1, COLORS.yellow);
  burst(player.x, player.y, COLORS.yellow, 22, 1.1);
  audio.turbo();
}

function updateProgression(dt) {
  game.timeAlive += dt;
  game.globalSpeed = 1 + 0.05 * Math.floor(game.timeAlive / 15);

  const scoreRate = (28 + (game.phase - 1) * 5) * game.globalSpeed * (1 + game.combo * 0.08);
  game.score += dt * scoreRate;

  const nextPhase = 1 + Math.floor(game.score / 1000);
  if (nextPhase !== game.phase) {
    game.phase = nextPhase;
    game.highestPhase = Math.max(game.highestPhase, game.phase);
    pushWall(0.06, 18);
    setStatus(`Phase ${String(game.phase).padStart(2, '0')} online: ${getPhaseConfig().name}.`, 2.0, COLORS.cyan);
    burst(player.x + 24, player.y, COLORS.cyan, 14, 0.7);
    audio.ui();
  }
}

function updateWall(dt) {
  const timeWithoutSupport = game.timeAlive - game.lastHelpfulPickupAt;
  const lowIntegrity = 1 - player.integrity / player.maxIntegrity;
  const basePressure = 0.12 + (game.phase - 1) * 0.05 + (game.globalSpeed - 1) * 0.45;
  const supportPenalty = timeWithoutSupport > 10 ? Math.min(0.42, (timeWithoutSupport - 10) * 0.06) : 0;

  if (glitchWall.pressureBias > 0) {
    glitchWall.pressureBias = Math.max(0, glitchWall.pressureBias - dt * 0.05);
  } else {
    glitchWall.pressureBias = Math.min(0, glitchWall.pressureBias + dt * 0.06);
  }

  glitchWall.pressure = clamp(
    basePressure + supportPenalty + lowIntegrity * 0.34 + glitchWall.pressureBias - (player.turboActive > 0 ? 0.08 : 0),
    0.06,
    1
  );

  const wallSpeed =
    16 +
    (game.phase - 1) * 5 +
    game.globalSpeed * 12 +
    glitchWall.pressure * 94 +
    lowIntegrity * 40 -
    (player.turboActive > 0 ? 34 : 0);

  glitchWall.x += dt * wallSpeed;
  glitchWall.x = clamp(glitchWall.x, -220, player.x - 24);

  const gap = player.x - glitchWall.x;
  glitchWall.danger = clamp(1 - (gap - 54) / 260, 0, 1);

  if (gap < 54) {
    endRun('The Glitch Wall collapsed the route.');
  }
}

function checkCollisions() {
  const playerBounds = getPlayerBounds();

  for (let i = game.obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = game.obstacles[i];
    if (!obstacle.active) {
      game.obstacles.splice(i, 1);
      continue;
    }

    if (rectsOverlap(playerBounds, obstacle.getBounds())) {
      if (player.turboActive > 0) {
        game.score += 55;
        pushWall(0.04, 10);
        burst(obstacle.x, obstacle.y, COLORS.yellow, 14, 0.8);
        addFloater(obstacle.x, obstacle.y - 18, 'SHRED', COLORS.yellow);
        game.obstacles.splice(i, 1);
      } else {
        const reason = obstacle.type === 'laser'
          ? 'A laser gate shredded the hull.'
          : 'A hazard impact broke your integrity.';
        game.obstacles.splice(i, 1);
        damagePlayer(obstacle.damage, reason, obstacle.x, obstacle.y);

        if (game.state !== GAME_STATE.PLAYING) {
          return;
        }
      }
    }
  }

  for (let i = game.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = game.pickups[i];
    if (!pickup.active) {
      game.pickups.splice(i, 1);
      continue;
    }

    if (rectsOverlap(playerBounds, pickup.getBounds())) {
      handlePickup(pickup);
      game.pickups.splice(i, 1);
    }
  }
}

function updateEntities(dt, scrollSpeed) {
  for (let i = game.obstacles.length - 1; i >= 0; i -= 1) {
    const obstacle = game.obstacles[i];
    obstacle.update(dt, scrollSpeed);

    if (obstacle.x + obstacle.width < -120) {
      game.obstacles.splice(i, 1);
    }
  }

  for (let i = game.pickups.length - 1; i >= 0; i -= 1) {
    const pickup = game.pickups[i];
    pickup.update(dt, scrollSpeed);

    if (pickup.x + pickup.size < -80) {
      handleMissedPickup(pickup);
      game.pickups.splice(i, 1);
    }
  }

  for (let i = game.particles.length - 1; i >= 0; i -= 1) {
    const particle = game.particles[i];
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.life -= dt;

    if (particle.life <= 0) {
      game.particles.splice(i, 1);
    }
  }

  for (let i = game.floaters.length - 1; i >= 0; i -= 1) {
    const floater = game.floaters[i];
    floater.y -= dt * 34;
    floater.life -= dt;

    if (floater.life <= 0) {
      game.floaters.splice(i, 1);
    }
  }
}

function update(dt) {
  if (game.state !== GAME_STATE.PLAYING) {
    return;
  }

  updateProgression(dt);

  const scrollSpeed = (285 + (game.phase - 1) * 22) * game.globalSpeed + (player.turboActive > 0 ? 180 : 0);
  game.distance += dt * scrollSpeed * 0.12;
  game.gridOffset += dt * scrollSpeed * 0.62;

  player.y = lerp(player.y, player.targetY, Math.min(1, dt * 12));
  player.invulnerable = Math.max(0, player.invulnerable - dt);
  player.hitTint = Math.max(0, player.hitTint - dt * 1.7);
  player.trailTimer += dt;

  if (player.trailTimer >= 0.035) {
    player.trailTimer = 0;
    emitTrail();
  }

  if (player.turboActive > 0) {
    player.turboActive = Math.max(0, player.turboActive - dt);
  }

  if (game.comboTimer > 0) {
    game.comboTimer -= dt;
    if (game.comboTimer <= 0) {
      resetCombo();
    }
  }

  if (game.statusTimer > 0) {
    game.statusTimer -= dt;
    if (game.statusTimer <= 0) {
      setStatus('Match forms with cores to recover integrity and push the wall back.', 0.01, COLORS.white);
    }
  }

  game.obstacleTimer -= dt;
  if (game.obstacleTimer <= 0) {
    spawnHazardWave();
    const phaseConfig = getPhaseConfig();
    const cooldown = randomBetween(phaseConfig.obstacleDelay[0], phaseConfig.obstacleDelay[1]);
    game.obstacleTimer = cooldown / (1 + (game.globalSpeed - 1) * 0.25);
  }

  game.pickupTimer -= dt;
  if (game.pickupTimer <= 0) {
    spawnPickupWave();
    const phaseConfig = getPhaseConfig();
    game.pickupTimer = randomBetween(phaseConfig.pickupDelay[0], phaseConfig.pickupDelay[1]);
  }

  updateEntities(dt, scrollSpeed);
  checkCollisions();
  updateWall(dt);

  if (game.state !== GAME_STATE.PLAYING) {
    return;
  }

  game.stars.forEach((star) => {
    star.x -= dt * star.speed * (1 + (game.globalSpeed - 1) * 0.5);
    if (star.x < -10) {
      star.x = W + 10;
      star.y = Math.random() * H * 0.67;
    }
  });

  if (game.shake > 0) {
    game.shake = Math.max(0, game.shake - dt * 30);
  }

  if (game.flash > 0) {
    game.flash = Math.max(0, game.flash - dt * 1.6);
  }

  updateHUD();
}

function drawShapeGlyph(shape, size, fill, stroke = null) {
  ctx.beginPath();

  if (shape === 'circle') {
    ctx.arc(0, 0, size, 0, Math.PI * 2);
  } else if (shape === 'triangle') {
    ctx.moveTo(0, -size);
    ctx.lineTo(size * 0.95, size);
    ctx.lineTo(-size * 0.95, size);
    ctx.closePath();
  } else {
    ctx.rect(-size, -size, size * 2, size * 2);
  }

  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }

  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function drawBackground() {
  ctx.fillStyle = '#05070d';
  ctx.fillRect(0, 0, W, H);

  const horizonY = 168;
  const skyGradient = ctx.createLinearGradient(0, 0, 0, H);
  skyGradient.addColorStop(0, '#0b1028');
  skyGradient.addColorStop(0.52, '#0b081a');
  skyGradient.addColorStop(1, '#04050a');
  ctx.fillStyle = skyGradient;
  ctx.fillRect(0, 0, W, H);

  const sunX = 1030;
  const sunY = 126;
  const sun = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 146);
  sun.addColorStop(0, 'rgba(255, 124, 188, 0.92)');
  sun.addColorStop(0.45, 'rgba(170, 92, 255, 0.26)');
  sun.addColorStop(1, 'rgba(170, 92, 255, 0)');
  ctx.fillStyle = sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 146, 0, Math.PI * 2);
  ctx.fill();

  for (const star of game.stars) {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = '#f8ffff';
    ctx.fillRect(star.x, star.y, star.size, star.size);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = 'rgba(0, 246, 255, 0.16)';
  for (let i = 0; i < 18; i += 1) {
    const t = i / 17;
    const y = horizonY + t * t * 520;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  const spacing = 68;
  const offset = game.gridOffset % spacing;
  for (let x = -W; x < W * 2; x += spacing) {
    ctx.strokeStyle = 'rgba(255, 54, 214, 0.18)';
    ctx.beginPath();
    ctx.moveTo(W / 2 + (x + offset - W / 2) * 0.16, horizonY);
    ctx.lineTo(x + offset, H);
    ctx.stroke();
  }

  LANES.forEach((laneY, index) => {
    const active = index === player.lane;
    ctx.strokeStyle = active ? 'rgba(0, 246, 255, 0.26)' : 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = active ? 2.5 : 2;
    ctx.setLineDash([16, 16]);
    ctx.beginPath();
    ctx.moveTo(0, laneY + 38);
    ctx.lineTo(W, laneY + 38);
    ctx.stroke();
  });
  ctx.setLineDash([]);
}

function drawGlitchWall() {
  const wallWidth = Math.max(56, glitchWall.x + 30);
  const intensity = 0.3 + glitchWall.danger * 0.55;
  const gradient = ctx.createLinearGradient(0, 0, wallWidth, 0);
  gradient.addColorStop(0, `rgba(255, 32, 92, ${0.95 * intensity})`);
  gradient.addColorStop(0.52, `rgba(255, 68, 130, ${0.45 * intensity})`);
  gradient.addColorStop(1, 'rgba(255, 68, 130, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, wallWidth, H);

  for (let y = 0; y < H; y += 12) {
    const width = 24 + Math.random() * 46;
    const xOffset = Math.random() * 22;
    ctx.fillStyle = Math.random() > 0.42
      ? 'rgba(255, 255, 255, 0.08)'
      : 'rgba(255, 77, 109, 0.18)';
    ctx.fillRect(glitchWall.x - xOffset, y, width, 4 + Math.random() * 3);
  }
}

function drawPlayer() {
  const color = player.turboActive > 0 ? COLORS.yellow : SHAPE_COLORS[player.shape];
  const alpha = player.invulnerable > 0 && Math.floor(player.invulnerable * 12) % 2 === 0 ? 0.45 : 1;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(player.x, player.y);
  ctx.shadowBlur = player.turboActive > 0 ? 34 : 26;
  ctx.shadowColor = color;

  if (player.shape === 'circle') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(-2, 0, 19, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.fillRect(4, -4, 18, 8);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(-12, -11);
    ctx.lineTo(-12, 11);
    ctx.closePath();
    ctx.fill();
  } else if (player.shape === 'triangle') {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-28, 0);
    ctx.lineTo(-6, -18);
    ctx.lineTo(24, -8);
    ctx.lineTo(28, 0);
    ctx.lineTo(24, 8);
    ctx.lineTo(-6, 18);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.fillRect(-4, -4, 18, 8);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(-20, -18, 36, 36);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillRect(-6, -6, 12, 12);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(16, -10);
    ctx.lineTo(30, 0);
    ctx.lineTo(16, 10);
    ctx.closePath();
    ctx.fill();
  }

  if (player.turboActive > 0) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.86)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 42 + Math.sin(performance.now() * 0.02) * 4, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawObstacle(obstacle) {
  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  ctx.shadowBlur = obstacle.type === 'drone' ? 26 : 24;
  ctx.shadowColor = obstacle.type === 'drone' ? COLORS.cyan : COLORS.magenta;

  if (obstacle.type === 'laser') {
    ctx.fillStyle = COLORS.magenta;
    ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillRect(-4, -obstacle.height / 2, 8, obstacle.height);
  } else if (obstacle.type === 'barrier') {
    ctx.fillStyle = COLORS.violet;
    ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.48)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
  } else if (obstacle.type === 'drone') {
    drawShapeGlyph('circle', 16, COLORS.cyan, 'rgba(255, 255, 255, 0.7)');
    ctx.rotate(Math.PI / 4);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 3;
    ctx.strokeRect(-14, -14, 28, 28);
  } else {
    ctx.fillStyle = COLORS.magenta;
    ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.44)';
    ctx.lineWidth = 2;
    ctx.strokeRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.fillRect(-8, -8, 16, 16);
  ctx.restore();
}

function drawPickup(pickup) {
  const pulse = 1 + Math.sin(pickup.pulse) * 0.12;
  ctx.save();
  ctx.translate(pickup.x, pickup.y);
  ctx.scale(pulse, pulse);
  ctx.rotate(pickup.rotation);

  if (pickup.type === 'turbo') {
    ctx.shadowBlur = 22;
    ctx.shadowColor = COLORS.yellow;
    ctx.fillStyle = COLORS.yellow;
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-12, -12, 24, 24);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.82)';
    ctx.fillRect(-4, -4, 8, 8);
  } else if (pickup.type === 'score') {
    ctx.shadowBlur = 20;
    ctx.shadowColor = COLORS.white;
    ctx.fillStyle = COLORS.white;
    for (let i = 0; i < 4; i += 1) {
      ctx.rotate(Math.PI / 2);
      ctx.fillRect(-3, -14, 6, 18);
    }
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
  } else if (pickup.type === 'push') {
    ctx.shadowBlur = 24;
    ctx.shadowColor = COLORS.red;
    ctx.strokeStyle = COLORS.red;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(8, -12);
    ctx.lineTo(-6, 0);
    ctx.lineTo(8, 12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-6, -12);
    ctx.lineTo(-20, 0);
    ctx.lineTo(-6, 12);
    ctx.stroke();
  } else {
    const color = SHAPE_COLORS[pickup.shape];
    ctx.shadowBlur = 22;
    ctx.shadowColor = color;
    drawShapeGlyph(pickup.shape, 15, color, 'rgba(255, 255, 255, 0.65)');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.92)';
    ctx.fillRect(-2, -9, 4, 18);
    ctx.fillRect(-9, -2, 18, 4);
  }

  ctx.restore();
}

function drawParticles() {
  for (const particle of game.particles) {
    const alpha = Math.max(0, particle.life / particle.maxLife);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.shadowBlur = 14;
    ctx.shadowColor = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawFloaters() {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';

  for (const floater of game.floaters) {
    ctx.globalAlpha = floater.life / floater.maxLife;
    ctx.fillStyle = floater.color;
    ctx.shadowBlur = 18;
    ctx.shadowColor = floater.color;
    ctx.fillText(floater.text, floater.x, floater.y);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 0;
}

function drawVignette() {
  const lowIntegrity = 1 - player.integrity / player.maxIntegrity;
  const danger = Math.max(lowIntegrity * 0.7, glitchWall.danger * 0.8);
  if (danger <= 0.02) {
    return;
  }

  const vignette = ctx.createRadialGradient(W / 2, H / 2, 160, W / 2, H / 2, 680);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, `rgba(255, 20, 72, ${danger * 0.28})`);
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);
}

function drawFlash() {
  if (game.flash <= 0) {
    return;
  }

  ctx.fillStyle = `rgba(255, 255, 255, ${game.flash * 0.22})`;
  ctx.fillRect(0, 0, W, H);
}

function drawScene() {
  ctx.save();

  if (game.shake > 0) {
    ctx.translate((Math.random() - 0.5) * game.shake, (Math.random() - 0.5) * game.shake);
  }

  drawBackground();
  drawGlitchWall();
  game.pickups.forEach(drawPickup);
  game.obstacles.forEach(drawObstacle);
  drawParticles();
  drawPlayer();
  drawFloaters();
  drawVignette();
  drawFlash();

  ctx.restore();
}

function enterMenu() {
  stopLoop();
  resetWorld();
  game.state = GAME_STATE.MENU;
  showOverlay('menu');
  updateHUD(true);
  drawScene();
}

function startRun() {
  resetWorld();
  game.state = GAME_STATE.PLAYING;
  showOverlay(null);
  updateHUD(true);
  drawScene();
  startLoop();
}

function pauseGame() {
  if (game.state !== GAME_STATE.PLAYING) {
    return;
  }

  game.state = GAME_STATE.PAUSED;
  stopLoop();
  showOverlay('pause');
  updateHUD(true);
  audio.ui();
}

function resumeGame() {
  if (game.state !== GAME_STATE.PAUSED) {
    return;
  }

  game.state = GAME_STATE.PLAYING;
  showOverlay(null);
  updateHUD(true);
  startLoop();
  audio.ui();
}

function endRun(reason) {
  if (game.state !== GAME_STATE.PLAYING) {
    return;
  }

  game.state = GAME_STATE.GAMEOVER;
  updateSummary(reason);
  showOverlay('gameOver');
  stopLoop();
  game.flash = Math.max(game.flash, 0.35);
  game.shake = Math.max(game.shake, 18);
  burst(player.x, player.y, COLORS.red, 28, 1.2);
  drawScene();
  updateHUD(true);
}

function frame(time) {
  if (game.state !== GAME_STATE.PLAYING) {
    game.rafId = 0;
    return;
  }

  const dt = Math.min(0.033, (time - game.lastFrameTime) / 1000 || 0);
  game.lastFrameTime = time;

  update(dt);
  drawScene();

  if (game.state === GAME_STATE.PLAYING) {
    game.rafId = requestAnimationFrame(frame);
  } else {
    game.rafId = 0;
  }
}

function handleKeydown(event) {
  audio.unlock();

  if (
    [
      'ArrowUp',
      'ArrowDown',
      'KeyW',
      'KeyS',
      'KeyA',
      'KeyD',
      'Digit1',
      'Digit2',
      'Digit3',
      'Numpad1',
      'Numpad2',
      'Numpad3',
      'Space',
      'Escape'
    ].includes(event.code)
  ) {
    event.preventDefault();
  }

  if (event.code === 'Enter' && game.state === GAME_STATE.MENU) {
    startRun();
    return;
  }

  if ((event.code === 'KeyW' || event.code === 'ArrowUp') && game.state === GAME_STATE.PLAYING) {
    moveLane(-1);
    return;
  }

  if ((event.code === 'KeyS' || event.code === 'ArrowDown') && game.state === GAME_STATE.PLAYING) {
    moveLane(1);
    return;
  }

  if (event.code === 'KeyA' && game.state === GAME_STATE.PLAYING) {
    cycleShape(-1);
    return;
  }

  if (event.code === 'KeyD' && game.state === GAME_STATE.PLAYING) {
    cycleShape(1);
    return;
  }

  if (event.code === 'Digit1' || event.code === 'Numpad1') {
    setPlayerShape('circle');
    return;
  }

  if (event.code === 'Digit2' || event.code === 'Numpad2') {
    setPlayerShape('triangle');
    return;
  }

  if (event.code === 'Digit3' || event.code === 'Numpad3') {
    setPlayerShape('square');
    return;
  }

  if (event.code === 'Space') {
    activateTurbo();
    return;
  }

  if (event.code === 'Escape') {
    if (game.state === GAME_STATE.PLAYING) {
      pauseGame();
    } else if (game.state === GAME_STATE.PAUSED) {
      resumeGame();
    }
    return;
  }

  if (event.code === 'KeyR' && (game.state === GAME_STATE.PAUSED || game.state === GAME_STATE.GAMEOVER)) {
    startRun();
  }
}

function bindEvents() {
  document.addEventListener('keydown', handleKeydown);
  window.addEventListener('blur', () => {
    if (game.state === GAME_STATE.PLAYING) {
      pauseGame();
    }
  });

  ui.buttons.start.addEventListener('click', () => {
    audio.unlock();
    audio.ui();
    startRun();
  });

  ui.buttons.resume.addEventListener('click', () => {
    audio.unlock();
    resumeGame();
  });

  ui.buttons.restart.addEventListener('click', () => {
    audio.unlock();
    audio.ui();
    startRun();
  });

  ui.buttons.restartFromPause.addEventListener('click', () => {
    audio.unlock();
    audio.ui();
    startRun();
  });

  ui.buttons.menu.addEventListener('click', () => {
    audio.unlock();
    audio.ui();
    enterMenu();
  });

  ui.buttons.menuFromGameOver.addEventListener('click', () => {
    audio.unlock();
    audio.ui();
    enterMenu();
  });

  ui.muteButtons.forEach((button) => {
    button.addEventListener('click', () => {
      audio.unlock();
      audio.toggle();
    });
  });
}

bindEvents();
initStars();
updateMuteButtons();
enterMenu();
