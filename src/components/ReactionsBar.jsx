import React, { useState } from 'react';
import { api } from '../services/api';

const EMOJIS = ['🔥', '❤️', '😍', '🚀', '👏', '😂'];

export default function ReactionsBar({ photoId, initialReactions = {}, onReactionChange }) {
  const [reactions, setReactions] = useState(initialReactions || {});
  const [isReacting, setIsReacting] = useState(false);

  const handleToggle = async (emoji, e) => {
    e.stopPropagation();
    if (isReacting) return;
    setIsReacting(true);

    try {
      const data = await api.toggleReaction(photoId, emoji);
      setReactions(data.reactions_summary || {});
      onReactionChange?.(data.reactions_summary);
    } catch (err) {
      console.error('Failed to toggle reaction', err);
    } finally {
      setIsReacting(false);
    }
  };

  const totalReactions = Object.values(reactions).reduce((a, b) => a + b, 0);

  return (
    <div className="d-flex flex-wrap align-items-center gap-1">
      {EMOJIS.map((emoji) => {
        const count = reactions[emoji] || 0;
        return (
          <button
            key={emoji}
            className={`btn btn-sm rounded-pill py-0 px-2 d-flex align-items-center gap-1 transition-all ${
              count > 0
                ? 'btn-dark border border-secondary border-opacity-50 text-light shadow-sm'
                : 'btn-outline-secondary border-0 text-secondary opacity-75 hover-opacity-100'
            }`}
            style={{ fontSize: '0.82rem', height: '26px' }}
            onClick={(e) => handleToggle(emoji, e)}
            disabled={isReacting}
            title={`React with ${emoji}`}
          >
            <span>{emoji}</span>
            {count > 0 && <span className="fw-bold small">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
