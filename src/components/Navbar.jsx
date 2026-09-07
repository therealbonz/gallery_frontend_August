import React from 'react';
import { Box, LogIn, UserPlus, LogOut, User, Sparkles } from 'lucide-react';

export default function Navbar({ currentUser, onOpenAuth, onLogout }) {
  return (
    <header className="navbar navbar-expand-lg navbar-dark bg-dark bg-opacity-95 border-bottom border-secondary border-opacity-25 sticky-top backdrop-blur py-2">
      <div className="container-xl">
        <a className="navbar-brand d-flex align-items-center gap-2 fw-bold text-light" href="#">
          <div
            className="d-flex align-items-center justify-content-center bg-info bg-opacity-10 text-info rounded-3 p-2 border border-info border-opacity-25"
            style={{ width: '40px', height: '40px' }}
          >
            <Box size={22} className="cube-spin-slow" />
          </div>
          <div className="d-flex flex-column lh-1">
            <span className="fs-5 tracking-wide text-white fw-extrabold">My-3D-Cube</span>
            <span className="text-secondary small" style={{ fontSize: '0.7rem' }}>
              Spinning 3D Media Gallery & Reactions
            </span>
          </div>
        </a>

        <div className="d-flex align-items-center gap-2">
          {currentUser ? (
            <div className="d-flex align-items-center gap-3">
              <div className="d-flex align-items-center gap-2 bg-secondary bg-opacity-10 border border-secondary border-opacity-25 rounded-pill px-3 py-1">
                <div
                  className="bg-info text-dark rounded-circle d-flex align-items-center justify-content-center fw-bold small"
                  style={{ width: '24px', height: '24px' }}
                >
                  {currentUser.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <span className="text-light small fw-medium">@{currentUser.username}</span>
              </div>

              <button
                className="btn btn-sm btn-outline-danger d-flex align-items-center gap-1 rounded-pill px-3"
                onClick={onLogout}
                title="Log out of your account"
              >
                <LogOut size={15} />
                <span className="d-none d-sm-inline">Log Out</span>
              </button>
            </div>
          ) : (
            <div className="d-flex align-items-center gap-2">
              <button
                className="btn btn-sm btn-outline-secondary text-light d-flex align-items-center gap-1 rounded-pill px-3"
                onClick={() => onOpenAuth('login')}
              >
                <LogIn size={15} />
                <span>Log In</span>
              </button>
              <button
                className="btn btn-sm btn-info text-dark fw-semibold d-flex align-items-center gap-1 rounded-pill px-3"
                onClick={() => onOpenAuth('signup')}
              >
                <UserPlus size={15} />
                <span>Sign Up</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
