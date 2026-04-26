import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';
import { positionTooltip } from '../../utils/tooltip.js';

/**
 * Horizontal chart: Top 15 games by estimated ownership (DB).
 * Only highlights owned games when userGames has actual entries.
 */
function TopOwnedGamesChart({ userGames }) {
  const chartRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dbGames, setDbGames] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  // True only when a logged-in user's library has been loaded
  const hasLibrary = Array.isArray(userGames) && userGames.length > 0;
  const userAppIds = hasLibrary ? new Set(userGames.map(g => String(g.appid))) : new Set();

  useEffect(() => {
    axios.get(`${API_BASE}/api/analytics/top-owned?limit=25`)
      .then(res => {
        setDbGames(res.data);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load top owned games.'))
      .finally(() => setLoading(false));
  }, []);

  // Full redraw only when DB data arrives
  useEffect(() => {
    if (dbGames.length > 0) draw(dbGames);
  }, [dbGames]); // eslint-disable-line react-hooks/exhaustive-deps

  // Lightweight color update when user library changes (no full redraw)
  useEffect(() => {
    if (!chartRef.current || dbGames.length === 0) return;
    const ownedIds = Array.isArray(userGames) ? new Set(userGames.map(g => String(g.appid))) : new Set();
    const owned = ownedIds.size > 0;
    d3.select(chartRef.current).selectAll('rect')
      .attr('fill', d => owned && ownedIds.has(String(d?.appid)) ? '#fbbf24' : '#6366f1')
      .attr('opacity', d => owned && ownedIds.has(String(d?.appid)) ? 0.95 : 0.75);
  }, [userGames, dbGames]);

  function draw(data) {
    if (!data || data.length === 0) return;
    d3.select(chartRef.current).selectAll('*').remove();

    // Right margin: wider when legend is shown, tighter when not
    const margin = { top: 10, right: hasLibrary ? 170 : 20, bottom: 50, left: 160 };
    const width = 760 - margin.left - margin.right;
    const height = Math.max(data.length * 34, 200);

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, height])
      .padding(0.22);

    const minOwners = d3.min(data, d => Math.max(+(d.owners_midpoint || 1), 1));
    const maxOwners = d3.max(data, d => +(d.owners_midpoint || 1));

    const x = d3.scaleLog()
      .domain([Math.max(minOwners * 0.5, 1), maxOwners * 1.15])
      .range([0, width])
      .nice();

    // Y-axis labels — gold + bold only when library comparison is active
    svg.append('g')
      .call(d3.axisLeft(y))
      .selectAll('text')
      .style('fill', d => {
        if (!hasLibrary) return '#cbd5e1';
        const game = data.find(g => g.name === d);
        return userAppIds.has(String(game?.appid)) ? '#fbbf24' : '#cbd5e1';
      })
      .style('font-size', '11.5px')
      .style('font-weight', d => {
        if (!hasLibrary) return '400';
        const game = data.find(g => g.name === d);
        return userAppIds.has(String(game?.appid)) ? '700' : '400';
      });

    // Vertical grid lines (log-friendly)
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5, '.0s').tickSize(-height).tickFormat(''))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line')
        .attr('stroke', 'rgba(255,255,255,0.06)')
        .attr('stroke-dasharray', '3,3'));

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => {
        if (d >= 1_000_000) return `${(d / 1_000_000).toFixed(0)}M`;
        if (d >= 1_000) return `${(d / 1_000).toFixed(0)}k`;
        return d;
      }))
      .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text').style('fill', '#94a3b8');

    svg.append('text')
      .attr('x', width / 2).attr('y', height + 42)
      .attr('text-anchor', 'middle')
      .style('fill', '#64748b').style('font-size', '12px')
      .text('Estimated Owners');

    const tooltipSelection = d3.select('body').select('.d3-topowned-tooltip');
    const tooltip = tooltipSelection.empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-topowned-tooltip').style('opacity', 0)
      : tooltipSelection;

    svg.selectAll('rect')
      .data(data)
      .enter().append('rect')
      .attr('y', d => y(d.name))
      .attr('x', d => x(x.domain()[0]))
      .attr('height', y.bandwidth())
      .attr('width', 0)
      // Only colour gold when library comparison is active
      .attr('fill', d => hasLibrary && userAppIds.has(String(d.appid)) ? '#fbbf24' : '#3b82f6')
      .attr('rx', 4)
      .attr('opacity', d => hasLibrary && userAppIds.has(String(d.appid)) ? 0.95 : 0.75)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1);
        const pos = +(d.positive_reviews || 0);
        const neg = +(d.negative_reviews || 0);
        const total = pos + neg;
        const pct = total > 0 ? ((pos / total) * 100).toFixed(1) : '?';
        // Only show ownership hint when library is loaded
        const ownedLine = hasLibrary && userAppIds.has(String(d.appid))
          ? '<br/>✅ <strong>You own this</strong>'
          : '';
        tooltip.style('opacity', 1);
        tooltip.html(
          `<strong>${d.name}</strong><br/>` +
          `Genre: ${d.genre_primary || '—'}<br/>` +
          `Owners: ~${(+(d.owners_midpoint || 0)).toLocaleString()}<br/>` +
          `Reviews: ${pct}% positive` +
          ownedLine
        )
          positionTooltip(tooltip, event);
      })
      .on('mouseout', function (event, d) {
        d3.select(this).attr('opacity', hasLibrary && userAppIds.has(String(d.appid)) ? 0.95 : 0.75);
        tooltip.style('opacity', 0);
      })
      .transition().duration(600).delay((d, i) => i * 40)
      .attr('x', x(x.domain()[0]))
      .attr('width', d => Math.max(0, x(+(d.owners_midpoint || 1)) - x(x.domain()[0])));

    // Legend — only render when library comparison is active
    if (hasLibrary) {
      const leg = d3.select(chartRef.current).select('svg')
        .append('g')
        .attr('transform', `translate(${margin.left + width + 12}, ${margin.top + 10})`);

      [{ color: '#fbbf24', label: 'You own this' }, { color: '#3b82f6', label: 'Not in library' }].forEach(({ color, label }, i) => {
        const g = leg.append('g').attr('transform', `translate(0, ${i * 22})`);
        g.append('rect').attr('width', 14).attr('height', 14).attr('rx', 3).attr('fill', color);
        g.append('text').attr('x', 19).attr('y', 11)
          .style('fill', '#94a3b8').style('font-size', '11px').text(label);
      });
    }

    return () => { d3.select('body').select('.d3-topowned-tooltip').style('opacity', 0); };
  }

  if (loading) return <div className="skeleton-graph"></div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
        Most-owned games across the entire Steam dataset.{' '}
        {hasLibrary
          ? <span style={{ color: '#fbbf24' }}>Gold bars = games already in your library.</span>
          : <span>Sign in to highlight games you already own.</span>}
      </p>
      <div className="chart-scroll" ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default TopOwnedGamesChart;
