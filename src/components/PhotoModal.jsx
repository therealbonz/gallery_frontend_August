import React, { useEffect } from 'react';
import { X, Calendar, User, Box, Download, Video as VideoIcon } from 'lucide-react';
import ReactionsBar from './ReactionsBar';
import CommentsSection from './CommentsSection';

export default function PhotoModal({ photo, onClose, onFocusCubeFace, cubeFaceIndex, currentUser }) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!photo) return null;

  const isVideo = photo.media_type === 'video';

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.88)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered modal-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content bg-dark text-light border-secondary border-opacity-50 shadow-2xl overflow-hidden rounded-4">
          {/* Header */}
          <div className="modal-header border-secondary border-opacity-25 py-3 px-4 d-flex align-items-center justify-content-between">
            <div className="d-flex align-items-center gap-2 overflow-hidden">
              {isVideo ? <VideoIcon size={20} className="text-warning flex-shrink-0" /> : null}
              <h5 className="modal-title fw-bold text-truncate mb-0" title={photo.title}>
                {photo.title}
              </h5>
            </div>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-circle p-2"
              onClick={onClose}
              title="Close modal"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body: Split view (Media on left, details/reactions/comments on right) */}
          <div className="modal-body p-0">
            <div className="row g-0">
              {/* Media viewer */}
              <div className="col-12 col-lg-7 bg-black d-flex align-items-center justify-content-center position-relative p-2" style={{ minHeight: '380px', maxHeight: '72vh' }}>
                {isVideo ? (
                  <video
                    src={photo.image_url}
                    controls
                    autoPlay
                    playsInline
                    className="w-100 h-100 object-fit-contain"
                    style={{ maxHeight: '70vh' }}
                  />
                ) : (
                  <img
                    src={photo.image_url}
                    alt={photo.title}
                    className="img-fluid w-100 h-100 object-fit-contain"
                    style={{ maxHeight: '70vh' }}
                  />
                )}
              </div>

              {/* Sidebar with details, reactions, and comments */}
              <div className="col-12 col-lg-5 p-4 d-flex flex-column bg-dark border-start border-secondary border-opacity-25" style={{ maxHeight: '72vh', overflowY: 'auto' }}>
                {photo.description && (
                  <div className="mb-3">
                    <p className="text-light mb-0" style={{ fontSize: '0.95rem' }}>
                      {photo.description}
                    </p>
                  </div>
                )}

                {/* Metadata info */}
                <div className="d-flex flex-wrap align-items-center gap-3 text-secondary small pb-3 mb-3 border-bottom border-secondary border-opacity-25">
                  <span className="d-flex align-items-center gap-1">
                    <User size={14} className="text-info" />
                    {photo.user ? `@${photo.user.username}` : 'Guest'}
                  </span>
                  <span className="d-flex align-items-center gap-1">
                    <Calendar size={14} />
                    {new Date(photo.created_at).toLocaleString()}
                  </span>
                  {cubeFaceIndex !== null && cubeFaceIndex !== undefined && cubeFaceIndex < 6 && (
                    <span className="badge bg-info bg-opacity-25 text-info border border-info border-opacity-25 rounded-pill px-2 py-1">
                      On Cube Face {cubeFaceIndex + 1}
                    </span>
                  )}
                </div>

                {/* Emote Reactions */}
                <div className="mb-4">
                  <label className="form-label text-secondary small fw-semibold d-block mb-2">
                    React to this {isVideo ? 'video' : 'photo'}:
                  </label>
                  <ReactionsBar
                    photoId={photo.id}
                    initialReactions={photo.reactions_summary}
                  />
                </div>

                {/* Comments Section */}
                <div className="flex-grow-1">
                  <CommentsSection
                    photoId={photo.id}
                    initialComments={photo.comments}
                    currentUser={currentUser}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Footer actions */}
          <div className="modal-footer border-secondary border-opacity-25 d-flex justify-content-between flex-wrap gap-2 py-2 px-4 bg-black bg-opacity-30">
            <span className="text-secondary small">
              My-3D-Cube Interactive Gallery
            </span>
            <div className="d-flex align-items-center gap-2">
              {cubeFaceIndex !== null && cubeFaceIndex !== undefined && cubeFaceIndex < 6 && (
                <button
                  className="btn btn-outline-info btn-sm rounded-pill d-flex align-items-center gap-1"
                  onClick={() => {
                    onClose();
                    onFocusCubeFace(cubeFaceIndex);
                  }}
                >
                  <Box size={14} /> Rotate Cube to This
                </button>
              )}
              <a
                href={photo.image_url}
                target="_blank"
                rel="noreferrer"
                download
                className="btn btn-secondary btn-sm rounded-pill d-flex align-items-center gap-1"
              >
                <Download size={14} /> Download Original
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
