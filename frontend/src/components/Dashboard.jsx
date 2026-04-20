import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

// --- Personal (Steam API) charts ---
import PlaytimeBarChart from './charts/PlaytimeBarChart';
import PlaytimeDonutChart from './charts/PlaytimeDonutChart';
import RecentVsTotalScatter from './charts/RecentVsTotalScatter';
import LibraryBreakdownChart from './charts/LibraryBreakdownChart';
import CompareProfilesChart from './charts/CompareProfilesChart';

// --- Database / Dataset charts ---
import GenreBreakdownChart from './charts/GenreBreakdownChart';
import ReviewDistributionChart from './charts/ReviewDistributionChart';
import PriceVsReviewsChart from './charts/PriceVsReviewsChart';
import PublisherTierChart from './charts/PublisherTierChart';
import TopOwnedGamesChart from './charts/TopOwnedGamesChart';

import StatsCards from './StatsCards';

// ─── Tab definitions ────────────────────────────────────────────────────────
const PERSONAL_TABS = [
  { id: 'overview',  label: '📊 Top Played' },
  { id: 'donut',     label: '🍩 Playtime Share' },
  { id: 'scatter',   label: '🔥 Recent Activity' },
  { id: 'library',   label: '📚 Library Breakdown' },
  { id: 'compare',   label: '⚔️ Compare Profiles' },
];

const DB_TABS = [
  { id: 'genres',     label: '🎮 Genres' },
  { id: 'reviews',    label: '⭐ Review Scores' },
  { id: 'price',      label: '💰 Price vs Reviews' },
  { id: 'publisher',  label: '🏢 Publisher Tiers' },
  { id: 'top-owned',  label: '🌍 Most Owned' },
];

