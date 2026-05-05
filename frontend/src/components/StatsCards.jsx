import { useEffect, useState } from 'react';
import axios from 'axios';

/**
 * Stat summary cards: total games, total hours, recently active, average, library value,
 * and account creation date/age derived from the player profile.
 */
function StatsCards({ games, player }) {
  if (!games || games.length === 0) return null;

  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';
  const [libraryValue, setLibraryValue] = useState(null);

  const totalGames  = games.length;
  const playedGames = games.filter(g => g.playtime_forever > 0);
  const totalHours  = playedGames.reduce((acc, g) => acc + g.playtime_forever / 60, 0);
  const recentGames = games.filter(g => g.playtime_2weeks > 0).length;
  const recentHours = games.filter(g => g.playtime_2weeks > 0).reduce((acc, g) => acc + g.playtime_2weeks / 60, 0);
  const avgHours    = totalGames > 0 ? totalHours / totalGames : 0;

  useEffect(() => {
    if (!games || games.length === 0) return;
    const appids = games.map(g => g.appid).filter(Boolean);
    axios.post(`${API_BASE}/api/analytics/user-library-value`, { appids })
      .then(res => setLibraryValue(res.data.total_value))
      .catch(() => setLibraryValue(null));
  }, [games]);

  // Account age derived from Steam's timecreated (Unix timestamp)
  const timecreated = player?.timecreated;
  let createdLabel = null;
  let ageLabel     = null;
  if (timecreated) {
    const created    = new Date(timecreated * 1000);
    const now        = new Date();
    const totalDays  = Math.floor((now - created) / 86_400_000);
    const years      = Math.floor(totalDays / 365);
    const months     = Math.floor((totalDays % 365) / 30);
    createdLabel = created.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    ageLabel     = years > 0 ? `${years}y ${months}m` : `${months} months`;
  }

  const fmtValue = v => v >= 1000 ? `$${(v / 1000).toFixed(1)}k` : `$${v.toFixed(0)}`;

  const cards = [
    {
      label: 'Games Owned',
      value: totalGames.toLocaleString(),
      sub: `${playedGames.length} played`,
      icon: '',
      color: '#3b82f6',
    },
    {
      label: 'Total Hours',
      value: totalHours >= 1000 ? `${(totalHours / 1000).toFixed(1)}k` : totalHours.toFixed(0),
      sub: `${(totalHours / 24).toFixed(0)} days`,
      icon: '',
      color: '#8b5cf6',
    },
    {
      label: 'played in the last 2 weeks',
      value: `${recentHours.toFixed(1)}h`,
      sub: `across ${recentGames} different games`,
      icon: '',
      color: '#f59e0b',
    },
    {
      label: 'Avg per Game',
      value: `${avgHours.toFixed(1)}h`,
      sub: 'hours per owned game',
      icon: '',
      color: '#10b981',
    },
    ...(libraryValue !== null ? [{
      label: 'Library Value',
      value: fmtValue(libraryValue),
      sub: 'estimated from dataset prices',
      icon: '',
      color: '#f472b6',
    }] : []),
    ...(createdLabel ? [{
      label: 'Account Created',
      value: ageLabel,
      sub: createdLabel,
      icon: '',
      color: '#ec4899',
    }] : []),
  ];

  return (
    <div className="stats-grid" style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem',
      overflowX: 'auto', // Enable horizontal scrolling
      whiteSpace: 'nowrap', // Prevent wrapping of cards
    }}>
      {cards.map(card => (
        <div
          key={card.label}
          style={{
            display: 'inline-block', // Ensure cards are inline for scrolling
            background: 'rgba(30,41,59,0.65)',
            border: `1px solid ${card.color}33`,
            borderRadius: '14px',
            padding: '1.25rem 1.5rem',
            marginRight: '1rem', // Add spacing between cards
            transition: 'transform 0.2s ease, box-shadow 0.2s ease',
            boxShadow: `0 4px 24px ${card.color}18`,
            backdropFilter: 'blur(10px)',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'translateY(-3px)';
            e.currentTarget.style.boxShadow = `0 8px 28px ${card.color}30`;
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = `0 4px 24px ${card.color}18`;
          }}
        >
          <span style={{ fontSize: '1.4rem' }}>{card.icon}</span>
          <span style={{
            fontSize: '1.75rem',
            fontWeight: 700,
            color: card.color,
            lineHeight: 1.1,
          }}>{card.value}</span>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 600 }}>{card.label}</span>
          <span style={{ fontSize: '0.72rem', color: '#475569' }}>{card.sub}</span>
        </div>
      ))}
    </div>
  );
}

export default StatsCards;
