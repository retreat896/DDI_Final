import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { io } from 'socket.io-client';
import PlaytimeBarChart from './charts/PlaytimeBarChart';

function Dashboard() {
  const [player, setPlayer] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedAppId, setSelectedAppId] = useState(null);
  const [priceHistory, setPriceHistory] = useState(null);
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000';

  useEffect(() => {
    const steamid = localStorage.getItem('steamid');
    if (!steamid) {
      navigate('/');
      return;
    }

    const fetchData = async () => {
      try {
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

  useEffect(() => {
    const socket = io(API_BASE);

    socket.on('connect', () => {
      console.log('Connected to backend socket');
    });

    socket.on('game_synced', async (data) => {
      console.log('Game synced via background task:', data);
      
      if (selectedAppId === data.appid) {
        try {
          const freshRes = await axios.get(`${API_BASE}/api/games/price_history/${data.appid}`);
          setPriceHistory(freshRes.data);
        } catch (e) {
          console.error("Failed to re-fetch history after socket event");
        }
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [selectedAppId]);

  const handleLogout = () => {
    localStorage.removeItem('steamid');
    document.cookie = 'steamid=; Max-Age=0; path=/;';
    navigate('/');
  };

  const handleGameClick = async (appid) => {
    setSelectedAppId(appid);
    setPriceHistory(null);

    // 1. Fetch cached data
    try {
        const cachedRes = await axios.get(`${API_BASE}/api/games/price_history/${appid}`);
        setPriceHistory(cachedRes.data);
    } catch(e) {
        console.error("Failed to fetch cached history");
    }

    // 2. Fetch fresh data from backend
    try {
        await axios.post(`${API_BASE}/api/games/sync_single/${appid}`);
        
        // 3. Refetch from cache
        const freshRes = await axios.get(`${API_BASE}/api/games/price_history/${appid}`);
        setPriceHistory(freshRes.data);
    } catch(e) {
        console.error("Failed to fetch fresh steam data via backend:", e);
    }
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
          <PlaytimeBarChart games={games} onGameClick={handleGameClick} />
        ) : (
          <p>No game data available or profile is private.</p>
        )}
      </div>

      {selectedAppId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000}}>
          <div className="glass-panel" style={{ width: '500px', maxWidth: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Price History {priceHistory?.game?.name ? `for ${priceHistory.game.name}` : ''}</h3>
              <button className="btn-primary" style={{ padding: '0.4rem 0.8rem', fontSize: '0.9rem' }} onClick={() => setSelectedAppId(null)}>Close</button>
            </div>
            
            {!priceHistory ? (
              <p>Loading cached data...</p>
            ) : priceHistory.history && priceHistory.history.length > 0 ? (
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--glass-border)' }}>
                    <th style={{ padding: '8px' }}>Date</th>
                    <th style={{ padding: '8px' }}>Final Price</th>
                    <th style={{ padding: '8px' }}>Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {priceHistory.history.map((record, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                      <td style={{ padding: '8px' }}>{new Date(record.recorded_at).toLocaleString()}</td>
                      <td style={{ padding: '8px' }}>
                         {record.price_final === 0 ? 'Free' : `${(record.price_final / 100).toFixed(2)}`}
                      </td>
                      <td style={{ padding: '8px' }}>{record.discount_percent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>No historical price data found for this game yet. We are checking Steam in the background...</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
