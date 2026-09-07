import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { api } from '../services/api';
import { RefreshCw, Sparkles, Wifi, CloudRain, Snowflake, Cloud, Sun, Music, Mic, VolumeX, Play, Headphones, Radio } from 'lucide-react';
import { create3DWeather, createGlassRainOverlay } from '../utils/WeatherSystem';
import { AudioVisualizerManager, createEqualizerRing } from '../utils/AudioVisualizer';
import { fetchLiveWeather, setStoredWeatherSetting, WEATHER_CONDITIONS, getStoredWeatherSetting } from '../utils/weatherService';

const FACE_NAMES = ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back'];
const FACE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

function createPlaceholderTexture(faceIndex, monitorIndex = 0) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const color = FACE_COLORS[(faceIndex + monitorIndex) % FACE_COLORS.length];
  const name = FACE_NAMES[faceIndex];

  // Deep space gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
  bgGrad.addColorStop(0, '#070a12');
  bgGrad.addColorStop(1, '#0e1626');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle tech grid
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= 512; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Border & glow
  ctx.strokeStyle = color;
  ctx.lineWidth = 12;
  ctx.strokeRect(16, 16, 480, 480);

  // Center badge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
  ctx.font = 'bold 36px "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(`MY-3D-CUBE • CUBE ${monitorIndex + 1}`, 256, 230);

  ctx.fillStyle = color;
  ctx.font = '600 24px "Segoe UI", system-ui, sans-serif';
  ctx.fillText(`FACE ${faceIndex + 1} • ${name.toUpperCase()}`, 256, 280);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.font = '16px "Segoe UI", system-ui, sans-serif';
  ctx.fillText('Live Desktop Wallpaper', 256, 320);

  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  return texture;
}

