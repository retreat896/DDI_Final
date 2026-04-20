import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

function SteamLogin() {
  const [inputVal, setInputVal] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const getCookie = (name) => {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    };
    const params = new URLSearchParams(location.search);
    const steamid = params.get('steamid') || getCookie('steamid');
    if (steamid) {
      localStorage.setItem('steamid', steamid);
      localStorage.removeItem('guest');
      navigate('/dashboard');
    }
  }, [location, navigate]);

  const handleLogin = () => {
    const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';
    window.location.href = `${API_BASE}/api/auth/login`;
  };

  const handleManualResolve = async (e) => {
    e.preventDefault();
    if (!inputVal) return;
    setError('');
    setLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';
      const res = await axios.post(`${API_BASE}/api/auth/resolve`, { input: inputVal });
      if (res.data.steamid) {
        localStorage.setItem('steamid', res.data.steamid);
        localStorage.removeItem('guest');
        document.cookie = `steamid=${res.data.steamid}; Max-Age=${86400 * 30}; path=/; SameSite=Lax`;
        document.cookie = `user_profile=${encodeURIComponent(JSON.stringify(res.data))}; Max-Age=${86400 * 30}; path=/; SameSite=Lax`;
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resolve profile. Please check the URL.');
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = () => {
    localStorage.setItem('guest', 'true');
    localStorage.removeItem('steamid');
    navigate('/dashboard');
  };

  return (
    <div className="glass-panel" style={{ textAlign: 'center', margin: '10vh auto', maxWidth: '420px' }}>
      <h2>Welcome Player</h2>
      <p style={{ margin: '0.75rem 0 1.75rem', color: '#94a3b8' }}>
        Connect your Steam account to analyze your gaming footprint, or explore platform-wide stats as a guest.
      </p>

      <button className="btn-primary" onClick={handleLogin}>
        Log in with Steam
      </button>

      <div style={{ margin: '1.5rem 0', opacity: 0.5 }}>— OR —</div>

      <form onSubmit={handleManualResolve} style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
        <input
          type="text"
          placeholder="Paste Steam Profile URL or ID..."
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(15,23,42,0.6)',
            color: '#f8fafc',
            fontSize: '0.9rem',
          }}
        />
        <button
          type="submit"
          className="btn-primary"
          style={{ background: 'linear-gradient(90deg,#3b82f6,#6366f1)' }}
          disabled={loading}
        >
          {loading ? 'Finding…' : 'View Profile'}
        </button>
        {error && <div style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</div>}
      </form>

      {/* Guest access */}
      <div style={{ marginTop: '2rem', paddingTop: '1.5rem', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
        <button
          onClick={handleGuest}
          style={{
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            color: '#94a3b8',
            padding: '0.65rem 1.4rem',
            fontSize: '0.875rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            width: '100%',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)';
            e.currentTarget.style.color = '#f8fafc';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
            e.currentTarget.style.color = '#94a3b8';
          }}
        >
          Continue without an account →
        </button>
        <p style={{ fontSize: '0.75rem', color: '#475569', marginTop: '0.6rem', marginBottom: 0 }}>
          Platform-wide Steam stats are available without signing in.
        </p>
      </div>
    </div>
  );
}

export default SteamLogin;
