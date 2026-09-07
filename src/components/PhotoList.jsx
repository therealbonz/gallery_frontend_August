import React, { useState } from 'react';
import { Image as ImageIcon, Box, ZoomIn, Trash2, Calendar, User, Video as VideoIcon, MessageSquare } from 'lucide-react';
import ReactionsBar from './ReactionsBar';
import CommentsSection from './CommentsSection';

const FACE_NAMES = ['Right', 'Left', 'Top', 'Bottom', 'Front', 'Back'];
const FACE_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#06b6d4'];

export default function PhotoList({
  photos = [],
  currentUser,
  onSelectPhoto,
  onFocusCubeFace,
  onDeletePhoto,
  isDeletingId
}) {
  const [openCommentsPhotoId, setOpenCommentsPhotoId] = useState(null);

  if (photos.length === 0) {
    return (
      <div className="card bg-dark border-secondary border-opacity-25 shadow-sm text-center p-5 mb-5">
        <div className="card-body py-4">
          <div
            className="d-inline-flex align-items-center justify-content-center bg-primary bg-opacity-10 text-primary rounded-circle p-4 mb-3"
            style={{ width: '80px', height: '80px' }}
          >
            <Box size={40} />
          </div>
          <h4 className="text-light fw-bold mb-2">No Media in My-3D-Cube Yet</h4>
          <p className="text-secondary mx-auto mb-4" style={{ maxWidth: '540px' }}>
            The 3D spinning cube above is currently rotating with procedural fallback textures.
            Drag and drop multiple images or short videos from your computer to populate the cube's faces in real time!
          </p>
          <div className="d-flex justify-content-center gap-3">
            <span className="badge bg-secondary bg-opacity-25 text-secondary px-3 py-2 rounded-pill small">
              6 cube faces waiting to be filled
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-5">
      <div className="d-flex align-items-center justify-content-between mb-4 flex-wrap gap-2">
        <div>
          <h4 className="text-light fw-bold mb-1 d-flex align-items-center gap-2">
            <ImageIcon className="text-info" size={24} />
            My-3D-Cube Media Gallery
          </h4>
          <p className="text-secondary small mb-0">
            {photos.length} {photos.length === 1 ? 'item' : 'items'} uploaded • The first 6 items map directly to the 3D spinning cube
          </p>
        </div>
      </div>

      {/* Responsive Bootstrap Card Grid */}
      <div className="row g-4">
        {photos.map((photo, index) => {
          const isOnCube = index < 6;
          const cubeFaceName = isOnCube ? FACE_NAMES[index] : null;
          const cubeFaceColor = isOnCube ? FACE_COLORS[index] : null;
          const canDelete = currentUser && photo.user && photo.user.id === currentUser.id;
          const isVideo = photo.media_type === 'video';
          const commentsOpen = openCommentsPhotoId === photo.id;

          return (
            <div key={photo.id} className="col-12 col-md-6 col-lg-4">
              <div className="card bg-dark border-secondary border-opacity-25 h-100 shadow-sm overflow-hidden hover-card transition-all">
                {/* Media Container with Badges and Hover Actions */}
                <div className="position-relative overflow-hidden group bg-black" style={{ height: '230px' }}>
                  {isVideo ? (
                    <video
                      src={photo.image_url}
                      className="w-100 h-100 object-fit-cover"
                      muted
                      loop
                      playsInline
                      onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
                      onMouseLeave={(e) => {
                        e.currentTarget.pause();
                        e.currentTarget.currentTime = 0;
                      }}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectPhoto?.(photo)}
                    />
                  ) : (
                    <img
                      src={photo.image_url}
                      alt={photo.title}
                      className="w-100 h-100 object-fit-cover transition-transform"
                      style={{ cursor: 'pointer' }}
                      onClick={() => onSelectPhoto?.(photo)}
                      loading="lazy"
                    />
                  )}

                  {/* Cube Face Badge */}
                  {isOnCube && (
                    <div className="position-absolute top-0 start-0 m-2">
                      <span
                        className="badge rounded-pill px-3 py-1 shadow-sm d-flex align-items-center gap-1 small fw-bold"
                        style={{
                          backgroundColor: `${cubeFaceColor}dd`,
                          color: '#fff',
                          backdropFilter: 'blur(4px)',
                        }}
                      >
                        <Box size={13} />
                        Face {index + 1} ({cubeFaceName})
                      </span>
                    </div>
                  )}

                  {/* Media Type Badge */}
                  {isVideo && (
                    <div className="position-absolute bottom-0 start-0 m-2">
                      <span className="badge bg-black bg-opacity-75 text-warning border border-warning border-opacity-25 rounded-pill px-2 py-1 small d-flex align-items-center gap-1">
                        <VideoIcon size={12} /> Video
                      </span>
                    </div>
                  )}

                  {/* Quick Action Overlay Buttons */}
                  <div className="position-absolute top-0 end-0 m-2 d-flex gap-1">
                    <button
                      className="btn btn-sm btn-dark bg-opacity-75 border-secondary rounded-circle p-2 text-light hover-bg-opacity-100"
                      onClick={() => onSelectPhoto?.(photo)}
                      title="Enlarge & View Comments"
                    >
                      <ZoomIn size={15} />
                    </button>

                    {canDelete && (
                      <button
                        className="btn btn-sm btn-danger bg-opacity-75 border-danger rounded-circle p-2 text-light"
                        onClick={() => onDeletePhoto?.(photo.id)}
                        disabled={isDeletingId === photo.id}
                        title="Delete Media"
                      >
                        <Trash2 size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="card-body d-flex flex-column p-3">
                  <div className="d-flex align-items-start justify-content-between mb-1">
                    <h5 className="card-title text-light fw-bold text-truncate mb-0" title={photo.title}>
                      {photo.title}
                    </h5>
                  </div>

                  {photo.description && (
                    <p className="card-text text-secondary small line-clamp-2 mb-2 flex-grow-1">
                      {photo.description}
                    </p>
                  )}

                  {/* Reactions Bar */}
                  <div className="my-2 pt-2 border-top border-secondary border-opacity-10">
                    <ReactionsBar
                      photoId={photo.id}
                      initialReactions={photo.reactions_summary}
                    />
                  </div>

                  {/* Metadata Row & Comment Toggle */}
                  <div className="d-flex align-items-center justify-content-between text-secondary small pt-2 border-top border-secondary border-opacity-10 mt-auto">
                    <span className="d-flex align-items-center gap-1">
                      <User size={13} className="text-info" />
                      {photo.user ? `@${photo.user.username}` : 'Guest'}
                    </span>

                    <div className="d-flex align-items-center gap-3">
                      <button
                        type="button"
                        className="btn btn-link btn-sm text-secondary text-decoration-none p-0 d-flex align-items-center gap-1"
                        onClick={() => setOpenCommentsPhotoId(commentsOpen ? null : photo.id)}
                        title="View / Post Comments"
                      >
                        <MessageSquare size={13} />
                        <span>{photo.comments?.length || 0}</span>
                      </button>

                      <span className="d-flex align-items-center gap-1">
                        <Calendar size={13} />
                        {new Date(photo.created_at).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric'
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Collapsible Comments Section inside Card */}
                  {commentsOpen && (
                    <div className="mt-3 pt-3 border-top border-secondary border-opacity-25">
                      <CommentsSection
                        photoId={photo.id}
                        initialComments={photo.comments}
                        currentUser={currentUser}
                      />
                    </div>
                  )}
                </div>

                {/* Card Footer with Focus on Cube Button */}
                <div className="card-footer bg-dark border-secondary border-opacity-25 p-2 px-3 d-flex justify-content-between align-items-center">
                  {isOnCube ? (
                    <button
                      className="btn btn-sm btn-outline-info w-100 rounded-pill d-flex align-items-center justify-content-center gap-2 py-1"
                      onClick={() => onFocusCubeFace?.(index)}
                    >
                      <Box size={14} />
                      Rotate 3D Cube to This Face
                    </button>
                  ) : (
                    <span className="text-secondary small mx-auto py-1">
                      In Gallery (not on primary 6 cube faces)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
