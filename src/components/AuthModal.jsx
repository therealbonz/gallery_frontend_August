import React, { useState } from 'react';
import { X, LogIn, UserPlus, AlertCircle, Loader2 } from 'lucide-react';
import { api } from '../services/api';

export default function AuthModal({ initialMode = 'login', onClose, onAuthSuccess }) {
  const [mode, setMode] = useState(initialMode); // 'login' or 'signup'
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      let data;
      if (mode === 'signup') {
        if (!username.trim()) throw new Error('Username is required');
        data = await api.signup(username.trim(), email.trim(), password);
      } else {
        data = await api.login(email.trim(), password);
      }
      onAuthSuccess(data.user);
      onClose();
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="modal fade show d-block"
      tabIndex="-1"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="modal-dialog modal-dialog-centered"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-content bg-dark text-light border-secondary border-opacity-50 shadow-2xl rounded-4 p-2">
          {/* Header */}
          <div className="modal-header border-0 pb-0">
            <h5 className="modal-title fw-bold text-light d-flex align-items-center gap-2">
              {mode === 'login' ? <LogIn size={20} className="text-info" /> : <UserPlus size={20} className="text-info" />}
              {mode === 'login' ? 'Sign In to Your Account' : 'Create a New Account'}
            </h5>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm rounded-circle p-2"
              onClick={onClose}
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="modal-body pt-3">
            {/* Tabs */}
            <ul className="nav nav-pills nav-fill bg-black rounded-pill p-1 mb-4 border border-secondary border-opacity-25">
              <li className="nav-item">
                <button
                  className={`nav-link rounded-pill py-2 small fw-semibold ${mode === 'login' ? 'active bg-info text-dark' : 'text-secondary'}`}
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  type="button"
                >
                  Sign In
                </button>
              </li>
              <li className="nav-item">
                <button
                  className={`nav-link rounded-pill py-2 small fw-semibold ${mode === 'signup' ? 'active bg-info text-dark' : 'text-secondary'}`}
                  onClick={() => {
                    setMode('signup');
                    setError(null);
                  }}
                  type="button"
                >
                  Create Account
                </button>
              </li>
            </ul>

            {error && (
              <div className="alert alert-danger d-flex align-items-center gap-2 py-2 small mb-3">
                <AlertCircle size={16} className="flex-shrink-0" />
                <div>{error}</div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="d-flex flex-column gap-3">
              {mode === 'signup' && (
                <div>
                  <label className="form-label text-secondary small fw-semibold mb-1">Username</label>
                  <input
                    type="text"
                    className="form-control bg-dark text-light border-secondary"
                    placeholder="e.g. photoguy"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              )}

              <div>
                <label className="form-label text-secondary small fw-semibold mb-1">Email Address</label>
                <input
                  type="email"
                  className="form-control bg-dark text-light border-secondary"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label className="form-label text-secondary small fw-semibold mb-1">Password</label>
                <input
                  type="password"
                  className="form-control bg-dark text-light border-secondary"
                  placeholder="Minimum 6 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              <button
                type="submit"
                className="btn btn-info text-dark fw-bold rounded-pill py-2 mt-2 d-flex align-items-center justify-content-center gap-2 shadow-sm"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processing...
                  </>
                ) : mode === 'login' ? (
                  <>
                    <LogIn size={18} />
                    Sign In
                  </>
                ) : (
                  <>
                    <UserPlus size={18} />
                    Register Account
                  </>
                )}
              </button>
            </form>
          </div>

          <div className="modal-footer border-0 pt-0 text-center justify-content-center">
            <small className="text-secondary">
              {mode === 'login' ? "Don't have an account yet? " : 'Already have an account? '}
              <button
                type="button"
                className="btn btn-link btn-sm text-info p-0 text-decoration-none fw-semibold"
                onClick={() => {
                  setMode(mode === 'login' ? 'signup' : 'login');
                  setError(null);
                }}
              >
                {mode === 'login' ? 'Sign Up' : 'Log In'}
              </button>
            </small>
          </div>
        </div>
      </div>
    </div>
  );
}