// ─── Sub-component: tab bar ──────────────────────────────────────────────────
function TabBar({ tabs, active, onSelect }) {
  return (
    <div style={{
      display: 'flex',
      gap: '0.45rem',
      marginBottom: '1.1rem',
      overflowX: 'auto',
      paddingBottom: '4px',
      flexWrap: 'wrap',
    }}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onSelect(tab.id)}
          style={{
            padding: '0.45rem 1rem',
            borderRadius: '999px',
            border: active === tab.id
              ? '1px solid rgba(59,130,246,0.6)'
              : '1px solid rgba(255,255,255,0.1)',
            background: active === tab.id
              ? 'linear-gradient(90deg,rgba(59,130,246,0.25),rgba(139,92,246,0.25))'
              : 'rgba(30,41,59,0.5)',
            color: active === tab.id ? '#f8fafc' : '#94a3b8',
            fontWeight: active === tab.id ? 600 : 400,
            fontSize: '0.82rem',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// ─── Section header ─────────────────────────────────────────────────────────
function SectionHeader({ title, subtitle }) {
  return (
    <div style={{ marginBottom: '1.25rem' }}>
      <h3 style={{ marginBottom: '0.25rem' }}>{title}</h3>
      {subtitle && <p style={{ color: '#475569', fontSize: '0.82rem', margin: 0 }}>{subtitle}</p>}
    </div>
  );
}

// ─── Main Dashboard ──────────────────────────────────────────────────────────
function Dashboard() {
  const [player, setPlayer] = useState(null);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [personalTab, setPersonalTab] = useState('overview');
  const [dbTab, setDbTab] = useState('genres');
  const [isGuest, setIsGuest] = useState(false);
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  useEffect(() => {
    const steamid = localStorage.getItem('steamid');
    const guest = localStorage.getItem('guest') === 'true';

    // Redirect only if neither authenticated nor a guest
    if (!steamid && !guest) { navigate('/'); return; }

    if (guest && !steamid) {
      setIsGuest(true);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const getCookie = (name) => {
          const value = `; ${document.cookie}`;
          const parts = value.split(`; ${name}=`);
          if (parts.length === 2) return parts.pop().split(';').shift();
          return null;
        };

        const cookieProfile = getCookie('user_profile');
        if (cookieProfile) {
          try { setPlayer(JSON.parse(decodeURIComponent(cookieProfile))); }
          catch (e) { setPlayer({ steam_id: steamid }); }
        } else {
          setPlayer({ steam_id: steamid });
        }

        const gamesRes = await axios.get(`${API_BASE}/api/games/${steamid}`);
        if (gamesRes.data.response?.games) setGames(gamesRes.data.response.games);
      } catch {
        setError('Failed to load profile data. Check that the backend is running.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate, API_BASE]);

  const handleLogout = () => {
    localStorage.removeItem('steamid');
    localStorage.removeItem('guest');
    document.cookie = 'steamid=; Max-Age=0; path=/;';
    document.cookie = 'user_profile=; Max-Age=0; path=/;';
    navigate('/');
  };

  const handleGameClick = (appid) =>
    window.open(`https://store.steampowered.com/app/${appid}`, '_blank');

  if (loading) return (
    <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem' }}>
      <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚙️</div>
      <p style={{ color: '#94a3b8' }}>Analyzing your gaming footprint…</p>
    </div>
  );

  if (error) return (
    <div className="glass-panel" style={{ textAlign: 'center', color: '#ff4d4f' }}>{error}</div>
  );

  return (
    <div>
      {/* ── Profile Header ── */}
      {isGuest ? (
        <div className="glass-panel" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: '2rem' }}>👤</span>
            <div>
              <h2 style={{ margin: 0, marginBottom: '0.2rem' }}>Browsing as Guest</h2>
              <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>
                Sign in to unlock personal library analytics.
              </p>
            </div>
          </div>
          <button
            className="btn-primary"
            onClick={() => navigate('/')}
            style={{ padding: '8px 18px', fontSize: '0.9rem' }}
          >
            Sign In
          </button>
        </div>
      ) : player && (
        <div className="glass-panel" style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '1.5rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
            {player.avatar_url && (
              <img src={player.avatar_url} alt="Avatar" style={{
                borderRadius: '10px', width: '64px', height: '64px',
                border: '2px solid rgba(59,130,246,0.4)',
              }} />
            )}
            <div>
              <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>
                {player.persona_name || player.steamid || 'Steam Player'}
              </h2>
              {player.profile_url && (
                <a href={player.profile_url} target="_blank" rel="noreferrer"
                  style={{ color: 'var(--accent-color)', fontSize: '0.85rem' }}>
                  View Steam Profile ↗
                </a>
              )}
            </div>
          </div>
          <button className="btn-primary" onClick={handleLogout} style={{
            background: 'transparent', border: '1px solid var(--glass-border)',
            padding: '8px 18px', fontSize: '0.9rem',
          }}>Logout</button>
        </div>
      )}

      {/* ── Stats Cards ── */}
      {!isGuest && games.length > 0 && <StatsCards games={games} />}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — PERSONAL LIBRARY (Steam API)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <SectionHeader
          title="🎯 Your Library"
          subtitle="Visualizations built from your personal Steam profile data."
        />

        {isGuest ? (
          /* ── Guest call-to-action ── */
          <div style={{
            textAlign: 'center',
            padding: '3rem 1rem',
            border: '1px dashed rgba(59,130,246,0.3)',
            borderRadius: '12px',
            background: 'rgba(59,130,246,0.04)',
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔒</div>
            <h3 style={{ marginBottom: '0.5rem' }}>Personal Library Analytics</h3>
            <p style={{ color: '#64748b', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
              Sign in with your Steam account (or paste a profile URL) to see your top played games,
              playtime breakdown, recent activity, and head-to-head comparisons.
            </p>
            <button
              className="btn-primary"
              onClick={() => navigate('/')}
              style={{ padding: '0.65rem 2rem', fontSize: '0.95rem' }}
            >
              Sign In to Unlock
            </button>
          </div>
        ) : (
          <>
            <TabBar tabs={PERSONAL_TABS} active={personalTab} onSelect={setPersonalTab} />

            {personalTab === 'overview' && (
              <>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
                  Click a bar to open the game on the Steam Store.
                </p>
                {games.length > 0
                  ? <PlaytimeBarChart games={games} onGameClick={handleGameClick} />
                  : <p style={{ color: '#475569' }}>No game data available or profile is private.</p>}
              </>
            )}

            {personalTab === 'donut' && (
              <>
                <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
                  How your total playtime is split across your top 8 games vs. everything else.
                </p>
                {games.length > 0
                  ? <PlaytimeDonutChart games={games} />
                  : <p style={{ color: '#475569' }}>No game data available or profile is private.</p>}
              </>
            )}

            {personalTab === 'scatter' && (
              <>
                {games.filter(g => g.playtime_2weeks > 0).length === 0
                  ? <p style={{ color: '#64748b' }}>No recent playtime data (last 2 weeks) found for this profile.</p>
                  : <RecentVsTotalScatter games={games} />}
              </>
            )}

            {personalTab === 'library' && (
              <>
                {games.length > 0
                  ? <LibraryBreakdownChart games={games} />
                  : <p style={{ color: '#475569' }}>No game data available or profile is private.</p>}
              </>
            )}

            {personalTab === 'compare' && (
              <>
                {games.length > 0
                  ? <CompareProfilesChart myGames={games} myName={player?.persona_name || 'You'} />
                  : <p style={{ color: '#475569' }}>No game data available or profile is private.</p>}
              </>
            )}
          </>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — STEAM PLATFORM INSIGHTS (Database / Dataset)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-panel">
        <SectionHeader
          title="🌐 Steam Platform Insights"
          subtitle="Visualizations powered by imported Kaggle dataset — all ~70k+ games on Steam."
        />
        <TabBar tabs={DB_TABS} active={dbTab} onSelect={setDbTab} />

        {dbTab === 'genres' && (
          <>
            <h4 style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontWeight: 500, fontSize: '1rem' }}>
              Top Genres by Game Count
            </h4>
            <GenreBreakdownChart />
          </>
        )}

        {dbTab === 'reviews' && (
          <>
            <h4 style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontWeight: 500, fontSize: '1rem' }}>
              Review Score Distribution
            </h4>
            <ReviewDistributionChart />
          </>
        )}

        {dbTab === 'price' && (
          <>
            <h4 style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontWeight: 500, fontSize: '1rem' }}>
              Price vs. Review Score
            </h4>
            <PriceVsReviewsChart />
          </>
        )}

        {dbTab === 'publisher' && (
          <>
            <h4 style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontWeight: 500, fontSize: '1rem' }}>
              Indie / AA / AAA Publisher Tiers
            </h4>
            <PublisherTierChart />
          </>
        )}

        {dbTab === 'top-owned' && (
          <>
            <h4 style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontWeight: 500, fontSize: '1rem' }}>
              Most Owned Games on Steam
            </h4>
            <TopOwnedGamesChart userGames={games} />
          </>
        )}
      </div>
    </div>
  );
}

export default Dashboard;
