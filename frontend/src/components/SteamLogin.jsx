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
      navigate('/dashboard');
    }
  }, [location, navigate]);

  const handleLogin = () => {
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
    window.location.href = `${API_BASE}/api/auth/login`;
  };

  const handleManualResolve = async (e) => {
    e.preventDefault();
    if (!inputVal) return;
    setError('');
    setLoading(true);
    try {
      const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
      const res = await axios.post(`${API_BASE}/api/auth/resolve`, { input: inputVal });
      if (res.data.steamid) {
        localStorage.setItem('steamid', res.data.steamid);
        // Set cookies locally for manual resolution
        document.cookie = `steamid=${res.data.steamid}; Max-Age=${86400*30}; path=/; SameSite=Lax`;
        document.cookie = `user_profile=${encodeURIComponent(JSON.stringify(res.data))}; Max-Age=${86400*30}; path=/; SameSite=Lax`;
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to resolve profile. Please check the URL.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-panel" style={{ textAlign: 'center', margin: '15vh auto', maxWidth: '400px' }}>
      <h2>Welcome Player</h2>
      <p style={{ margin: '1rem 0 2rem' }}>Connect your Steam account to analyze your gaming footprint.</p>
      
      <button className="btn-primary" onClick={handleLogin}>
        Log in with Steam
      </button>

      <div style={{ margin: '2rem 0', opacity: 0.6 }}>— OR —</div>

      <form onSubmit={handleManualResolve} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <input 
          type="text" 
          placeholder="Paste Steam Profile URL or ID..." 
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          style={{ padding: '0.8rem', borderRadius: '4px', border: '1px solid #444', background: '#1a1a2e', color: 'white' }}
        />
        <button type="submit" className="btn-primary" style={{ background: '#3b82f6' }} disabled={loading}>
          {loading ? 'Finding...' : 'View Profile'}
        </button>
        {error && <div style={{ color: '#ef4444', fontSize: '0.9rem' }}>{error}</div>}
      </form>
    </div>
  );
}

export default SteamLogin;
