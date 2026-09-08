import * as THREE from 'three';

// -------------------------------------------------------------
// 1. 3D Three.js Weather Systems (Rain streaks, Splashes, Snow, Fog)
// -------------------------------------------------------------
export function create3DWeather(scene) {
  let currentCondition = 'rain';

  // --- Rain System (LineSegments for realistic motion streaks) ---
  const RAIN_COUNT = 1800;
  const rainPositions = new Float32Array(RAIN_COUNT * 2 * 3); // 2 vertices per streak
  const rainVelocities = new Float32Array(RAIN_COUNT);
  const rainLengths = new Float32Array(RAIN_COUNT);

  for (let i = 0; i < RAIN_COUNT; i++) {
    const x = (Math.random() - 0.5) * 24;
    const y = Math.random() * 16 - 3;
    const z = (Math.random() - 0.5) * 16;
    const len = 0.25 + Math.random() * 0.25;

    rainPositions[i * 6] = x;
    rainPositions[i * 6 + 1] = y;
    rainPositions[i * 6 + 2] = z;

    // Wind angle tilt (-0.15 on X)
    rainPositions[i * 6 + 3] = x - 0.08;
    rainPositions[i * 6 + 4] = y - len;
    rainPositions[i * 6 + 5] = z;

    rainVelocities[i] = 18 + Math.random() * 8;
    rainLengths[i] = len;
  }

  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));

  const rainMat = new THREE.LineBasicMaterial({
    color: 0x93c5fd,
    transparent: true,
    opacity: 0.55,
    blending: THREE.AdditiveBlending
  });

  const rainLines = new THREE.LineSegments(rainGeo, rainMat);
  scene.add(rainLines);

  // Floor Splashes / Ripples when raindrops strike floor grid (y = -2.5)
  const SPLASH_COUNT = 60;
  const splashRings = [];
  const ringGeo = new THREE.RingGeometry(0.04, 0.08, 16);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.6,
    side: THREE.DoubleSide
  });

  for (let i = 0; i < SPLASH_COUNT; i++) {
    const mesh = new THREE.Mesh(ringGeo, ringMat.clone());
    mesh.position.set((Math.random() - 0.5) * 16, -2.48, (Math.random() - 0.5) * 16);
    mesh.visible = false;
    mesh.userData = { life: 0, maxLife: 0.3 + Math.random() * 0.3, scale: 0.1 };
    scene.add(mesh);
    splashRings.push(mesh);
  }

  let nextSplashIndex = 0;
  function triggerSplash(x, z) {
    const splash = splashRings[nextSplashIndex];
    if (splash) {
      splash.position.x = x;
      splash.position.z = z;
      splash.position.y = -2.48;
      splash.scale.set(1, 1, 1);
      splash.material.opacity = 0.7;
      splash.visible = true;
      splash.userData.life = 0;
      splash.userData.maxLife = 0.25 + Math.random() * 0.2;
      splash.userData.scale = 1;
    }
    nextSplashIndex = (nextSplashIndex + 1) % SPLASH_COUNT;
  }

  // --- Snow System (1,200 soft tumbling crystals) ---
  const SNOW_COUNT = 1200;
  const snowPositions = new Float32Array(SNOW_COUNT * 3);
  const snowVelocities = new Float32Array(SNOW_COUNT * 3);

  for (let i = 0; i < SNOW_COUNT; i++) {
    snowPositions[i * 3] = (Math.random() - 0.5) * 22;
    snowPositions[i * 3 + 1] = Math.random() * 16 - 3;
    snowPositions[i * 3 + 2] = (Math.random() - 0.5) * 16;

    snowVelocities[i * 3] = (Math.random() - 0.5) * 0.4; // horizontal drift
    snowVelocities[i * 3 + 1] = -(0.8 + Math.random() * 0.8); // fall speed
    snowVelocities[i * 3 + 2] = (Math.random() - 0.5) * 0.3;
  }

  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPositions, 3));

  // Canvas texture for round fluffy snowflake
  const snowCanvas = document.createElement('canvas');
  snowCanvas.width = 32;
  snowCanvas.height = 32;
  const snowCtx = snowCanvas.getContext('2d');
  const grad = snowCtx.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
  grad.addColorStop(0.4, 'rgba(230, 245, 255, 0.8)');
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
  snowCtx.fillStyle = grad;
  snowCtx.fillRect(0, 0, 32, 32);
  const snowTex = new THREE.CanvasTexture(snowCanvas);

  const snowMat = new THREE.PointsMaterial({
    map: snowTex,
    size: 0.12,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  const snowPoints = new THREE.Points(snowGeo, snowMat);
  snowPoints.visible = false;
  scene.add(snowPoints);

  // --- Cloudy / Fog System (Atmospheric mist layers) ---
  const FOG_COUNT = 150;
  const fogGeo = new THREE.BufferGeometry();
  const fogPositions = new Float32Array(FOG_COUNT * 3);
  for (let i = 0; i < FOG_COUNT * 3; i += 3) {
    fogPositions[i] = (Math.random() - 0.5) * 20;
    fogPositions[i + 1] = -1.5 + Math.random() * 4.0;
    fogPositions[i + 2] = (Math.random() - 0.5) * 14;
  }
  fogGeo.setAttribute('position', new THREE.BufferAttribute(fogPositions, 3));
  const fogMat = new THREE.PointsMaterial({
    map: snowTex,
    size: 2.2,
    transparent: true,
    opacity: 0.15,
    color: 0x94a3b8,
    depthWrite: false
  });
  const fogPoints = new THREE.Points(fogGeo, fogMat);
  fogPoints.visible = false;
  scene.add(fogPoints);

  // Update loop
  function update(delta, condition) {
    if (condition) currentCondition = condition;

    // Manage visibility
    const isRain = currentCondition === 'rain';
    const isSnow = currentCondition === 'snow';
    const isCloudy = currentCondition === 'cloudy';

    rainLines.visible = isRain;
    snowPoints.visible = isSnow;
    fogPoints.visible = isCloudy || isRain; // subtle mist during rain

    // 1. Update Rain
    if (isRain) {
      const pos = rainGeo.attributes.position.array;
      for (let i = 0; i < RAIN_COUNT; i++) {
        const idx = i * 6;
        const v = rainVelocities[i] * delta;
        const len = rainLengths[i];

        pos[idx + 1] -= v;
        pos[idx + 4] -= v;
        pos[idx] -= v * 0.08;
        pos[idx + 3] -= v * 0.08;

        // Hit floor or out of bound
        if (pos[idx + 4] < -2.5) {
          triggerSplash(pos[idx], pos[idx + 2]);

          const resetY = 8 + Math.random() * 4;
          const resetX = (Math.random() - 0.5) * 24;
          const resetZ = (Math.random() - 0.5) * 16;
          pos[idx] = resetX;
          pos[idx + 1] = resetY;
          pos[idx + 2] = resetZ;

          pos[idx + 3] = resetX - 0.08;
          pos[idx + 4] = resetY - len;
          pos[idx + 5] = resetZ;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;

      // Update splash rings
      for (let i = 0; i < SPLASH_COUNT; i++) {
        const splash = splashRings[i];
        if (splash.visible) {
          splash.userData.life += delta;
          const progress = splash.userData.life / splash.userData.maxLife;
          if (progress >= 1) {
            splash.visible = false;
          } else {
            const scale = 1 + progress * 2.8;
            splash.scale.set(scale, 1, scale);
            splash.material.opacity = (1 - progress) * 0.65;
          }
        }
      }
    }

    // 2. Update Snow
    if (isSnow) {
      const pos = snowGeo.attributes.position.array;
      for (let i = 0; i < SNOW_COUNT; i++) {
        const idx = i * 3;
        pos[idx] += snowVelocities[idx] * delta + Math.sin(pos[idx + 1] * 2 + i) * 0.008;
        pos[idx + 1] += snowVelocities[idx + 1] * delta;
        pos[idx + 2] += snowVelocities[idx + 2] * delta;

        if (pos[idx + 1] < -2.5) {
          pos[idx] = (Math.random() - 0.5) * 22;
          pos[idx + 1] = 8 + Math.random() * 2;
          pos[idx + 2] = (Math.random() - 0.5) * 16;
        }
      }
      snowGeo.attributes.position.needsUpdate = true;
    }

    // 3. Update Fog/Mist
    if (fogPoints.visible) {
      fogPoints.rotation.y += delta * 0.015;
    }
  }

  function dispose() {
    scene.remove(rainLines);
    scene.remove(snowPoints);
    scene.remove(fogPoints);
    splashRings.forEach((s) => scene.remove(s));
    rainGeo.dispose();
    rainMat.dispose();
    snowGeo.dispose();
    snowMat.dispose();
    fogGeo.dispose();
    fogMat.dispose();
    ringGeo.dispose();
  }

  return { update, dispose };
}

// -------------------------------------------------------------
// 2. 2D Glass Rain Droplets Overlay (Window Condensation & Trickles)
// -------------------------------------------------------------
export function createGlassRainOverlay(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  let animationId = null;
  let isRunning = false;
  let width = canvas.width;
  let height = canvas.height;

  // Droplet objects
  let drops = [];
  const MAX_DROPS = 140;

  class Drop {
    constructor(initial = false) {
      this.reset(initial);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : -10;
      this.radius = 1.5 + Math.random() * 3.5;
      this.mass = this.radius * (0.8 + Math.random() * 0.4);
      this.speed = 0;
      this.sliding = false;
      this.trail = [];
      this.slideThreshold = 3.6 + Math.random() * 1.8;
      this.maxTrailLength = Math.floor(10 + Math.random() * 15);
    }

    update(delta) {
      // Condensation accumulation: drops grow gradually
      this.radius += 0.003;
      this.mass += 0.003;

      if (!this.sliding && this.radius > this.slideThreshold) {
        this.sliding = true;
        this.speed = 40 + Math.random() * 60;
      }

      if (this.sliding) {
        // Accelerate down the screen
        this.speed += 80 * delta;
        this.y += this.speed * delta;

        // Leave trail droplets
        if (Math.random() < 0.25) {
          this.trail.push({
            x: this.x + (Math.random() - 0.5) * 1.5,
            y: this.y - this.radius,
            radius: this.radius * (0.2 + Math.random() * 0.2),
            opacity: 0.6
          });
          if (this.trail.length > this.maxTrailLength) {
            this.trail.shift();
          }
        }

        // Fade old trails
        this.trail.forEach((t) => {
          t.opacity -= delta * 0.15;
        });
        this.trail = this.trail.filter((t) => t.opacity > 0.05);

        // Disappear off bottom
        if (this.y > height + 20) {
          this.reset(false);
        }
      }
    }

    draw(ctx) {
      // Draw trails left by trickling drop
      for (const t of this.trail) {
        ctx.beginPath();
        ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(186, 230, 253, ${t.opacity * 0.35})`;
        ctx.fill();
      }

      // Draw the main glass droplet
      ctx.save();
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);

      // Liquid body with refraction dark ring
      ctx.fillStyle = 'rgba(15, 23, 42, 0.22)';
      ctx.fill();

      // Specular rim light (highlighting glass reflection)
      ctx.lineWidth = Math.max(0.6, this.radius * 0.2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.stroke();

      // Bright specular shine pinpoint on top-left
      ctx.beginPath();
      ctx.arc(
        this.x - this.radius * 0.35,
        this.y - this.radius * 0.35,
        Math.max(0.7, this.radius * 0.3),
        0,
        Math.PI * 2
      );
      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.fill();

      ctx.restore();
    }
  }

  // Cracks list
  let cracks = [];
  let isRainEnabled = true;

  function addCrack(x, y) {
    cracks.push(new Crack(x, y));
    if (cracks.length > 14) {
      cracks.shift();
    }
    if (!isRunning) {
      start();
    }
  }

  function clearCracks() {
    cracks = [];
    if (!isRainEnabled) {
      stop();
    }
  }

  function setRainEnabled(enabled) {
    isRainEnabled = enabled;
    if (enabled && !isRunning) {
      start();
    }
  }

  function resize(w, h) {
    width = w;
    height = h;
    canvas.width = w;
    canvas.height = h;
  }

  function init() {
    drops = [];
    for (let i = 0; i < MAX_DROPS; i++) {
      drops.push(new Drop(true));
    }
  }

  let lastTime = performance.now();
  function loop(now) {
    if (!isRunning) return;
    const delta = Math.min((now - lastTime) / 1000, 0.1);
    lastTime = now;

    ctx.clearRect(0, 0, width, height);

    // 1. Draw and update rain droplets if rain is active
    if (isRainEnabled) {
      for (const drop of drops) {
        drop.update(delta);
        drop.draw(ctx);
      }
    }

    // 2. Draw and update glass cracks
    if (cracks.length > 0) {
      cracks = cracks.filter((c) => c.update(now));
      for (const crack of cracks) {
        crack.draw(ctx);
      }
    }

    // If neither rain nor cracks are active, sleep loop to save CPU
    if (!isRainEnabled && cracks.length === 0) {
      stop();
      return;
    }

    animationId = requestAnimationFrame(loop);
  }

  function start() {
    if (isRunning) return;
    isRunning = true;
    if (isRainEnabled && drops.length === 0) {
      init();
    }
    lastTime = performance.now();
    animationId = requestAnimationFrame(loop);
  }

  function stop() {
    isRunning = false;
    if (animationId) {
      cancelAnimationFrame(animationId);
      animationId = null;
    }
    ctx.clearRect(0, 0, width, height);
  }

  return {
    start,
    stop,
    resize,
    addCrack,
    clearCracks,
    setRainEnabled,
    get isRunning() {
      return isRunning;
    }
  };
}

// -------------------------------------------------------------
// 3. Screen Glass Crack Simulation (Procedural Impact Fractures)
// -------------------------------------------------------------
class Crack {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.bornAt = performance.now();
    this.lifespan = 12000; // 12 seconds
    this.fadeStart = 8500;  // begins dissolving at 8.5s
    this.opacity = 1.0;
    this.progress = 0; // 0 to 1 over 70ms for lightning-fast propagation

    // 8 to 14 main fracture rays
    this.rays = [];
    const rayCount = 9 + Math.floor(Math.random() * 6);
    for (let i = 0; i < rayCount; i++) {
      const baseAngle = (i / rayCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const totalLen = 50 + Math.random() * 160;
      const steps = 3 + Math.floor(Math.random() * 4);
      const stepLen = totalLen / steps;

      const segments = [];
      let curX = x;
      let curY = y;
      let curAngle = baseAngle;

      for (let s = 0; s < steps; s++) {
        curAngle += (Math.random() - 0.5) * 0.45;
        const nextX = curX + Math.cos(curAngle) * stepLen;
        const nextY = curY + Math.sin(curAngle) * stepLen;
        segments.push({
          x1: curX,
          y1: curY,
          x2: nextX,
          y2: nextY,
          distFrac: (s + 1) / steps
        });

        // Forking sub-crack
        if (s > 0 && Math.random() < 0.45) {
          const forkAngle = curAngle + (Math.random() < 0.5 ? 0.6 : -0.6);
          const forkLen = stepLen * (0.8 + Math.random() * 0.7);
          segments.push({
            x1: nextX,
            y1: nextY,
            x2: nextX + Math.cos(forkAngle) * forkLen,
            y2: nextY + Math.sin(forkAngle) * forkLen,
            distFrac: (s + 1) / steps
          });
        }
        curX = nextX;
        curY = nextY;
      }
      this.rays.push(segments);
    }

    // Concentric spiderweb rings
    this.rings = [];
    const ringCount = 2 + Math.floor(Math.random() * 3);
    for (let r = 1; r <= ringCount; r++) {
      const ringRadius = (r / (ringCount + 1)) * 60 + 15;
      const ringSteps = 10;
      const pts = [];
      for (let a = 0; a <= ringSteps; a++) {
        const theta = (a / ringSteps) * Math.PI * 2;
        const d = ringRadius * (0.85 + Math.random() * 0.3);
        pts.push({ x: x + Math.cos(theta) * d, y: y + Math.sin(theta) * d });
      }
      this.rings.push(pts);
    }

    // Impact core shards
    this.shards = [];
    const shardCount = 8;
    for (let i = 0; i < shardCount; i++) {
      const a1 = (i / shardCount) * Math.PI * 2;
      const a2 = ((i + 1) / shardCount) * Math.PI * 2;
      const r = 8 + Math.random() * 12;
      this.shards.push([
        { x: x, y: y },
        { x: x + Math.cos(a1) * r, y: y + Math.sin(a1) * r },
        { x: x + Math.cos((a1 + a2) / 2) * (r * 1.3), y: y + Math.sin((a1 + a2) / 2) * (r * 1.3) },
        { x: x + Math.cos(a2) * r, y: y + Math.sin(a2) * r }
      ]);
    }
  }

  update(now) {
    const age = now - this.bornAt;
    this.progress = Math.min(1, age / 70); // snappy propagation

    if (age > this.lifespan) {
      return false; // dead
    }
    if (age > this.fadeStart) {
      this.opacity = 1 - (age - this.fadeStart) / (this.lifespan - this.fadeStart);
    } else {
      this.opacity = 1.0;
    }
    return true;
  }

  draw(ctx) {
    if (this.opacity <= 0) return;
    ctx.save();

    // 1. Draw central pulverized shatter core
    ctx.beginPath();
    ctx.arc(this.x, this.y, 16 * this.progress, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(224, 242, 254, ${0.3 * this.opacity})`;
    ctx.fill();

    // Shard polygons
    for (const poly of this.shards) {
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        const px = this.x + (poly[i].x - this.x) * this.progress;
        const py = this.y + (poly[i].y - this.y) * this.progress;
        ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(255, 255, 255, ${0.2 * this.opacity})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(15, 23, 42, ${0.55 * this.opacity})`;
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }

    // 2. Draw spiderweb rings
    ctx.beginPath();
    for (const ring of this.rings) {
      if (this.progress > 0.3) {
        ctx.moveTo(ring[0].x, ring[0].y);
        for (let i = 1; i < ring.length; i++) {
          ctx.lineTo(ring[i].x, ring[i].y);
        }
      }
    }
    ctx.strokeStyle = `rgba(15, 23, 42, ${0.5 * this.opacity})`;
    ctx.lineWidth = 1.6;
    ctx.stroke();

    ctx.strokeStyle = `rgba(255, 255, 255, ${0.85 * this.opacity})`;
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // 3. Draw radial fracture rays
    // Layer A: dark refractive shadow line
    ctx.beginPath();
    for (const ray of this.rays) {
      for (const seg of ray) {
        if (seg.distFrac <= this.progress) {
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        }
      }
    }
    ctx.strokeStyle = `rgba(15, 23, 42, ${0.7 * this.opacity})`;
    ctx.lineWidth = 2.4;
    ctx.stroke();

    // Layer B: bright glass specular light line
    ctx.beginPath();
    for (const ray of this.rays) {
      for (const seg of ray) {
        if (seg.distFrac <= this.progress) {
          ctx.moveTo(seg.x1, seg.y1);
          ctx.lineTo(seg.x2, seg.y2);
        }
      }
    }
    ctx.strokeStyle = `rgba(255, 255, 255, ${0.98 * this.opacity})`;
    ctx.lineWidth = 1.0;
    ctx.stroke();

    // Layer C: subtle cyan highlight
    ctx.strokeStyle = `rgba(186, 230, 253, ${0.6 * this.opacity})`;
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Central impact puncture pinpoint
    ctx.beginPath();
    ctx.arc(this.x, this.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255, 255, 255, ${0.98 * this.opacity})`;
    ctx.fill();

    ctx.restore();
  }
}
