import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Play, Pause, RotateCw, ZoomIn, Eye, Layers, Video as VideoIcon, Image as ImageIcon, CloudRain, Snowflake, Cloud, Sun, Music, Mic } from 'lucide-react';
import { create3DWeather, createGlassRainOverlay } from '../utils/WeatherSystem';
import { AudioVisualizerManager, createEqualizerRing } from '../utils/AudioVisualizer';
import { fetchLiveWeather, setStoredWeatherSetting, WEATHER_CONDITIONS, getStoredWeatherSetting } from '../utils/weatherService';

const FACE_NAMES = ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back'];
const FACE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#8b5cf6', // purple
  '#f59e0b', // amber
  '#ec4899', // pink
  '#06b6d4'  // cyan
];

// Generates a high-res dynamic canvas texture when no uploaded media is available
function createPlaceholderTexture(faceIndex) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  const color = FACE_COLORS[faceIndex % FACE_COLORS.length];
  const name = FACE_NAMES[faceIndex];

  // Dark background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 512, 512);
  bgGrad.addColorStop(0, '#090d16');
  bgGrad.addColorStop(1, '#131b2e');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, 512, 512);

  // Subtle grid pattern
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
  ctx.lineWidth = 2;
  const step = 32;
  for (let x = 0; x <= 512; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, 512);
    ctx.stroke();
  }
  for (let y = 0; y <= 512; y += step) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(512, y);
    ctx.stroke();
  }

  // Glowing Outer border
  ctx.strokeStyle = color;
  ctx.lineWidth = 14;
  ctx.strokeRect(16, 16, 480, 480);

  // Corner accents
  ctx.fillStyle = color;
  const cornerSize = 28;
  ctx.fillRect(16, 16, cornerSize, 6);
  ctx.fillRect(16, 16, 6, cornerSize);
  ctx.fillRect(496 - cornerSize, 16, cornerSize, 6);
  ctx.fillRect(496 - 6, 16, 6, cornerSize);
  ctx.fillRect(16, 496 - 6, cornerSize, 6);
  ctx.fillRect(16, 496 - cornerSize, 6, cornerSize);
  ctx.fillRect(496 - cornerSize, 496 - 6, cornerSize, 6);
  ctx.fillRect(496 - 6, 496 - cornerSize, 6, cornerSize);

  // Central circular badge
  ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
  ctx.beginPath();
  ctx.arc(256, 205, 85, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Cube wireframe icon in center
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.strokeRect(226, 175, 60, 60);

  // Typography
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Site name tag
  ctx.font = '700 16px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fillText('MY-3D-CUBE', 256, 130);

  // Face number
  ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = color;
  ctx.fillText(`FACE ${faceIndex + 1}`, 256, 325);

  // Face position name
  ctx.font = '600 24px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#f8fafc';
  ctx.fillText(name.toUpperCase(), 256, 370);

  // Subtext prompt
  ctx.font = '500 17px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText('Drop Image or Video Here', 256, 415);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

const FACE_ROTATIONS = [
  { x: 0, y: -Math.PI / 2 },       // 0: Right
  { x: 0, y: Math.PI / 2 },        // 1: Left
  { x: Math.PI / 2, y: 0 },        // 2: Top
  { x: -Math.PI / 2, y: 0 },       // 3: Bottom
  { x: 0, y: 0 },                  // 4: Front
  { x: 0, y: Math.PI }             // 5: Back
];

export default function SpinningCube({ photos = [], onSelectPhoto, focusedFaceIndex = null }) {
  const mountRef = useRef(null);
  const cubeRef = useRef(null);
  const rendererRef = useRef(null);
  const materialsRef = useRef([]);
  const targetRotationRef = useRef(null);
  const activeVideosRef = useRef([]); // track active video elements for cleanup

  const [isAutoSpinning, setIsAutoSpinning] = useState(true);
  const [spinSpeed, setSpinSpeed] = useState(1);
  const [activeFace, setActiveFace] = useState(4); // Front face default

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
    if (weatherCondition === 'rain') {
      glassOverlayRef.current?.start();
    } else {
      glassOverlayRef.current?.stop();
    }
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

  const handleCycleWeather = useCallback(() => {
    const list = [WEATHER_CONDITIONS.RAIN, WEATHER_CONDITIONS.SNOW, WEATHER_CONDITIONS.CLOUDY, WEATHER_CONDITIONS.CLEAR];
    const curIdx = list.indexOf(weatherCondition);
    const nextCond = list[(curIdx + 1) % list.length];
    setWeatherCondition(nextCond);
    setStoredWeatherSetting(nextCond);
  }, [weatherCondition]);

  // Track dragging
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const momentumRef = useRef({ x: 0, y: 0 });

  const photosRef = useRef(photos);
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  const [currentFacePhotos, setCurrentFacePhotos] = useState([]);
  const nextPhotoIndexRef = useRef(6);
  const faceUpdatedRef = useRef([false, false, false, false, false, false]);
  const textureCacheRef = useRef(new Map());
  const activeVideosByFaceRef = useRef([null, null, null, null, null, null]);

  // Preload textures whenever photos list changes
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

  // Cleanup active video elements
  const cleanupVideos = useCallback(() => {
    activeVideosRef.current.forEach((video) => {
      try {
        video.pause();
        video.removeAttribute('src');
        video.load();
      } catch (e) {
        // ignore cleanup errors
      }
    });
    activeVideosRef.current = [];
    activeVideosByFaceRef.current.forEach((video) => {
      if (video) {
        try {
          video.pause();
          video.removeAttribute('src');
          video.load();
        } catch (e) {}
      }
    });
    activeVideosByFaceRef.current = [null, null, null, null, null, null];
  }, []);

  // Dynamic Face Swap: swaps face texture when it turns away to the back
  const swapFacePhoto = useCallback((faceIndex) => {
    const currentPhotos = photosRef.current;
    if (!currentPhotos || currentPhotos.length === 0) return;
    const mat = materialsRef.current[faceIndex];
    if (!mat) return;

    const nextIdx = nextPhotoIndexRef.current;
    const photo = currentPhotos[nextIdx % currentPhotos.length];
    nextPhotoIndexRef.current = (nextIdx + 1) % currentPhotos.length;

    mat.userData.photo = photo;

    // Clean up previous video on this face
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
              mat.map = createPlaceholderTexture(faceIndex);
              mat.needsUpdate = true;
            }
          );
        }
      }
    } else {
      mat.map = createPlaceholderTexture(faceIndex);
      mat.needsUpdate = true;
    }

    setCurrentFacePhotos((prev) => {
      const next = [...prev];
      next[faceIndex] = photo;
      return next;
    });
  }, []);

  // Update materials when photos/videos change
  const updateCubeMaterials = useCallback((photosList) => {
    if (!materialsRef.current.length) return;
    cleanupVideos();

    const loader = new THREE.TextureLoader();
    const initialFaces = [];

    for (let i = 0; i < 6; i++) {
      const photo = photosList.length > 0 ? photosList[i % photosList.length] : null;
      initialFaces[i] = photo;

      if (materialsRef.current[i]) {
        materialsRef.current[i].userData.photo = photo;
      }

      if (photo && photo.image_url) {
        if (photo.media_type === 'video') {
          // Live Video Texture
          const video = document.createElement('video');
          video.src = photo.image_url;
          video.crossOrigin = 'anonymous';
          video.loop = true;
          video.muted = true;
          video.playsInline = true;
          video.autoplay = true;
          video.play().catch(() => {});

          activeVideosRef.current.push(video);
          activeVideosByFaceRef.current[i] = video;

          const videoTexture = new THREE.VideoTexture(video);
          videoTexture.colorSpace = THREE.SRGBColorSpace;
          videoTexture.minFilter = THREE.LinearFilter;
          videoTexture.magFilter = THREE.LinearFilter;

          if (materialsRef.current[i]) {
            materialsRef.current[i].map = videoTexture;
            materialsRef.current[i].needsUpdate = true;
          }
        } else {
          // Check cache or load
          if (textureCacheRef.current.has(photo.id)) {
            if (materialsRef.current[i]) {
              materialsRef.current[i].map = textureCacheRef.current.get(photo.id);
              materialsRef.current[i].needsUpdate = true;
            }
          } else {
            loader.load(
              photo.image_url,
              (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.generateMipmaps = true;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                textureCacheRef.current.set(photo.id, texture);
                if (materialsRef.current[i]) {
                  materialsRef.current[i].map = texture;
                  materialsRef.current[i].needsUpdate = true;
                }
              },
              undefined,
              () => {
                if (materialsRef.current[i]) {
                  materialsRef.current[i].map = createPlaceholderTexture(i);
                  materialsRef.current[i].needsUpdate = true;
                }
              }
            );
          }
        }
      } else {
        // Fallback procedural canvas texture
        if (materialsRef.current[i]) {
          materialsRef.current[i].map = createPlaceholderTexture(i);
          materialsRef.current[i].needsUpdate = true;
        }
      }
    }

    setCurrentFacePhotos(initialFaces);
    nextPhotoIndexRef.current = photosList.length > 6 ? 6 : 0;
    faceUpdatedRef.current = [false, false, false, false, false, false];
  }, [cleanupVideos]);

  // Animate smoothly to specific face
  const snapToFace = (index) => {
    setIsAutoSpinning(false);
    setActiveFace(index);
    const target = FACE_ROTATIONS[index];
    if (target) {
      targetRotationRef.current = { ...target };
    }
  };

  useEffect(() => {
    if (focusedFaceIndex !== null && focusedFaceIndex >= 0 && focusedFaceIndex < 6) {
      snapToFace(focusedFaceIndex);
    }
  }, [focusedFaceIndex]);

  // Three.js setup
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 470;

    // 1. Scene
    const scene = new THREE.Scene();

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.z = 4.3;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.3);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.4);
    dirLight1.position.set(5, 6, 7);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x0dcaf0, 0.8);
    dirLight2.position.set(-5, -3, -4);
    scene.add(dirLight2);

    // 5. Materials
    const materials = [];
    for (let i = 0; i < 6; i++) {
      const mat = new THREE.MeshStandardMaterial({
        map: createPlaceholderTexture(i),
        roughness: 0.25,
        metalness: 0.15,
      });
      materials.push(mat);
    }
    materialsRef.current = materials;

    // 6. Geometry & Mesh
    const geometry = new THREE.BoxGeometry(2, 2, 2);
    const cube = new THREE.Mesh(geometry, materials);
    scene.add(cube);
    cubeRef.current = cube;

    cube.rotation.x = 0.35;
    cube.rotation.y = 0.55;

    // Subtle Cyberpunk Horizon Grid Floor
    const grid = new THREE.GridHelper(20, 20, 0x0ea5e9, 0x1e293b);
    grid.position.y = -2.2;
    scene.add(grid);

    // 3D Weather System (Rain streaks, splashes, snow, clouds)
    const weather3D = create3DWeather(scene);
    weather3DRef.current = weather3D;

    // 3D Audio Equalizer Ring on Floor
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
      if (weatherConditionRef.current === 'rain') {
        glass.start();
      }
    }

    // Initial textures
    updateCubeMaterials(photos);

    // 7. Raycaster for clicking faces
    const raycaster = new THREE.Raycaster();
    const mouse = new THREE.Vector2();

    const handleClick = (e) => {
      if (Math.abs(momentumRef.current.x) > 0.01 || Math.abs(momentumRef.current.y) > 0.01) return;

      const rect = renderer.domElement.getBoundingClientRect();
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);
      const intersects = raycaster.intersectObject(cube);

      if (intersects.length > 0) {
        const materialIndex = intersects[0].materialIndex;
        if (materialIndex !== undefined) {
          setActiveFace(materialIndex);
          const clickedPhoto = materialsRef.current[materialIndex]?.userData?.photo || photosRef.current[materialIndex];
          if (clickedPhoto) {
            onSelectPhoto?.(clickedPhoto);
          }
        }
      }
    };

    // 8. Pointer / Drag Controls
    const onPointerDown = (e) => {
      isDraggingRef.current = true;
      targetRotationRef.current = null;
      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
      momentumRef.current = { x: 0, y: 0 };
    };

    const onPointerMove = (e) => {
      if (!isDraggingRef.current || !cubeRef.current) return;

      const deltaX = e.clientX - previousMousePositionRef.current.x;
      const deltaY = e.clientY - previousMousePositionRef.current.y;

      const rotSpeed = 0.006;
      cubeRef.current.rotation.y += deltaX * rotSpeed;
      cubeRef.current.rotation.x += deltaY * rotSpeed;

      momentumRef.current = {
        x: deltaY * rotSpeed,
        y: deltaX * rotSpeed
      };

      previousMousePositionRef.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
    };

    const domElement = renderer.domElement;
    domElement.style.cursor = 'grab';
    domElement.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    domElement.addEventListener('click', handleClick);

    // 9. Render Loop & Face-Rotation Swap Detector
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

    let animationFrameId;
    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      if (cubeRef.current) {
        // Dynamic Face Cycling: swap textures when a face is turned away to the back
        if (photosRef.current.length > 0 && materialsRef.current.length === 6) {
          rotMatrix.makeRotationFromEuler(cubeRef.current.rotation);
          for (let i = 0; i < 6; i++) {
            worldNormal.copy(localNormals[i]).applyMatrix4(rotMatrix);
            // When worldNormal.z < -0.2, the face is pointing away and hidden from viewer
            if (worldNormal.z < -0.2) {
              if (!faceUpdatedRef.current[i]) {
                faceUpdatedRef.current[i] = true;
                swapFacePhoto(i);
              }
            } else if (worldNormal.z > 0.1) {
              // Face has turned back towards front view; reset flag for next revolution
              faceUpdatedRef.current[i] = false;
            }
          }
        }

        if (targetRotationRef.current) {
          const target = targetRotationRef.current;
          cubeRef.current.rotation.x += (target.x - cubeRef.current.rotation.x) * 0.08;
          cubeRef.current.rotation.y += (target.y - cubeRef.current.rotation.y) * 0.08;

          if (
            Math.abs(target.x - cubeRef.current.rotation.x) < 0.005 &&
            Math.abs(target.y - cubeRef.current.rotation.y) < 0.005
          ) {
            cubeRef.current.rotation.x = target.x;
            cubeRef.current.rotation.y = target.y;
            targetRotationRef.current = null;
          }
        } else if (isAutoSpinning && !isDraggingRef.current) {
          cubeRef.current.rotation.y += 0.006 * spinSpeed;
          cubeRef.current.rotation.x += 0.003 * spinSpeed;
        } else if (!isDraggingRef.current) {
          cubeRef.current.rotation.x += momentumRef.current.x;
          cubeRef.current.rotation.y += momentumRef.current.y;
          momentumRef.current.x *= 0.92;
          momentumRef.current.y *= 0.92;
        }
      }

      // Audio Visualizer updates
      if (audioVisRef.current) {
        audioVisRef.current.update();

        // Scale punch on bass
        const bassVal = audioVisRef.current.bass;
        const targetScale = 1.0 + bassVal * 0.16;
        if (cubeRef.current) {
          cubeRef.current.scale.set(targetScale, targetScale, targetScale);
        }

        // Modulate directional light with music
        dirLight1.intensity = 1.4 + audioVisRef.current.mid * 2.0;

        if (equalizerRingRef.current) {
          equalizerRingRef.current.update(
            audioVisRef.current.frequencyBands,
            audioVisRef.current.mode !== 'off'
          );
        }
      }

      // Weather 3D updates
      if (weather3DRef.current) {
        weather3DRef.current.update(0.016, weatherConditionRef.current);
      }

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container || !renderer || !camera) return;
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight || 470;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
      if (glassOverlayRef.current) {
        glassOverlayRef.current.resize(newWidth, newHeight);
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      domElement.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      domElement.removeEventListener('click', handleClick);
      cleanupVideos();
      if (weather3DRef.current) weather3DRef.current.dispose();
      if (equalizerRingRef.current) equalizerRingRef.current.dispose();
      if (audioVisRef.current) audioVisRef.current.stop();
      if (glassOverlayRef.current) glassOverlayRef.current.stop();
      geometry.dispose();
      materials.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
      renderer.dispose();
    };
  }, [cleanupVideos, swapFacePhoto]);

  useEffect(() => {
    updateCubeMaterials(photos);
  }, [photos, updateCubeMaterials]);

  const activePhoto = currentFacePhotos[activeFace] || photos[activeFace];

  return (
    <div className="card bg-black border-secondary border-opacity-25 shadow-2xl overflow-hidden position-relative mb-4">
      {/* 3D Canvas Mount */}
      <div
        ref={mountRef}
        style={{ width: '100%', height: '490px', touchAction: 'none' }}
        className="d-flex align-items-center justify-content-center"
      />

      {/* 2D Glass Rain Droplets Overlay */}
      <canvas
        ref={glassCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '490px',
          pointerEvents: 'none',
          zIndex: 3
        }}
      />

      {/* Floating Status & Controls Header */}
      <div className="position-absolute top-0 start-0 p-3 d-flex align-items-center gap-2 flex-wrap">
        <span className="badge bg-primary bg-opacity-75 backdrop-blur px-3 py-2 fs-6 rounded-pill d-flex align-items-center gap-2 shadow-sm">
          <Layers size={16} />
          {photos.length === 0
            ? 'My-3D-Cube: Procedural Fallback Textures'
            : `My-3D-Cube: ${photos.length} Media • Switching on Every Face Turn`}
        </span>
      </div>

      {/* Floating Weather & Audio Visualizer Header */}
      <div className="position-absolute top-0 end-0 p-3 d-flex align-items-center gap-2 flex-wrap" style={{ zIndex: 10 }}>
        {/* Weather Button */}
        <button
          className="btn btn-sm btn-dark bg-opacity-75 border-secondary border-opacity-50 text-light rounded-pill px-3 d-flex align-items-center gap-1 backdrop-blur shadow-sm"
          onClick={handleCycleWeather}
          title={`Weather: ${weatherCondition.toUpperCase()} (Click to toggle)`}
        >
          {weatherCondition === 'rain' && <CloudRain size={14} className="text-info" />}
          {weatherCondition === 'snow' && <Snowflake size={14} className="text-light" />}
          {weatherCondition === 'cloudy' && <Cloud size={14} className="text-secondary" />}
          {weatherCondition === 'clear' && <Sun size={14} className="text-warning" />}
          <span className="small text-capitalize">{weatherCondition}</span>
        </button>

        {/* Audio Visualizer Button */}
        <button
          className={`btn btn-sm ${audioMode !== 'off' ? 'text-white border-info' : 'btn-dark bg-opacity-75 border-secondary border-opacity-50 text-light'} rounded-pill px-3 d-flex align-items-center gap-1 backdrop-blur shadow-sm`}
          style={audioMode !== 'off' ? { background: 'rgba(13, 148, 136, 0.65)' } : {}}
          onClick={handleToggleAudio}
          title={`Music Reactive Visualizer: ${audioMode.toUpperCase()} (Click to toggle)`}
        >
          {audioMode === 'off' && <Music size={14} />}
          {audioMode === 'beat' && <Play size={14} className="text-warning spin-anim" />}
          {audioMode === 'mic' && <Mic size={14} className="text-info" />}
          <span className="small">
            {audioMode === 'off' ? 'Visualizer: Off' : audioMode === 'beat' ? 'Visualizer: Beat' : 'Visualizer: Mic'}
          </span>
        </button>
      </div>

      {/* Interactive Controls Overlay Bar */}
      <div className="card-footer bg-dark bg-opacity-80 backdrop-blur border-secondary border-opacity-25 p-3">
        <div className="row g-3 align-items-center">
          {/* Spin controls */}
          <div className="col-12 col-md-auto d-flex align-items-center gap-2">
            <button
              className={`btn btn-sm ${isAutoSpinning ? 'btn-outline-info' : 'btn-info'} d-flex align-items-center gap-1 rounded-pill px-3 fw-medium`}
              onClick={() => setIsAutoSpinning(!isAutoSpinning)}
              title={isAutoSpinning ? 'Pause auto-spin' : 'Resume auto-spin'}
            >
              {isAutoSpinning ? <Pause size={15} /> : <Play size={15} />}
              {isAutoSpinning ? 'Pause Spin' : 'Auto Spin'}
            </button>

            <button
              className="btn btn-sm btn-outline-secondary d-flex align-items-center gap-1 rounded-pill"
              onClick={() => {
                setIsAutoSpinning(true);
                targetRotationRef.current = null;
                if (cubeRef.current) {
                  cubeRef.current.rotation.set(0.35, 0.55, 0);
                }
              }}
              title="Reset angle"
            >
              <RotateCw size={14} /> Reset
            </button>
          </div>

          {/* Speed slider */}
          <div className="col-12 col-md-3 d-flex align-items-center gap-2">
            <small className="text-secondary text-nowrap">Speed:</small>
            <input
              type="range"
              className="form-range"
              min="0.2"
              max="3"
              step="0.1"
              value={spinSpeed}
              onChange={(e) => setSpinSpeed(parseFloat(e.target.value))}
            />
            <small className="text-info fw-bold">{spinSpeed}x</small>
          </div>

          {/* Quick Face Buttons */}
          <div className="col-12 col-md d-flex flex-wrap align-items-center justify-content-md-end gap-1">
            <span className="text-secondary small me-1">Snap Face:</span>
            {FACE_NAMES.map((name, idx) => {
              const photo = currentFacePhotos[idx] || photos[idx];
              const isVideo = photo?.media_type === 'video';
              return (
                <button
                  key={name}
                  className={`btn btn-sm ${activeFace === idx ? 'btn-primary' : 'btn-outline-secondary'} py-0 px-2 rounded-pill small d-flex align-items-center gap-1`}
                  style={{ fontSize: '0.75rem' }}
                  onClick={() => snapToFace(idx)}
                >
                  <span>{name}</span>
                  {photo && (isVideo ? <VideoIcon size={12} className="text-warning" /> : <ImageIcon size={12} className="text-info" />)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info on the currently selected face */}
        <div className="mt-2 pt-2 border-top border-secondary border-opacity-10 d-flex align-items-center justify-content-between text-secondary small flex-wrap gap-2">
          <div>
            <span className="text-light fw-semibold">Active: Face {activeFace + 1} ({FACE_NAMES[activeFace]})</span>
            {activePhoto ? (
              <span className="ms-2 text-info">
                — "{activePhoto.title}" {activePhoto.media_type === 'video' ? '(Live Video)' : ''} {activePhoto.user ? `by @${activePhoto.user.username}` : ''}
              </span>
            ) : (
              <span className="ms-2 text-muted italic">— (Default texture shown, drop image/video to populate)</span>
            )}
          </div>
          {activePhoto && (
            <button
              className="btn btn-link btn-sm text-info p-0 text-decoration-none d-flex align-items-center gap-1"
              onClick={() => onSelectPhoto?.(activePhoto)}
            >
              <ZoomIn size={14} /> View Details & Comments
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
