import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useServerConfig } from '../hooks/useServerConfig';

// --- Personal (Steam API) charts ---
import PlaytimeBarChart from './charts/PlaytimeBarChart';
import PlaytimeDonutChart from './charts/PlaytimeDonutChart';
import RecentVsTotalScatter from './charts/RecentVsTotalScatter';
import LibraryBreakdownChart from './charts/LibraryBreakdownChart';
import OwnedGenreRadarChart from './charts/OwnedGenreRadarChart';
import CompareProfilesChart from './charts/CompareProfilesChart';

// --- Database / Dataset charts ---
import GenreBreakdownChart from './charts/GenreBreakdownChart';
import ReviewDistributionChart from './charts/ReviewDistributionChart';
import PriceDistributionChart from './charts/PriceDistributionChart';
import PublisherTierChart from './charts/PublisherTierChart';
import TopOwnedGamesChart from './charts/TopOwnedGamesChart';
import ReleaseYearChart from './charts/ReleaseYearChart';
import PeakCCUChart from './charts/PeakCCUChart';
import GameFeaturesChart from './charts/GameFeaturesChart';

import StatsCards from './StatsCards';

// ─── Tab definitions ────────────────────────────────────────────────────────
const PERSONAL_TABS = [
  { id: 'overview',  label: 'Top Played' },
  { id: 'donut',     label: 'Playtime Share' },
  { id: 'scatter',   label: 'Recent Activity' },
  { id: 'library',   label: 'Library Breakdown' },
  { id: 'genres',    label: 'Genres' },
];

const DB_TABS = [
  { id: 'genres',     label: 'Genres' },
  { id: 'reviews',    label: 'Review Scores' },
  { id: 'price',      label: 'Price Distribution' },
  { id: 'publisher',  label: 'Publisher Tiers' },
  { id: 'top-owned',  label: 'Most Owned' },
  { id: 'peak-ccu',   label: 'Peak Players' },
  { id: 'releases',   label: 'Game Releases' },
  { id: 'features',   label: 'Features Overview' },
];