export default function WallpaperView() {
  const mountRef = useRef(null);
  const [photos, setPhotos] = useState([]);
  const [lastSync, setLastSync] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState(0.8);
  const [isSpinning, setIsSpinning] = useState(true);

  // Parse URL query params
  const searchParams = new URLSearchParams(window.location.search);
  const isMinimal = searchParams.get('minimal') === 'true';
  const monitorIndex = parseInt(searchParams.get('monitorIndex') || '0', 10);

  const sceneRef = useRef(null);
  const cubeRef = useRef(null);
  const materialsRef = useRef([]);
  const videoElementsRef = useRef([]);
  const animFrameIdRef = useRef(null);

  // Weather & Audio Visualizer state
  const [weatherCondition, setWeatherCondition] = useState(getStoredWeatherSetting());
  const [audioMode, setAudioMode] = useState('off'); // 'off' | 'beat' | 'mic'

  const weatherConditionRef = useRef(weatherCondition);
  const weather3DRef = useRef(null);
  const equalizerRingRef = useRef(null);
  const audioVisRef = useRef(null);
  const glassCanvasRef = useRef(null);
  const glassOverlayRef = useRef(null);

  useEffect(() => {
    weatherConditionRef.current = weatherCondition;
    glassOverlayRef.current?.setRainEnabled(weatherCondition === 'rain');
  }, [weatherCondition]);

  useEffect(() => {
    fetchLiveWeather().then((res) => {
      if (res && res.condition) {
        setWeatherCondition(res.condition);
      }
    });
  }, []);

  const handleToggleAudio = useCallback(async () => {
    if (!audioVisRef.current) return;
    if (audioMode === 'off') {
      // Attempt tab/system audio capture first (YouTube / Spotify sync)
      const ok = await audioVisRef.current.startSystemOrTabAudio();
      if (ok) {
        setAudioMode('tab');
      } else {
        // Fallback to beat demo
        audioVisRef.current.startDemoBeat();
        setAudioMode('beat');
      }
    } else if (audioMode === 'tab' || audioMode === 'system') {
      audioVisRef.current.startDemoBeat();
      setAudioMode('beat');
    } else if (audioMode === 'beat') {
      const ok = await audioVisRef.current.startMic();
      if (ok) {
        setAudioMode('mic');
      } else {
        audioVisRef.current.stop();
        setAudioMode('off');
      }
    } else {
      audioVisRef.current.stop();
      setAudioMode('off');
    }
  }, [audioMode]);

  // Periodic check for server updates to auto-reload live wallpaper in-place
  useEffect(() => {
    let lastVer = null;
    const checkVersion = async () => {
      try {
        const res = await fetch(`/version.json?t=${Date.now()}`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.updatedAt) {
            if (lastVer !== null && lastVer !== data.updatedAt) {
              console.log('New update deployed on server! Seamlessly auto-reloading wallpaper...');
              window.location.reload();
            }
            lastVer = data.updatedAt;
          }
        }
      } catch (e) {}
    };
    checkVersion();
    const timer = setInterval(checkVersion, 45000);
    return () => clearInterval(timer);
  }, []);

  const handleCycleWeather = useCallback(() => {
    const list = [WEATHER_CONDITIONS.RAIN, WEATHER_CONDITIONS.SNOW, WEATHER_CONDITIONS.CLOUDY, WEATHER_CONDITIONS.CLEAR];
    const curIdx = list.indexOf(weatherCondition);
    const nextCond = list[(curIdx + 1) % list.length];
    setWeatherCondition(nextCond);
    setStoredWeatherSetting(nextCond);
  }, [weatherCondition]);

  // Drag interaction refs
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const mouseParallaxRef = useRef({ x: 0, y: 0 });
  const momentumVelocityRef = useRef({ x: 0, y: 0 });

  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const nextPhotoIndexRef = useRef(0);
  const faceUpdatedRef = useRef([false, false, false, false, false, false]);
  const textureCacheRef = useRef(new Map());
  const activeVideosByFaceRef = useRef([null, null, null, null, null, null]);

  // Preload textures into cache for 0ms instantaneous face swapping
  useEffect(() => {
    if (!photos || photos.length === 0) return;
    const loader = new THREE.TextureLoader();
    photos.forEach((photo) => {
      if (photo && photo.image_url && photo.media_type !== 'video' && !textureCacheRef.current.has(photo.id)) {
        loader.load(photo.image_url, (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace;
          tex.generateMipmaps = true;
          tex.minFilter = THREE.LinearMipmapLinearFilter;
          textureCacheRef.current.set(photo.id, tex);
        });
      }
    });
  }, [photos]);

  // Helper to slice photos per monitor/cube
  const getPhotoForFace = useCallback((faceIdx) => {
    if (!photos || photos.length === 0) return null;
    const offset = monitorIndex * 6;
    if (photos.length > offset) {
      return photos[(offset + faceIdx) % photos.length];
    }
    return photos[faceIdx % photos.length];
  }, [photos, monitorIndex]);

  // Dynamic Face Swap: seamlessly swap face texture when it turns away to the back
  const swapFacePhoto = useCallback((faceIndex) => {
    const currentPhotos = photosRef.current;
    if (!currentPhotos || currentPhotos.length === 0) return;
    const mat = materialsRef.current[faceIndex];
    if (!mat) return;

    const nextIdx = nextPhotoIndexRef.current;
    const photo = currentPhotos[nextIdx % currentPhotos.length];
    nextPhotoIndexRef.current = (nextIdx + 1) % currentPhotos.length;

    // Clean up previous video on this face if any
    if (activeVideosByFaceRef.current[faceIndex]) {
      try {
        const oldVid = activeVideosByFaceRef.current[faceIndex];
        oldVid.pause();
        oldVid.removeAttribute('src');
        oldVid.load();
      } catch (e) {}
      activeVideosByFaceRef.current[faceIndex] = null;
    }

    if (photo && photo.image_url) {
      if (photo.media_type === 'video') {
        const video = document.createElement('video');
        video.src = photo.image_url;
        video.crossOrigin = 'anonymous';
        video.loop = true;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        video.play().catch(() => {});
        activeVideosByFaceRef.current[faceIndex] = video;

        const videoTexture = new THREE.VideoTexture(video);
        videoTexture.colorSpace = THREE.SRGBColorSpace;
        videoTexture.minFilter = THREE.LinearFilter;
        videoTexture.magFilter = THREE.LinearFilter;
        videoTexture.generateMipmaps = false;
        mat.map = videoTexture;
        mat.needsUpdate = true;
      } else {
        if (textureCacheRef.current.has(photo.id)) {
          mat.map = textureCacheRef.current.get(photo.id);
          mat.needsUpdate = true;
        } else {
          const loader = new THREE.TextureLoader();
          loader.load(
            photo.image_url,
            (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.generateMipmaps = true;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              textureCacheRef.current.set(photo.id, tex);
              mat.map = tex;
              mat.needsUpdate = true;
            },
            undefined,
            () => {
              mat.map = createPlaceholderTexture(faceIndex, monitorIndex);
              mat.needsUpdate = true;
            }
          );
        }
      }
    } else {
      mat.map = createPlaceholderTexture(faceIndex, monitorIndex);
      mat.needsUpdate = true;
    }
  }, [monitorIndex]);

  // 1. Fetch photos from API
  const fetchPhotos = useCallback(async (silent = false) => {
    if (!silent) setIsSyncing(true);
    try {
      const data = await api.getPhotos();
      setPhotos((prev) => {
        const prevIds = prev.map((p) => p.id).join(',');
        const newIds = data.map((p) => p.id).join(',');
        if (prevIds !== newIds) {
          return data;
        }
        return prev;
      });
      setLastSync(new Date());
    } catch (err) {
      console.warn('Wallpaper API sync warning:', err);
    } finally {
      if (!silent) setIsSyncing(false);
    }
  }, []);

  // Initial fetch and auto-polling every 30 seconds
  useEffect(() => {
    fetchPhotos(false);
    const interval = setInterval(() => {
      fetchPhotos(true);
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchPhotos]);

  // Listen to postMessage from Windows C# host
  useEffect(() => {
    const handleMessage = (event) => {
      if (!event.data) return;
      const { action, speed, spin, deltaX, deltaY, clientX, clientY } = event.data;
      if (action === 'refresh') {
        fetchPhotos(false);
      } else if (action === 'setSpeed' && typeof speed === 'number') {
        setSpinSpeed(speed);
      } else if (action === 'toggleSpin') {
        setIsSpinning((prev) => (spin !== undefined ? spin : !prev));
      } else if (action === 'dragRotate') {
        if (cubeRef.current) {
          const rY = (deltaX || 0) * 0.008;
          const rX = (deltaY || 0) * 0.008;
          cubeRef.current.rotation.y += rY;
          cubeRef.current.rotation.x += rX;
          momentumVelocityRef.current = { x: rX * 0.75, y: rY * 0.75 };
        }
      } else if (action === 'mouseMove') {
        if (typeof clientX === 'number' && typeof clientY === 'number') {
          mouseParallaxRef.current = {
            x: (clientX / window.innerWidth) * 2 - 1,
            y: -(clientY / window.innerHeight) * 2 + 1
          };
        }
      } else if (action === 'setWeather' && typeof event.data.weather === 'string') {
        const w = event.data.weather.toLowerCase();
        setWeatherCondition(w);
        setStoredWeatherSetting(w);
      } else if (action === 'toggleAudio') {
        handleToggleAudio();
      } else if (action === 'systemAudio') {
        if (audioVisRef.current) {
          audioVisRef.current.setExternalAudioData(
            event.data.bands,
            event.data.bass,
            event.data.mid,
            event.data.treble
          );
          if (audioMode !== 'system') {
            setAudioMode('system');
          }
        }
      } else if (action === 'setAudioMode' && typeof event.data.mode === 'string') {
        const m = event.data.mode.toLowerCase();
        if (m === 'system') {
          setAudioMode('system');
        } else if (m === 'beat' && audioVisRef.current) {
          audioVisRef.current.startDemoBeat();
          setAudioMode('beat');
        } else if (m === 'mic' && audioVisRef.current) {
          audioVisRef.current.startMic().then((ok) => {
            if (ok) setAudioMode('mic');
            else setAudioMode('off');
          });
        } else if (m === 'tab' && audioVisRef.current) {
          audioVisRef.current.startSystemOrTabAudio().then((ok) => {
            if (ok) setAudioMode('tab');
            else setAudioMode('off');
          });
        } else {
          audioVisRef.current?.stop();
          setAudioMode('off');
        }
      } else if (action === 'screenCrack') {
        const cx = typeof event.data.clientX === 'number' ? event.data.clientX : window.innerWidth / 2;
        const cy = typeof event.data.clientY === 'number' ? event.data.clientY : window.innerHeight / 2;
        glassOverlayRef.current?.addCrack(cx, cy);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchPhotos, handleToggleAudio]);

  // 2. Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x07090e);
    scene.fog = new THREE.FogExp2(0x07090e, 0.08);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0.2, 5.2);

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    container.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(5, 6, 7);
    scene.add(keyLight);

    const fillLight = new THREE.DirectionalLight(0x60a5fa, 0.9);
    fillLight.position.set(-6, -3, -4);
    scene.add(fillLight);

    // Dynamic Cursor Spotlight: casts real-time specular glints as mouse moves
    const cursorLight = new THREE.PointLight(0x38bdf8, 3.5, 18);
    cursorLight.position.set(0, 0, 3.5);
    scene.add(cursorLight);

    // Subtle Cyberpunk Horizon Grid Floor
    const grid = new THREE.GridHelper(26, 26, 0x0ea5e9, 0x1e293b);
    grid.position.y = -2.5;
    scene.add(grid);

    // 3D Weather System (Rain streaks, splashes, snow, clouds)
    const weather3D = create3DWeather(scene);
    weather3DRef.current = weather3D;

    // 3D Audio Equalizer Ring on Floor Grid
    const eqRing = createEqualizerRing(scene);
    equalizerRingRef.current = eqRing;

    // Audio Visualizer Manager
    if (!audioVisRef.current) {
      audioVisRef.current = new AudioVisualizerManager();
    }

    // 2D Glass Rain Droplets Overlay
    if (glassCanvasRef.current) {
      const glass = createGlassRainOverlay(glassCanvasRef.current);
      glassOverlayRef.current = glass;
      glass.resize(width, height);
      glass.setRainEnabled(weatherConditionRef.current === 'rain');
    }

    // Initial placeholder materials
    const initialMaterials = [];
    for (let i = 0; i < 6; i++) {
      const tex = createPlaceholderTexture(i, monitorIndex);
      initialMaterials.push(
        new THREE.MeshStandardMaterial({
          map: tex,
          roughness: 0.2,
          metalness: 0.15,
          side: THREE.FrontSide
        })
      );
    }
    materialsRef.current = initialMaterials;

    // Cube Geometry
    const geometry = new THREE.BoxGeometry(2.2, 2.2, 2.2);
    const cube = new THREE.Mesh(geometry, initialMaterials);
    scene.add(cube);
    cubeRef.current = cube;

    // Subtle background particles
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePositions[i] = (Math.random() - 0.5) * 16;
      particlePositions[i + 1] = (Math.random() - 0.5) * 16;
      particlePositions[i + 2] = (Math.random() - 0.5) * 10 - 2;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x38bdf8,
      size: 0.035,
      transparent: true,
      opacity: 0.4
    });
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // Animation loop & Face-Rotation Swap Detector
    const localNormals = [
      new THREE.Vector3(1, 0, 0),  // 0: Right (+X)
      new THREE.Vector3(-1, 0, 0), // 1: Left (-X)
      new THREE.Vector3(0, 1, 0),  // 2: Top (+Y)
      new THREE.Vector3(0, -1, 0), // 3: Bottom (-Y)
      new THREE.Vector3(0, 0, 1),  // 4: Front (+Z)
      new THREE.Vector3(0, 0, -1), // 5: Back (-Z)
    ];
    const rotMatrix = new THREE.Matrix4();
    const worldNormal = new THREE.Vector3();

    const clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      // Audio Visualizer updates
      if (audioVisRef.current) {
        audioVisRef.current.update();

        // Scale punch on bass
        const bassVal = audioVisRef.current.bass;
        const targetScale = 1.0 + bassVal * 0.16;
        if (cubeRef.current) {
          cubeRef.current.scale.set(targetScale, targetScale, targetScale);
        }

        // Modulate cursor spotlight and fill light with music
        const midVal = audioVisRef.current.mid;
        cursorLight.intensity = 3.5 + midVal * 4.5;
        fillLight.intensity = 0.9 + midVal * 1.2;

        if (equalizerRingRef.current) {
          equalizerRingRef.current.update(
            audioVisRef.current.frequencyBands,
            audioVisRef.current.mode !== 'off'
          );
        }
      }

      // Weather 3D updates
      if (weather3DRef.current) {
        weather3DRef.current.update(delta, weatherConditionRef.current);
      }

      if (cubeRef.current) {
        // Dynamic Face Cycling: swap textures when a face is turned away to the back
        if (photosRef.current.length > 0 && materialsRef.current.length === 6) {
          rotMatrix.makeRotationFromEuler(cubeRef.current.rotation);
          for (let i = 0; i < 6; i++) {
            worldNormal.copy(localNormals[i]).applyMatrix4(rotMatrix);
            // When worldNormal.z < -0.2, the face is pointing away and completely hidden from view
            if (worldNormal.z < -0.2) {
              if (!faceUpdatedRef.current[i]) {
                faceUpdatedRef.current[i] = true;
                swapFacePhoto(i);
              }
            } else if (worldNormal.z > 0.1) {
              // Face has turned back towards front; reset flag for next revolution
              faceUpdatedRef.current[i] = false;
            }
          }
        }

        // Apply physics momentum from fling drag
        if (Math.abs(momentumVelocityRef.current.x) > 0.0001 || Math.abs(momentumVelocityRef.current.y) > 0.0001) {
          cubeRef.current.rotation.y += momentumVelocityRef.current.y;
          cubeRef.current.rotation.x += momentumVelocityRef.current.x;
          momentumVelocityRef.current.x *= 0.92;
          momentumVelocityRef.current.y *= 0.92;
        } else if (isSpinning && !isDraggingRef.current) {
          if (monitorIndex === 0) {
            cubeRef.current.rotation.y += delta * 0.35 * spinSpeed;
            cubeRef.current.rotation.x += delta * 0.15 * spinSpeed;
          } else if (monitorIndex === 1) {
            cubeRef.current.rotation.y -= delta * 0.30 * spinSpeed;
            cubeRef.current.rotation.z += delta * 0.18 * spinSpeed;
          } else {
            cubeRef.current.rotation.y += delta * 0.28 * spinSpeed;
            cubeRef.current.rotation.x -= delta * 0.22 * spinSpeed;
          }
        }

        // Mouse Parallax & Dynamic Light tracking
        cubeRef.current.position.x += (mouseParallaxRef.current.x * 0.25 - cubeRef.current.position.x) * 0.05;
        cubeRef.current.position.y += (mouseParallaxRef.current.y * 0.25 - cubeRef.current.position.y) * 0.05;

        cursorLight.position.x += (mouseParallaxRef.current.x * 4.0 - cursorLight.position.x) * 0.08;
        cursorLight.position.y += (mouseParallaxRef.current.y * 3.0 - cursorLight.position.y) * 0.08;
      }

      // Slowly rotate particle field
      particles.rotation.y += delta * 0.02;

      renderer.render(scene, camera);
    };
    animate();

    // Mouse events for desktop drag
    const onMouseDown = (e) => {
      isDraggingRef.current = true;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      momentumVelocityRef.current = { x: 0, y: 0 };
      glassOverlayRef.current?.addCrack(e.clientX, e.clientY);
    };

    const onMouseMove = (e) => {
      mouseParallaxRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1
      };

      if (!isDraggingRef.current || !cubeRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      const rY = deltaX * 0.008;
      const rX = deltaY * 0.008;
      cubeRef.current.rotation.y += rY;
      cubeRef.current.rotation.x += rX;
      momentumVelocityRef.current = { x: rX * 0.75, y: rY * 0.75 };

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    // Touch events for mobile & in-app preview
    const onTouchStart = (e) => {
      if (e.touches && e.touches.length > 0) {
        const touch = e.touches[0];
        isDraggingRef.current = true;
        previousMousePositionRef.current = { x: touch.clientX, y: touch.clientY };
        momentumVelocityRef.current = { x: 0, y: 0 };
        glassOverlayRef.current?.addCrack(touch.clientX, touch.clientY);
      }
    };

    const onTouchMove = (e) => {
      if (!e.touches || e.touches.length === 0) return;
      const touch = e.touches[0];
      mouseParallaxRef.current = {
        x: (touch.clientX / window.innerWidth) * 2 - 1,
        y: -(touch.clientY / window.innerHeight) * 2 + 1
      };

      if (!isDraggingRef.current || !cubeRef.current) return;
      const deltaX = touch.clientX - previousMousePositionRef.current.x;
      const deltaY = touch.clientY - previousMousePositionRef.current.y;

      const rY = deltaX * 0.008;
      const rX = deltaY * 0.008;
      cubeRef.current.rotation.y += rY;
      cubeRef.current.rotation.x += rX;
      momentumVelocityRef.current = { x: rX * 0.75, y: rY * 0.75 };

      previousMousePositionRef.current = { x: touch.clientX, y: touch.clientY };
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd, { passive: true });

    const handleResize = () => {
      if (!container) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      if (glassOverlayRef.current) {
        glassOverlayRef.current.resize(w, h);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      if (weather3DRef.current) weather3DRef.current.dispose();
      if (equalizerRingRef.current) equalizerRingRef.current.dispose();
      if (audioVisRef.current) audioVisRef.current.stop();
      if (glassOverlayRef.current) glassOverlayRef.current.stop();
      renderer.dispose();
    };
  }, [spinSpeed, isSpinning, monitorIndex, swapFacePhoto]);

  // 3. Update textures when photos change
  useEffect(() => {
    if (!cubeRef.current || !materialsRef.current.length) return;

    videoElementsRef.current.forEach((vid) => {
      vid.pause();
      vid.removeAttribute('src');
      vid.load();
    });
    videoElementsRef.current = [];

    const textureLoader = new THREE.TextureLoader();
    const newMaterials = [];

    for (let i = 0; i < 6; i++) {
      const photo = getPhotoForFace(i);

      if (photo && photo.image_url) {
        if (photo.media_type === 'video') {
          const video = document.createElement('video');
          video.src = photo.image_url;
          video.crossOrigin = 'anonymous';
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;

          video.play().catch((err) => console.warn('Wallpaper video autoplay deferred:', err));
          videoElementsRef.current.push(video);
          activeVideosByFaceRef.current[i] = video;

          const videoTexture = new THREE.VideoTexture(video);
          videoTexture.minFilter = THREE.LinearFilter;
          videoTexture.magFilter = THREE.LinearFilter;
          videoTexture.generateMipmaps = false;

          newMaterials.push(
            new THREE.MeshStandardMaterial({
              map: videoTexture,
              roughness: 0.15,
              metalness: 0.1
            })
          );
        } else {
          let imageTexture;
          if (textureCacheRef.current.has(photo.id)) {
            imageTexture = textureCacheRef.current.get(photo.id);
          } else {
            imageTexture = textureLoader.load(photo.image_url, (tex) => {
              tex.colorSpace = THREE.SRGBColorSpace;
              tex.generateMipmaps = true;
              tex.minFilter = THREE.LinearMipmapLinearFilter;
              textureCacheRef.current.set(photo.id, tex);
            });
          }

          newMaterials.push(
            new THREE.MeshStandardMaterial({
              map: imageTexture,
              roughness: 0.2,
              metalness: 0.1
            })
          );
        }
      } else {
        const placeholderTex = createPlaceholderTexture(i, monitorIndex);
        newMaterials.push(
          new THREE.MeshStandardMaterial({
            map: placeholderTex,
            roughness: 0.2,
            metalness: 0.15
          })
        );
      }
    }

    materialsRef.current = newMaterials;
    cubeRef.current.material = newMaterials;

    const offset = monitorIndex * 6;
    nextPhotoIndexRef.current = photos.length > 0 ? (offset + 6) % photos.length : 0;
    faceUpdatedRef.current = [false, false, false, false, false, false];
  }, [photos, getPhotoForFace, monitorIndex]);

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        position: 'fixed',
        top: 0,
        left: 0,
        overflow: 'hidden',
        background: '#07090e',
        userSelect: 'none',
        touchAction: 'none',
        cursor: 'grab'
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* 2D Glass Rain Droplets Overlay (Condensation & Window Trickles) */}
      <canvas
        ref={glassCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 4
        }}
      />

      {/* Floating Weather & Audio Visualizer Badges */}
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 10,
          pointerEvents: 'auto'
        }}
      >
        {/* Weather Cycle Button */}
        <button
          onClick={handleCycleWeather}
          title={`Weather: ${weatherCondition.toUpperCase()} (Click to toggle)`}
          style={{
            padding: '7px 14px',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            color: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          {weatherCondition === 'rain' && <CloudRain size={15} color="#38bdf8" />}
          {weatherCondition === 'snow' && <Snowflake size={15} color="#bae6fd" />}
          {weatherCondition === 'cloudy' && <Cloud size={15} color="#cbd5e1" />}
          {weatherCondition === 'clear' && <Sun size={15} color="#f59e0b" />}
          <span style={{ textTransform: 'capitalize' }}>{weatherCondition}</span>
        </button>

        {/* Audio Visualizer Button */}
        <button
          onClick={handleToggleAudio}
          title={`Music Reactive Visualizer: ${audioMode.toUpperCase()} (Click to toggle)`}
          style={{
            padding: '7px 14px',
            background: audioMode !== 'off' ? 'rgba(13, 148, 136, 0.35)' : 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            border: audioMode !== 'off' ? '1px solid #14b8a6' : '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '20px',
            color: audioMode !== 'off' ? '#2dd4bf' : '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
            transition: 'all 0.2s ease'
          }}
        >
          {audioMode === 'off' && <Music size={15} />}
          {audioMode === 'system' && <Headphones size={15} color="#2dd4bf" />}
          {audioMode === 'tab' && <Radio size={15} color="#2dd4bf" />}
          {audioMode === 'beat' && <Play size={15} className="spin-anim" />}
          {audioMode === 'mic' && <Mic size={15} color="#2dd4bf" />}
          <span>
            {audioMode === 'off' ? 'Visualizer: Off' :
             audioMode === 'system' ? 'Spotify / YouTube Sync' :
             audioMode === 'tab' ? 'Tab Audio Sync' :
             audioMode === 'beat' ? 'Visualizer: Beat' : 'Visualizer: Mic'}
          </span>
        </button>
      </div>

      {!isMinimal && (
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            right: '24px',
            padding: '10px 18px',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '12px',
            color: '#f8fafc',
            fontFamily: '"Segoe UI", system-ui, sans-serif',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            pointerEvents: 'auto',
            transition: 'opacity 0.3s ease'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 8px #10b981',
                display: 'inline-block'
              }}
            />
            <span style={{ fontWeight: 600, letterSpacing: '0.5px' }}>MY-3D-CUBE</span>
          </div>

          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px' }}>
            {lastSync ? `Synced ${lastSync.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Connecting...'}
          </div>

          <button
            onClick={() => fetchPhotos(false)}
            title="Refresh Live Wallpaper"
            style={{
              background: 'transparent',
              border: 'none',
              color: isSyncing ? '#38bdf8' : 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              padding: '4px',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <RefreshCw size={14} className={isSyncing ? 'spin-anim' : ''} />
          </button>
        </div>
      )}
    </div>
  );
}
