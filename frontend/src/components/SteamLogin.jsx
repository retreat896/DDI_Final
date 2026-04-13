import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

function SteamLogin() {
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

  return (
    <div className="glass-panel" style={{ textAlign: 'center', margin: '15vh auto', maxWidth: '400px' }}>
      <h2>Welcome Player</h2>
      <p style={{ margin: '1rem 0 2rem' }}>Connect your Steam account to analyze your gaming footprint.</p>
      <button className="btn-primary" onClick={handleLogin}>
        Log in with Steam
      </button>
    </div>
  );
}

export default SteamLogin;
