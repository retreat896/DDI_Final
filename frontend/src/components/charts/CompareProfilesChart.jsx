import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

/**
 * Side-by-side grouped bar chart comparing top 10 games of two Steam profiles.
 */
function CompareProfilesChart({ myGames, myName }) {
  const chartRef = useRef();
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [theirGames, setTheirGames] = useState(null);
  const [theirName, setTheirName] = useState('');

  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  const handleLookup = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    setError('');
    setLoading(true);
    try {
      const resolveRes = await axios.post(`${API_BASE}/api/auth/resolve`, { input: input.trim() });
      const { steamid, persona_name } = resolveRes.data;
      if (!steamid) {
        setError('Could not resolve that Steam profile.');
        setLoading(false);
        return;
      }
      const gamesRes = await axios.get(`${API_BASE}/api/games/${steamid}`);
      const games = gamesRes.data?.response?.games || [];
      setTheirGames(games);
      setTheirName(persona_name || steamid);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load profile. Make sure the profile is public.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!myGames || myGames.length === 0 || !theirGames || theirGames.length === 0) return;

    // Build a union of top 10 games from each player
    const myTop = myGames
      .filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 10);

    const theirTop = theirGames
      .filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 10);

    // Union of game names (prefer their appids for lookup)
    const allNames = [...new Set([...myTop.map(g => g.name), ...theirTop.map(g => g.name)])];

    const getHours = (gamesList, name) => {
      const g = gamesList.find(x => x.name === name);
      return g ? g.playtime_forever / 60 : 0;
    };

    const data = allNames.slice(0, 12).map(name => ({
      name,
      me: getHours(myGames, name),
      them: getHours(theirGames, name),
    }));

    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 20, bottom: 130, left: 65 };
    const width = 820 - margin.left - margin.right;
    const height = 360 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x0 = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, width])
      .paddingInner(0.25);

    const x1 = d3.scaleBand()
      .domain(['me', 'them'])
      .range([0, x0.bandwidth()])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => Math.max(d.me, d.them)) * 1.15])
      .range([height, 0]);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-40)')
      .style('text-anchor', 'end')
      .style('fill', 'var(--text-color)')
      .style('font-size', '11px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d.toFixed(0)}h`))
      .selectAll('text')
      .style('fill', 'var(--text-color)');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -55).attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .style('fill', '#94a3b8').style('font-size', '12px')
      .text('Hours Played');

    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip').style('opacity', 0);

    const colorMap = { me: '#3b82f6', them: '#f59e0b' };

    const groups = svg.selectAll('g.group')
      .data(data)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${x0(d.name)},0)`);

    ['me', 'them'].forEach(key => {
      groups.append('rect')
        .attr('x', x1(key))
        .attr('y', d => y(d[key]))
        .attr('width', x1.bandwidth())
        .attr('height', d => height - y(d[key]))
        .attr('fill', colorMap[key])
        .attr('rx', 3)
        .on('mouseover', function (event, d) {
          d3.select(this).attr('opacity', 0.75);
          const who = key === 'me' ? myName || 'You' : theirName;
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`<strong>${d.name}</strong><br/>${who}: ${d[key].toFixed(1)}h`)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function () {
          d3.select(this).attr('opacity', 1);
          tooltip.transition().duration(300).style('opacity', 0);
        });
    });

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${width - 160}, -5)`);
    [{ key: 'me', label: myName || 'You' }, { key: 'them', label: theirName }].forEach(({ key, label }, i) => {
      const g = legend.append('g').attr('transform', `translate(${i * 85}, 0)`);
      g.append('rect').attr('width', 12).attr('height', 12).attr('rx', 3).attr('fill', colorMap[key]);
      g.append('text').attr('x', 16).attr('y', 10)
        .style('fill', '#cbd5e1').style('font-size', '11px')
        .text(label.length > 10 ? label.slice(0, 9) + '…' : label);
    });

    return () => { d3.select('body').select('.d3-compare-tooltip').style('opacity', 0); };
  }, [myGames, theirGames, myName, theirName]);

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '1rem' }}>
        Look up another Steam profile to compare your top games side-by-side.
      </p>
      <form onSubmit={handleLookup} style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input
          type="text"
          placeholder="Paste Steam URL, ID, or vanity name…"
          value={input}
          onChange={e => setInput(e.target.value)}
          style={{
            flex: 1,
            minWidth: '220px',
            padding: '0.6rem 0.9rem',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.15)',
            background: 'rgba(15,23,42,0.6)',
            color: '#f8fafc',
            fontSize: '0.9rem',
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '0.6rem 1.4rem',
            borderRadius: '8px',
            background: 'linear-gradient(90deg,#3b82f6,#8b5cf6)',
            border: 'none',
            color: '#fff',
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Loading…' : 'Compare'}
        </button>
      </form>
      {error && <p style={{ color: '#ef4444', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</p>}
      {!theirGames && !loading && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontSize: '0.9rem' }}>
          Enter a Steam profile above to begin comparison
        </div>
      )}
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default CompareProfilesChart;
