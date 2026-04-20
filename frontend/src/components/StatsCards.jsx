/**
 * Stat summary cards: total games, total hours, recently active games, average hours/game.
 */
function StatsCards({ games }) {
  if (!games || games.length === 0) return null;

  const totalGames = games.length;
  const playedGames = games.filter(g => g.playtime_forever > 0);
  const totalHours = playedGames.reduce((acc, g) => acc + g.playtime_forever / 60, 0);
  const recentGames = games.filter(g => g.playtime_2weeks > 0).length;
  const avgHours = playedGames.length > 0 ? totalHours / playedGames.length : 0;

  const cards = [
    {
      label: 'Games Owned',
      value: totalGames.toLocaleString(),
      sub: `${playedGames.length} played`,
      icon: '🎮',
      color: '#3b82f6',
    },
    {
      label: 'Total Hours',
      value: totalHours >= 1000
        ? `${(totalHours / 1000).toFixed(1)}k`
        : totalHours.toFixed(0),
      sub: `${(totalHours / 24).toFixed(0)} days`,
      icon: '⏱️',
      color: '#8b5cf6',
    },
    {
      label: 'Active Recently',
      value: recentGames,
      sub: 'last 2 weeks',
      icon: '🔥',
      color: '#f59e0b',
    },
    {
      label: 'Avg per Game',
      value: `${avgHours.toFixed(1)}h`,
      sub: 'hours per played game',
      icon: '📊',
      color: '#10b981',
    },
  ];

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '1rem',
      marginBottom: '1.5rem',
    }}>
      {cards.map(card => (
        <div
          key={card.label}
          style={{
            background: 'rgba(30,41,59,0.65)',
            border: `1px solid ${card.color}33`,
            borderRadius: '14px',
            padding: '1.25rem 1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
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
          <span style={{ fontSize: '1.6rem' }}>{card.icon}</span>
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
