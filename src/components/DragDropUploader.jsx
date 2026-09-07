import React, { useState, useRef } from 'react';
import { UploadCloud, Image as ImageIcon, Video as VideoIcon, X, CheckCircle2, AlertCircle, Loader2, Plus, Film } from 'lucide-react';
import { api } from '../services/api';

export default function DragDropUploader({ currentUser, onUploadSuccess }) {
  const [dragActive, setDragActive] = useState(false);
  const [queuedFiles, setQueuedFiles] = useState([]); // Array of { id, file, previewUrl, isVideo, title, description }
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  const fileInputRef = useRef(null);

  const handleFiles = (incomingFiles) => {
    if (!incomingFiles || incomingFiles.length === 0) return;

    const newQueueItems = [];
    let hasError = false;

    Array.from(incomingFiles).forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const isVid = file.type.startsWith('video/');

      if (!isImg && !isVid) {
        setErrorMessage(`"${file.name}" is not a supported image or video.`);
        hasError = true;
        return;
      }

      if (file.size > 50 * 1024 * 1024) {
        setErrorMessage(`"${file.name}" exceeds the 50MB file size limit.`);
        hasError = true;
        return;
      }

      const id = Math.random().toString(36).substring(2, 9);
      const previewUrl = URL.createObjectURL(file);
      const title = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');

      newQueueItems.push({
        id,
        file,
        previewUrl,
        isVideo: isVid,
        title,
        description: '',
      });
    });

    if (!hasError) setErrorMessage(null);
    setSuccessMessage(null);
    setQueuedFiles((prev) => [...prev, ...newQueueItems]);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (id) => {
    setQueuedFiles((prev) => {
      const item = prev.find((f) => f.id === id);
      if (item && item.previewUrl) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return prev.filter((f) => f.id !== id);
    });
  };

  const updateFileMeta = (id, field, value) => {
    setQueuedFiles((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  const handleReset = () => {
    queuedFiles.forEach((item) => {
      if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    setQueuedFiles([]);
    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (queuedFiles.length === 0) {
      setErrorMessage('Please select or drop at least one image or short video.');
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      queuedFiles.forEach((item) => {
        formData.append('images[]', item.file);
        formData.append('titles[]', item.title || item.file.name);
        formData.append('descriptions[]', item.description || '');
      });

      const result = await api.uploadBatchPhotos(formData);
      const uploaded = result.photos || [];

      setSuccessMessage(
        `Successfully uploaded ${uploaded.length} ${uploaded.length === 1 ? 'item' : 'items'} to My-3D-Cube!`
      );
      handleReset();
      onUploadSuccess?.(uploaded);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to upload files. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="card bg-dark border-secondary border-opacity-25 shadow-sm mb-4">
      <div className="card-header bg-dark border-secondary border-opacity-25 py-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <h5 className="mb-0 text-light d-flex align-items-center gap-2">
          <UploadCloud className="text-info" size={22} />
          Upload Images & Short Videos
        </h5>
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-info bg-opacity-15 text-info border border-info border-opacity-25 px-2 py-1 rounded-pill small d-flex align-items-center gap-1">
            <Film size={13} /> Supports MP4, WebM, PNG, JPG, GIF
          </span>
          {currentUser ? (
            <span className="badge bg-success bg-opacity-25 text-success border border-success border-opacity-25 px-2 py-1 rounded-pill small">
              Posting as @{currentUser.username}
            </span>
          ) : (
            <span className="badge bg-secondary bg-opacity-25 text-secondary border border-secondary border-opacity-25 px-2 py-1 rounded-pill small">
              Guest upload
            </span>
          )}
        </div>
      </div>

      <div className="card-body p-4">
        {errorMessage && (
          <div className="alert alert-danger d-flex align-items-center gap-2 mb-3 py-2">
            <AlertCircle size={18} className="flex-shrink-0" />
            <div>{errorMessage}</div>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success d-flex align-items-center gap-2 mb-3 py-2">
            <CheckCircle2 size={18} className="flex-shrink-0" />
            <div>{successMessage}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Drag & Drop Target Area */}
          <div
            className={`border border-2 border-dashed rounded-4 p-4 text-center position-relative transition-all ${
              dragActive
                ? 'border-info bg-info bg-opacity-10 shadow-sm'
                : 'border-secondary border-opacity-50 hover-border-secondary'
            }`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            style={{
              cursor: 'pointer',
              background: dragActive ? 'rgba(13, 202, 240, 0.05)' : 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.2s ease-in-out',
            }}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              multiple
              className="d-none"
              onChange={(e) => handleFiles(e.target.files)}
            />

            <div className="py-3">
              <div className="mb-3">
                <div
                  className="d-inline-flex align-items-center justify-content-center bg-info bg-opacity-10 text-info rounded-circle p-3"
                  style={{ width: '64px', height: '64px' }}
                >
                  <UploadCloud size={32} />
                </div>
              </div>
              <h6 className="text-light fw-bold mb-1">
                Drag & Drop multiple images or short videos here
              </h6>
              <p className="text-secondary small mb-2">
                or <span className="text-info text-decoration-underline">browse files</span> from your computer (select multiple)
              </p>
              <div className="d-flex justify-content-center gap-2 flex-wrap">
                <span className="badge bg-secondary bg-opacity-25 text-light text-opacity-75 px-3 py-1 rounded-pill small">
                  Multiple files allowed
                </span>
                <span className="badge bg-secondary bg-opacity-25 text-light text-opacity-75 px-3 py-1 rounded-pill small">
                  Videos play live on 3D cube faces
                </span>
              </div>
            </div>
          </div>

          {/* Queued Files List */}
          {queuedFiles.length > 0 && (
            <div className="mt-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="text-light fw-semibold small">
                  Files to Upload ({queuedFiles.length})
                </span>
                <button
                  type="button"
                  className="btn btn-link btn-sm text-secondary text-decoration-none p-0"
                  onClick={handleReset}
                  disabled={isUploading}
                >
                  Clear all
                </button>
              </div>

              <div className="d-flex flex-column gap-2 mb-3">
                {queuedFiles.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-3 bg-black bg-opacity-30 border border-secondary border-opacity-25 rounded-3 d-flex align-items-center gap-3"
                  >
                    {/* Media preview thumbnail */}
                    <div
                      className="rounded-2 overflow-hidden border border-secondary border-opacity-50 position-relative flex-shrink-0 bg-dark"
                      style={{ width: '60px', height: '60px' }}
                    >
                      {item.isVideo ? (
                        <div className="w-100 h-100 d-flex align-items-center justify-content-center bg-dark text-warning">
                          <VideoIcon size={24} />
                        </div>
                      ) : (
                        <img
                          src={item.previewUrl}
                          alt="preview"
                          className="w-100 h-100 object-fit-cover"
                        />
                      )}
                      <span className="position-absolute bottom-0 end-0 badge bg-dark bg-opacity-75 p-1" style={{ fontSize: '0.65rem' }}>
                        #{idx + 1}
                      </span>
                    </div>

                    {/* Meta inputs */}
                    <div className="row g-2 flex-grow-1">
                      <div className="col-12 col-md-6">
                        <input
                          type="text"
                          className="form-control form-control-sm bg-dark text-light border-secondary"
                          placeholder="Title"
                          value={item.title}
                          onChange={(e) => updateFileMeta(item.id, 'title', e.target.value)}
                          disabled={isUploading}
                          required
                        />
                      </div>
                      <div className="col-12 col-md-6">
                        <input
                          type="text"
                          className="form-control form-control-sm bg-dark text-light border-secondary"
                          placeholder="Description (optional)"
                          value={item.description}
                          onChange={(e) => updateFileMeta(item.id, 'description', e.target.value)}
                          disabled={isUploading}
                        />
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      className="btn btn-outline-danger btn-sm rounded-circle p-1 flex-shrink-0"
                      onClick={() => removeFile(item.id)}
                      disabled={isUploading}
                      title="Remove"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-outline-secondary btn-sm rounded-pill px-3 d-flex align-items-center gap-1"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  <Plus size={15} /> Add More Files
                </button>
                <button
                  type="submit"
                  className="btn btn-info text-dark fw-bold rounded-pill px-4 d-flex align-items-center gap-2 shadow-sm"
                  disabled={isUploading}
                >
                  {isUploading ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      Uploading {queuedFiles.length} {queuedFiles.length === 1 ? 'file' : 'files'}...
                    </>
                  ) : (
                    <>
                      <UploadCloud size={16} />
                      Upload All ({queuedFiles.length}) to My-3D-Cube
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
