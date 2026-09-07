const API_BASE = '/api/v1';

export const authStorage = {
  getToken: () => localStorage.getItem('cube_gallery_token'),
  setToken: (token) => localStorage.setItem('cube_gallery_token', token),
  clearToken: () => localStorage.removeItem('cube_gallery_token'),
  getUser: () => {
    try {
      const data = localStorage.getItem('cube_gallery_user');
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },
  setUser: (user) => localStorage.setItem('cube_gallery_user', JSON.stringify(user)),
  clearUser: () => localStorage.removeItem('cube_gallery_user'),
  getGuestId: () => {
    let id = localStorage.getItem('cube_gallery_guest_id');
    if (!id) {
      id = 'guest_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('cube_gallery_guest_id', id);
    }
    return id;
  }
};

const getHeaders = (isMultipart = false) => {
  const headers = {};
  const token = authStorage.getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (!isMultipart) {
    headers['Content-Type'] = 'application/json';
    headers['Accept'] = 'application/json';
  }
  return headers;
};

export const api = {
  // Media / Photos
  async getPhotos() {
    const res = await fetch(`${API_BASE}/photos`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load media');
    return res.json();
  },

  async uploadPhoto(formData) {
    const res = await fetch(`${API_BASE}/photos`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors?.join(', ') || data.error || 'Failed to upload file');
    }
    return data;
  },

  async uploadBatchPhotos(formData) {
    const res = await fetch(`${API_BASE}/photos/batch`, {
      method: 'POST',
      headers: getHeaders(true),
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors?.join(', ') || data.error || 'Failed to upload files');
    }
    return data;
  },

  async deletePhoto(id) {
    const res = await fetch(`${API_BASE}/photos/${id}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete photo');
    }
    return res.json();
  },

  // Emote Reactions
  async toggleReaction(photoId, emoji) {
    const guestId = authStorage.getGuestId();
    const res = await fetch(`${API_BASE}/photos/${photoId}/reactions`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ emoji, guest_id: guestId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to react');
    return data;
  },

  // Comments
  async getComments(photoId) {
    const res = await fetch(`${API_BASE}/photos/${photoId}/comments`, {
      headers: getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to load comments');
    return res.json();
  },

  async addComment(photoId, body, guestName = '') {
    const res = await fetch(`${API_BASE}/photos/${photoId}/comments`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ comment: { body, guest_name: guestName } }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors?.join(', ') || data.error || 'Failed to post comment');
    }
    return data;
  },

  async deleteComment(commentId) {
    const res = await fetch(`${API_BASE}/comments/${commentId}`, {
      method: 'DELETE',
      headers: getHeaders(),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to delete comment');
    }
    return res.json();
  },

  // Auth
  async signup(username, email, password) {
    const res = await fetch(`${API_BASE}/signup`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ user: { username, email, password } }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.errors?.join(', ') || data.error || 'Signup failed');
    }
    authStorage.setToken(data.token);
    authStorage.setUser(data.user);
    return data;
  },

  async login(email, password) {
    const res = await fetch(`${API_BASE}/login`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Invalid credentials');
    }
    authStorage.setToken(data.token);
    authStorage.setUser(data.user);
    return data;
  },

  async getMe() {
    const token = authStorage.getToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/me`, {
      headers: getHeaders(),
    });
    if (!res.ok) {
      authStorage.clearToken();
      authStorage.clearUser();
      return null;
    }
    const data = await res.json();
    authStorage.setUser(data.user);
    return data.user;
  },

  logout() {
    authStorage.clearToken();
    authStorage.clearUser();
  }
};
