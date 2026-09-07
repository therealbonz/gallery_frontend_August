import React, { useState, useEffect } from 'react';
import Navbar from './components/Navbar';
import SpinningCube from './components/SpinningCube';
import DragDropUploader from './components/DragDropUploader';
import PhotoList from './components/PhotoList';
import PhotoModal from './components/PhotoModal';
import AuthModal from './components/AuthModal';
import { api } from './services/api';
import { Sparkles, Box, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  const [photos, setPhotos] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [focusedFaceIndex, setFocusedFaceIndex] = useState(null);
  const [authModalMode, setAuthModalMode] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isDeletingId, setIsDeletingId] = useState(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [photosData, userData] = await Promise.all([
        api.getPhotos().catch(() => []),
        api.getMe().catch(() => null),
      ]);
      setPhotos(photosData);
      setCurrentUser(userData);
    } catch (err) {
      setError('Unable to connect to the gallery server. Please ensure Rails is running.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUploadSuccess = (uploadedItems) => {
    const itemsArray = Array.isArray(uploadedItems) ? uploadedItems : [uploadedItems];
    setPhotos((prev) => [...itemsArray, ...prev]);
    setFocusedFaceIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeletePhoto = async (id) => {
    if (!window.confirm('Are you sure you want to delete this media item?')) return;
    setIsDeletingId(id);
    try {
      await api.deletePhoto(id);
      setPhotos((prev) => prev.filter((p) => p.id !== id));
      if (selectedPhoto?.id === id) {
        setSelectedPhoto(null);
      }
    } catch (err) {
      alert(err.message || 'Failed to delete media item');
    } finally {
      setIsDeletingId(null);
    }
  };

  const handleFocusCubeFace = (index) => {
    setFocusedFaceIndex(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    api.logout();
    setCurrentUser(null);
  };

  return (
    <div className="min-vh-100 d-flex flex-column bg-dark text-light">
      <Navbar
        currentUser={currentUser}
        onOpenAuth={(mode) => setAuthModalMode(mode)}
        onLogout={handleLogout}
      />

      <main className="container-xl py-4 flex-grow-1">
        {/* Connection Error Banner */}
        {error && (
          <div className="alert alert-warning d-flex align-items-center justify-content-between mb-4">
            <div className="d-flex align-items-center gap-2">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
            <button
              className="btn btn-sm btn-outline-dark d-flex align-items-center gap-1"
              onClick={loadInitialData}
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Hero Section with 3D Spinning Cube */}
        <section className="mb-5">
          <div className="text-center mb-3">
            <h1 className="display-6 fw-extrabold text-white mb-2 d-inline-flex align-items-center gap-2">
              My-3D-Cube
            </h1>
            <p className="text-secondary mx-auto" style={{ maxWidth: '640px' }}>
              Drag with mouse or finger to spin the 3D cube. Upload photos and short videos to wrap onto the 6 cube faces, react with emotes, and join the conversation!
            </p>
          </div>

          <SpinningCube
            photos={photos}
            onSelectPhoto={(p) => setSelectedPhoto(p)}
            focusedFaceIndex={focusedFaceIndex}
          />
        </section>

        {/* Multi-Upload Section */}
        <section className="mb-5">
          <DragDropUploader
            currentUser={currentUser}
            onUploadSuccess={handleUploadSuccess}
          />
        </section>

        {/* Media List Section */}
        <section>
          {isLoading ? (
            <div className="text-center py-5">
              <div className="spinner-border text-info" role="status">
                <span className="visually-hidden">Loading...</span>
              </div>
              <p className="text-secondary mt-2 small">Loading My-3D-Cube...</p>
            </div>
          ) : (
            <PhotoList
              photos={photos}
              currentUser={currentUser}
              onSelectPhoto={(p) => setSelectedPhoto(p)}
              onFocusCubeFace={handleFocusCubeFace}
              onDeletePhoto={handleDeletePhoto}
              isDeletingId={isDeletingId}
            />
          )}
        </section>
      </main>

      {/* Footer */}
      <footer className="border-top border-secondary border-opacity-25 py-4 mt-auto text-center text-secondary small bg-black bg-opacity-40">
        <div className="container">
          <div className="d-flex align-items-center justify-content-center gap-2 mb-1">
            <Box size={16} className="text-info" />
            <span className="text-light fw-bold">My-3D-Cube</span>
            <span>• 3D Interactive Media Platform with Rails + PostgreSQL & React Three.js</span>
          </div>
          <div>All uploads, comments, and reactions stored in PostgreSQL with Active Storage.</div>
        </div>
      </footer>

      {/* Lightbox Modal with Video Player & Comments */}
      {selectedPhoto && (
        <PhotoModal
          photo={selectedPhoto}
          onClose={() => setSelectedPhoto(null)}
          onFocusCubeFace={handleFocusCubeFace}
          cubeFaceIndex={photos.findIndex((p) => p.id === selectedPhoto.id)}
          currentUser={currentUser}
        />
      )}

      {/* Auth Modal */}
      {authModalMode && (
        <AuthModal
          initialMode={authModalMode}
          onClose={() => setAuthModalMode(null)}
          onAuthSuccess={(user) => {
            setCurrentUser(user);
          }}
        />
      )}
    </div>
  );
}
