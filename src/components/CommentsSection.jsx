import React, { useState } from 'react';
import { MessageSquare, Send, Trash2, User, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function CommentsSection({
  photoId,
  initialComments = [],
  currentUser,
  onCommentCountChange
}) {
  const [comments, setComments] = useState(initialComments || []);
  const [newComment, setNewComment] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsPosting(true);
    try {
      const created = await api.addComment(photoId, newComment.trim(), guestName.trim());
      const updated = [...comments, created];
      setComments(updated);
      setNewComment('');
      onCommentCountChange?.(updated.length);
    } catch (err) {
      alert(err.message || 'Failed to post comment');
    } finally {
      setIsPosting(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this comment?')) return;
    setIsDeletingId(id);
    try {
      await api.deleteComment(id);
      const updated = comments.filter((c) => c.id !== id);
      setComments(updated);
      onCommentCountChange?.(updated.length);
    } catch (err) {
      alert(err.message || 'Failed to delete comment');
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="comments-container">
      {/* Header */}
      <div className="d-flex align-items-center gap-2 mb-3 text-secondary small fw-semibold">
        <MessageSquare size={16} className="text-info" />
        <span>Comments ({comments.length})</span>
      </div>

      {/* Comments List */}
      <div
        className="comments-list d-flex flex-column gap-2 mb-3 overflow-y-auto pe-1"
        style={{ maxHeight: '220px' }}
      >
        {comments.length === 0 ? (
          <p className="text-secondary small italic mb-0 py-2">
            No comments yet. Be the first to leave a thought!
          </p>
        ) : (
          comments.map((c) => {
            const isAuthor = currentUser && c.user_id === currentUser.id;
            return (
              <div
                key={c.id}
                className="p-2 rounded-3 bg-black bg-opacity-40 border border-secondary border-opacity-20 d-flex justify-content-between align-items-start gap-2"
              >
                <div className="flex-grow-1 overflow-hidden">
                  <div className="d-flex align-items-center gap-2 mb-1">
                    <span className="fw-bold small text-info">
                      @{c.author_name || (c.user ? c.user.username : 'Guest')}
                    </span>
                    <span className="text-secondary" style={{ fontSize: '0.7rem' }}>
                      {new Date(c.created_at).toLocaleDateString(undefined, {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-light small mb-0 text-break" style={{ fontSize: '0.85rem' }}>
                    {c.body}
                  </p>
                </div>

                {isAuthor && (
                  <button
                    type="button"
                    className="btn btn-link btn-sm text-danger p-0 opacity-75 hover-opacity-100"
                    onClick={(e) => handleDelete(c.id, e)}
                    disabled={isDeletingId === c.id}
                    title="Delete Comment"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* New Comment Input */}
      <form onSubmit={handleSubmit} className="d-flex flex-column gap-2">
        {!currentUser && (
          <input
            type="text"
            className="form-control form-control-sm bg-dark text-light border-secondary border-opacity-50"
            placeholder="Your name or nickname (optional)"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
          />
        )}
        <div className="input-group input-group-sm">
          <input
            type="text"
            className="form-control bg-dark text-light border-secondary border-opacity-50"
            placeholder="Write a comment..."
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            disabled={isPosting}
            required
          />
          <button
            type="submit"
            className="btn btn-info text-dark fw-semibold d-flex align-items-center gap-1"
            disabled={isPosting || !newComment.trim()}
          >
            {isPosting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>Post</span>
          </button>
        </div>
      </form>
    </div>
  );
}