// ─── Sub-component: tab bar ──────────────────────────────────────────────────
function TabBar({ tabs, active, onSelect }) {
  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <button
          key={tab.id}
          className={`tab-btn${active === tab.id ? ' active' : ''}`}
          onClick={() => onSelect(tab.id)}
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
  const [comparedPlayer, setComparedPlayer] = useState(null);
  const [comparedGames, setComparedGames] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');
  const [compareInput, setCompareInput] = useState('');
  const navigate = useNavigate();
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';
  const { steamApiEnabled } = useServerConfig();


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

  const handleCompareLookup = async (e) => {
    e.preventDefault();
    if (!compareInput.trim()) return;
    setCompareError('');
    setCompareLoading(true);
    try {
      const resolveRes = await axios.post(`${API_BASE}/api/auth/resolve`, { input: compareInput.trim() });
      const { steamid, persona_name, avatar_url, profile_url } = resolveRes.data;
      if (!steamid) {
        setCompareError('Could not resolve that Steam profile.');
        setCompareLoading(false);
        return;
      }
      const gamesRes = await axios.get(`${API_BASE}/api/games/${steamid}`);
      const games = gamesRes.data?.response?.games || [];
      setComparedGames(games);
      setComparedPlayer({ steam_id: steamid, persona_name: persona_name || steamid, avatar_url, profile_url });
    } catch (err) {
      setCompareError(err.response?.data?.error || 'Failed to load profile.');
    } finally {
      setCompareLoading(false);
    }
  };

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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem', marginBottom: '1.5rem' }}>
          
          {/* Main User Card */}
          <div className="glass-panel" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            margin: 0, gap: '1rem', flexWrap: 'wrap'
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

          {/* Compared User Card / Add Form */}
          <div className="glass-panel" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: 0, minHeight: '100px'
          }}>
            {!comparedPlayer ? (
              <div style={{ width: '100%' }}>
                <p style={{ margin: '0 0 0.5rem 0', color: '#94a3b8', fontSize: '0.85rem' }}>Compare with another player:</p>
                <form onSubmit={handleCompareLookup} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    type="text"
                    placeholder="Steam URL or ID..."
                    value={compareInput}
                    onChange={e => setCompareInput(e.target.value)}
                    style={{
                      flex: 1, padding: '0.5rem 0.75rem', borderRadius: '6px',
                      border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(15,23,42,0.6)',
                      color: '#f8fafc', fontSize: '0.85rem', width: '100%'
                    }}
                  />
                  <button type="submit" disabled={compareLoading} style={{
                    padding: '0.5rem 1rem', borderRadius: '6px',
                    background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)', border: 'none',
                    color: '#fff', fontWeight: 600, cursor: compareLoading ? 'not-allowed' : 'pointer',
                    opacity: compareLoading ? 0.7 : 1,
                  }}>
                    {compareLoading ? '...' : 'Add'}
                  </button>
                </form>
                {compareError && <p style={{ margin: '0.5rem 0 0', color: '#ef4444', fontSize: '0.8rem' }}>{compareError}</p>}
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
                  {comparedPlayer.avatar_url && (
                    <img src={comparedPlayer.avatar_url} alt="Avatar" style={{
                      borderRadius: '10px', width: '64px', height: '64px',
                      border: '2px solid rgba(245,158,11,0.4)',
                    }} />
                  )}
                  <div>
                    <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>
                      {comparedPlayer.persona_name}
                    </h2>
                    {comparedPlayer.profile_url && (
                      <a href={comparedPlayer.profile_url} target="_blank" rel="noreferrer"
                        style={{ color: '#f59e0b', fontSize: '0.85rem' }}>
                        View Steam Profile ↗
                      </a>
                    )}
                  </div>
                </div>
                <button className="btn-primary" onClick={() => { setComparedPlayer(null); setComparedGames(null); setCompareInput(''); }} style={{
                  background: 'transparent', border: '1px solid rgba(245,158,11,0.3)', color: '#f59e0b',
                  padding: '8px 18px', fontSize: '0.9rem',
                }}>Remove</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stats Cards ── */}
      {!isGuest && games.length > 0 && <StatsCards games={games} />}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1 — PERSONAL LIBRARY (Steam API)
      ══════════════════════════════════════════════════════════════════════ */}
      {steamApiEnabled ? (
      <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
        <SectionHeader
          title="Your Library"
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
            position: 'relative',
            overflow: 'hidden'
          }}>
            <img 
              src="/placeholder.png" 
              alt="Analytics Locked"
              style={{
                width: '100%',
                maxWidth: '600px',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                opacity: 0.8,
                mixBlendMode: 'screen'
              }}
            />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 style={{ marginBottom: '0.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>Personal Library Analytics</h3>
              <p style={{ color: '#94a3b8', maxWidth: '380px', margin: '0 auto 1.5rem', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
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
          </div>
        ) : (
          <>
            <TabBar tabs={PERSONAL_TABS} active={personalTab} onSelect={setPersonalTab} />

            <div key={personalTab} className="tab-content">
              {personalTab === 'overview' && (
                <>
                  <p style={{ color: '#64748b', fontSize: '0.8rem', margin: '0 0 0.75rem' }}>
                    Click (or double tap on mobile) a bar to open the game on the Steam Store.
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

              {personalTab === 'genres' && (
                <>
                  {games.length > 0
                    ? <OwnedGenreRadarChart games={games} />
                    : <p style={{ color: '#475569' }}>No game data available or profile is private.</p>}
                </>
              )}
            </div>
          </>
        )}
      </div>
      ) : (
        /* ── No Steam API key: show a brief notice instead of the whole section ── */
        <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
          <SectionHeader title="Your Library" subtitle="Personal library analytics require a Steam API key." />
          <div style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.3)',
            borderRadius: '10px',
            padding: '1.25rem 1.5rem',
            color: '#fbbf24',
            fontSize: '0.88rem',
            lineHeight: 1.6,
          }}>
            ⚠️ <strong>Steam API key not configured.</strong> Personal library features (Top Played, Playtime
            Share, Recent Activity, Library Breakdown, Compare Profiles) are disabled. Add a{' '}
            <code>STEAM_API_KEY</code> to the server environment to enable them.
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1.5 — COMPARISON DASHBOARD
      ══════════════════════════════════════════════════════════════════════ */}
      {steamApiEnabled && !isGuest && (
        <div className="glass-panel" style={{ marginBottom: '1.5rem' }}>
          <SectionHeader
            title="Comparison Dashboard"
            subtitle="Head-to-head comparison of your library vs. another player."
          />
          {!comparedPlayer ? (
            <div style={{
              textAlign: 'center', padding: '3rem 1rem', border: '1px dashed rgba(245,158,11,0.3)',
              borderRadius: '12px', background: 'rgba(245,158,11,0.04)', position: 'relative'
            }}>
              <h3 style={{ marginBottom: '0.5rem', color: '#fbbf24' }}>Compare Profiles</h3>
              <p style={{ color: '#94a3b8', maxWidth: '380px', margin: '0 auto 1.5rem' }}>
                Add a second Steam profile in the header above to see how your top games and playtimes stack up against theirs.
              </p>
            </div>
          ) : comparedGames && comparedGames.length > 0 ? (
            <CompareProfilesChart 
              myGames={games} 
              myName={player?.persona_name || 'You'} 
              theirGames={comparedGames} 
              theirName={comparedPlayer.persona_name} 
            />
          ) : (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8', fontSize: '0.9rem' }}>
              This profile has no public game data available to compare.
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2 — STEAM PLATFORM INSIGHTS (Database / Dataset)
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="glass-panel">
        <SectionHeader
          title="Steam Platform Insights"
          subtitle="Visualizations powered by imported Kaggle dataset — all ~70k+ games on Steam."
        />
        <TabBar tabs={DB_TABS} active={dbTab} onSelect={setDbTab} />

        <div key={dbTab} className="tab-content">
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
                Price Distribution
              </h4>
              <PriceDistributionChart />
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

          {dbTab === 'peak-ccu' && (
            <>
              <h4 style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontWeight: 500, fontSize: '1rem' }}>
                All-Time Peak CCU (Concurrent Players)
              </h4>
              <PeakCCUChart userGames={games} />
            </>
          )}

          {dbTab === 'releases' && (
            <>
              <h4 style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontWeight: 500, fontSize: '1rem' }}>
                Games Released by Year
              </h4>
              <ReleaseYearChart />
            </>
          )}

          {dbTab === 'features' && (
            <>
              <h4 style={{ margin: '0 0 0.25rem', color: '#94a3b8', fontWeight: 500, fontSize: '1rem' }}>
                Game Features Proportions
              </h4>
              <GameFeaturesChart />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
