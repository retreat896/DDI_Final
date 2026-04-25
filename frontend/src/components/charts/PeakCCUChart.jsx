import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

/**
 * Horizontal chart: Highest Peak CCU games.
 */
function PeakCCUChart({ userGames }) {
  const chartRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dbGames, setDbGames] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  const hasLibrary = Array.isArray(userGames) && userGames.length > 0;
  const userAppIds = hasLibrary ? new Set(userGames.map(g => String(g.appid))) : new Set();

  useEffect(() => {
    axios.get(`${API_BASE}/api/analytics/peak-ccu?limit=25`)
      .then(res => {
        setDbGames(res.data);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load peak CCU games.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cleanup;
    if (dbGames.length > 0) {
      cleanup = draw(dbGames);
    }
    return () => { if (cleanup) cleanup(); };
  }, [dbGames, userGames]);

  function draw(data) {
    if (!data || data.length === 0) return;
    d3.select(chartRef.current).selectAll('*').remove();

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

    const minCCU = d3.min(data, d => Math.max(+(d.peak_ccu || 1), 1));
    const maxCCU = d3.max(data, d => +(d.peak_ccu || 1));

    const x = d3.scaleLog()
      .domain([Math.max(minCCU * 0.5, 1), maxCCU * 1.15])
      .range([0, width])
      .nice();

    // Y-axis
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

    // Vertical grid lines
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
        if (d >= 1_000_000) return `${(d / 1_000_000).toFixed(1)}M`;
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
      .text('Peak Concurrent Players (Log Scale)');

    const tooltipSelection = d3.select('body').select('.d3-peakccu-tooltip');
    const tooltip = tooltipSelection.empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-peakccu-tooltip').style('opacity', 0)
      : tooltipSelection;

    svg.selectAll('rect')
      .data(data)
      .enter().append('rect')
      .attr('y', d => y(d.name))
      .attr('x', d => x(x.domain()[0]))
      .attr('height', y.bandwidth())
      .attr('width', 0)
      .attr('fill', d => hasLibrary && userAppIds.has(String(d.appid)) ? '#fbbf24' : '#14b8a6')
      .attr('rx', 4)
      .attr('opacity', d => hasLibrary && userAppIds.has(String(d.appid)) ? 0.95 : 0.75)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1);
        const ownedLine = hasLibrary && userAppIds.has(String(d.appid))
          ? '<br/>✅ <strong>You own this</strong>'
          : '';
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(
          `<strong>${d.name}</strong><br/>` +
          `Genre: ${d.genre_primary || '—'}<br/>` +
          `Peak CCU: ${(+(d.peak_ccu || 0)).toLocaleString()}` +
          ownedLine
        )
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function (event, d) {
        d3.select(this).attr('opacity', hasLibrary && userAppIds.has(String(d.appid)) ? 0.95 : 0.75);
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .transition().duration(600).delay((d, i) => i * 40)
      .attr('x', x(x.domain()[0]))
      .attr('width', d => Math.max(0, x(+(d.peak_ccu || 1)) - x(x.domain()[0])));

    if (hasLibrary) {
      const leg = d3.select(chartRef.current).select('svg')
        .append('g')
        .attr('transform', `translate(${margin.left + width + 12}, ${margin.top + 10})`);

      [{ color: '#fbbf24', label: 'You own this' }, { color: '#14b8a6', label: 'Not in library' }].forEach(({ color, label }, i) => {
        const g = leg.append('g').attr('transform', `translate(0, ${i * 22})`);
        g.append('rect').attr('width', 14).attr('height', 14).attr('rx', 3).attr('fill', color);
        g.append('text').attr('x', 19).attr('y', 11)
          .style('fill', '#94a3b8').style('font-size', '11px').text(label);
      });
    }

    return () => { d3.selectAll('.d3-tooltip').remove(); };
  }

  if (loading) return <div className="skeleton-graph"></div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
        The all-time highest concurrent player peaks recorded on Steam.{' '}
        {hasLibrary
          ? <span style={{ color: '#fbbf24' }}>Gold bars = games already in your library.</span>
          : <span>Sign in to highlight games you already own.</span>}
      </p>
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default PeakCCUChart;
