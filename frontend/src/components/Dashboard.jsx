import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import PlaytimeBarChart from './charts/PlaytimeBarChart';

function Dashboard() {
  const [player, setPlayer] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const steamid = localStorage.getItem('steamid');
    if (!steamid) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
        const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';
        const playerRes = await axios.get(`${API_BASE}/api/player/${steamid}`);
        setPlayer(playerRes.data);

        const gamesRes = await axios.get(`${API_BASE}/api/games/${steamid}`);
        if (gamesRes.data.response && gamesRes.data.response.games) {
          setGames(gamesRes.data.response.games);
        }
      } catch (err) {
        setError("Failed to load data. Ensure backend is running and Steam API key is valid.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('steamid');
    navigate('/');
  };

  if (loading) return <div className="glass-panel" style={{textAlign: 'center'}}>Loading analyzing engines...</div>;
  if (error) return <div className="glass-panel" style={{textAlign: 'center', color: '#ff4d4f'}}>{error}</div>;

  return (
    <div>
      {player && (
        <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
            <img src={player.avatar_url} alt="Avatar" style={{ borderRadius: '8px', width: '64px', height: '64px' }} />
            <div>
              <h2 style={{ margin: 0 }}>{player.persona_name}</h2>
              <a href={player.profile_url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent-color)' }}>View Steam Profile</a>
            </div>
          </div>
          <button className="btn-primary" onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--glass-border)' }}>
            Logout
          </button>
        </div>
      )}

      <div className="glass-panel" style={{ overflowX: 'auto' }}>
        <h3 style={{ marginBottom: '1rem' }}>Top 15 Played Games</h3>
        {games.length > 0 ? (
          <PlaytimeBarChart games={games} />
        ) : (
          <p>No game data available or profile is private.</p>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
