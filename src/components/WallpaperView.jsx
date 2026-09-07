import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { api } from '../services/api';
import { RefreshCw, Sparkles, Wifi } from 'lucide-react';

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

  // Drag interaction refs
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const mouseParallaxRef = useRef({ x: 0, y: 0 });

  // Helper to slice photos per monitor/cube
  const getPhotoForFace = useCallback((faceIdx) => {
    if (!photos || photos.length === 0) return null;
    const offset = monitorIndex * 6;
    if (photos.length > offset) {
      return photos[(offset + faceIdx) % photos.length];
    }
    return photos[faceIdx % photos.length];
  }, [photos, monitorIndex]);

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
      const { action, speed, spin, deltaX, deltaY } = event.data;
      if (action === 'refresh') {
        fetchPhotos(false);
      } else if (action === 'setSpeed' && typeof speed === 'number') {
        setSpinSpeed(speed);
      } else if (action === 'toggleSpin') {
        setIsSpinning((prev) => (spin !== undefined ? spin : !prev));
      } else if (action === 'dragRotate') {
        if (cubeRef.current) {
          cubeRef.current.rotation.y += (deltaX || 0) * 0.008;
          cubeRef.current.rotation.x += (deltaY || 0) * 0.008;
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [fetchPhotos]);

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

    // Momentum velocity refs
    let momentumX = 0;
    let momentumY = 0;

    // Animation loop
    const clock = new THREE.Clock();
    const animate = () => {
      animFrameIdRef.current = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      if (cubeRef.current) {
        // Apply physics momentum from fling drag
        if (Math.abs(momentumX) > 0.0001 || Math.abs(momentumY) > 0.0001) {
          cubeRef.current.rotation.y += momentumY;
          cubeRef.current.rotation.x += momentumX;
          momentumX *= 0.92;
          momentumY *= 0.92;
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
    };

    const onMouseMove = (e) => {
      mouseParallaxRef.current = {
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: -(e.clientY / window.innerHeight) * 2 + 1
      };

      if (!isDraggingRef.current || !cubeRef.current) return;
      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      cubeRef.current.rotation.y += deltaX * 0.008;
      cubeRef.current.rotation.x += deltaY * 0.008;

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseUp = () => {
      isDraggingRef.current = false;
    };

    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);

    const handleResize = () => {
      if (!container) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      if (animFrameIdRef.current) cancelAnimationFrame(animFrameIdRef.current);
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [spinSpeed, isSpinning]);

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
          const imageTexture = textureLoader.load(photo.image_url, (tex) => {
            tex.generateMipmaps = true;
            tex.minFilter = THREE.LinearMipmapLinearFilter;
          });

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
        cursor: 'grab'
      }}
    >
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

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
