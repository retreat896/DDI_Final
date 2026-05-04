import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';
import { positionTooltip } from '../../utils/tooltip.js';

const BUCKET_ORDER = [
  'Free', 'Under $1',
  '$1',  '$2',  '$3',  '$4',  '$5',  '$6',  '$7',  '$8',  '$9',
  '$10', '$11', '$12', '$13', '$14', '$15', '$16', '$17', '$18', '$19',
  '$20-$29', '$30-$39', '$40-$49', '$50-$59',
  '$60-$69', '$70-$79', '$80-$89', '$90-$99', '$100+',
];

/**
 * Price distribution chart for a specific user's library.
 * Accepts `games` (Steam owned games array) and optionally `name` for labelling.
 * Shows two overlaid bars: primary user (blue) and compared user (amber) if both provided.
 */
function UserPriceChart({ myGames, myName, theirGames, theirName }) {
  const chartRef = useRef();
  const wrapRef  = useRef();
  const [myData,    setMyData]    = useState([]);
  const [theirData, setTheirData] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  // ── Fetch my data ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!myGames || myGames.length === 0) return;
    setLoading(true);
    const appids = myGames.map(g => g.appid).filter(Boolean);
    axios.post(`${API_BASE}/api/analytics/user-price-distribution`, { appids })
      .then(res => {
        const sorted = [...res.data].sort((a, b) => {
          const ai = BUCKET_ORDER.indexOf(a.bucket);
          const bi = BUCKET_ORDER.indexOf(b.bucket);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        setMyData(sorted);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load price data.'))
      .finally(() => setLoading(false));
  }, [myGames]);

  // ── Fetch their data ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!theirGames || theirGames.length === 0) { setTheirData([]); return; }
    const appids = theirGames.map(g => g.appid).filter(Boolean);
    axios.post(`${API_BASE}/api/analytics/user-price-distribution`, { appids })
      .then(res => {
        const sorted = [...res.data].sort((a, b) => {
          const ai = BUCKET_ORDER.indexOf(a.bucket);
          const bi = BUCKET_ORDER.indexOf(b.bucket);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        setTheirData(sorted);
      })
      .catch(() => setTheirData([]));
  }, [theirGames]);

  // ── Draw chart ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (myData.length === 0 || !chartRef.current) return;

    d3.select(chartRef.current).selectAll('*').remove();

    const hasComparison = theirData.length > 0;

    // Build union of all buckets
    const buckets = [...new Set([
      ...myData.map(d => d.bucket),
      ...theirData.map(d => d.bucket),
    ])].sort((a, b) => {
      const ai = BUCKET_ORDER.indexOf(a);
      const bi = BUCKET_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    const getCount = (arr, bucket) => {
      const found = arr.find(d => d.bucket === bucket);
      return found ? Number(found.count) : 0;
    };

    const data = buckets.map(bucket => ({
      bucket,
      me:   getCount(myData,    bucket),
      them: getCount(theirData, bucket),
    }));

    const margin = { top: 24, right: 24, bottom: 80, left: 60 };
    const containerW = wrapRef.current?.getBoundingClientRect().width || 820;
    const width  = Math.max(containerW - margin.left - margin.right, 300);
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width',  width  + margin.left + margin.right)
      .attr('height', height + margin.top  + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x0 = d3.scaleBand()
      .domain(buckets)
      .range([0, width])
      .paddingInner(hasComparison ? 0.2 : 0.35);

    const x1 = d3.scaleBand()
      .domain(hasComparison ? ['me', 'them'] : ['me'])
      .range([0, x0.bandwidth()])
      .padding(0.08);

    const maxVal = d3.max(data, d => Math.max(d.me, d.them));
    const y = d3.scaleLinear()
      .domain([0, maxVal * 1.15]).nice()
      .range([height, 0]);

    // Grid
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line')
        .attr('stroke', 'rgba(255,255,255,0.06)').attr('stroke-dasharray', '3,3'));

    // X axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text')
        .attr('fill', '#94a3b8').attr('font-size', '11px')
        .attr('transform', 'translate(-8,0)rotate(-40)')
        .style('text-anchor', 'end');

    // Y axis
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}k` : d))
      .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text').attr('fill', '#94a3b8').attr('font-size', '11px');

    svg.append('text').attr('transform', 'rotate(-90)')
      .attr('x', -height / 2).attr('y', -46)
      .attr('text-anchor', 'middle').attr('fill', '#64748b').attr('font-size', '12px')
      .text('Games Owned');

    // Defs – gradient for "me" bar
    const defs = svg.append('defs');
    const myGrad = defs.append('linearGradient').attr('id', 'upg-me-grad')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
    myGrad.append('stop').attr('offset', '0%').attr('stop-color', '#60a5fa').attr('stop-opacity', 0.9);
    myGrad.append('stop').attr('offset', '100%').attr('stop-color', '#3b82f6').attr('stop-opacity', 0.5);

    const themGrad = defs.append('linearGradient').attr('id', 'upg-them-grad')
      .attr('x1', '0%').attr('y1', '0%').attr('x2', '0%').attr('y2', '100%');
    themGrad.append('stop').attr('offset', '0%').attr('stop-color', '#fcd34d').attr('stop-opacity', 0.9);
    themGrad.append('stop').attr('offset', '100%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.5);

    const tip = d3.select('body').select('.d3-upg-tooltip').empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-upg-tooltip').style('opacity', 0)
      : d3.select('body').select('.d3-upg-tooltip');

    const colorMap = { me: 'url(#upg-me-grad)', them: 'url(#upg-them-grad)' };
    const strokeMap = { me: '#60a5fa', them: '#fcd34d' };
    const labelMap  = { me: myName || 'You', them: theirName || 'Compared' };
    const keys = hasComparison ? ['me', 'them'] : ['me'];

    const groups = svg.selectAll('g.group')
      .data(data)
      .enter().append('g')
      .attr('transform', d => `translate(${x0(d.bucket)},0)`);

    keys.forEach(key => {
      groups.append('rect')
        .attr('x', x1(key))
        .attr('width', x1.bandwidth())
        .attr('y', d => y(d[key]))
        .attr('height', d => Math.max(0, height - y(d[key])))
        .attr('fill', colorMap[key])
        .attr('stroke', strokeMap[key])
        .attr('stroke-width', 1)
        .attr('rx', 3)
        .attr('opacity', 0)
        .on('mouseover', function(event, d) {
          d3.select(this).attr('opacity', 1).attr('stroke-width', 2);
          tip.style('opacity', 1)
            .html(`<strong>${d.bucket}</strong><br/>${labelMap[key]}: <strong>${d[key]}</strong> game${d[key] !== 1 ? 's' : ''}`);
          positionTooltip(tip, event);
        })
        .on('mousemove', function(event) { positionTooltip(tip, event); })
        .on('mouseout', function() {
          d3.select(this).attr('opacity', 0.8).attr('stroke-width', 1);
          tip.style('opacity', 0);
        })
        .transition().duration(600).delay((d, i) => i * 30)
        .attr('opacity', 0.8);
    });

    // Legend
    if (hasComparison) {
      const legend = svg.append('g').attr('transform', `translate(${width - 180}, -8)`);
      keys.forEach((key, i) => {
        const g = legend.append('g').attr('transform', `translate(${i * 95}, 0)`);
        g.append('rect').attr('width', 12).attr('height', 12).attr('rx', 2).attr('fill', strokeMap[key]);
        g.append('text').attr('x', 16).attr('y', 10)
          .attr('fill', '#cbd5e1').attr('font-size', '11px')
          .text(labelMap[key].length > 10 ? labelMap[key].slice(0, 9) + '…' : labelMap[key]);
      });
    }

    return () => { d3.select('body').select('.d3-upg-tooltip').style('opacity', 0); };
  }, [myData, theirData, myName, theirName]);

  if (loading) return <div className="skeleton-graph" />;
  if (error)   return <p style={{ color: '#ef4444', textAlign: 'center' }}>{error}</p>;
  if (myData.length === 0) return (
    <p style={{ color: '#64748b', textAlign: 'center', padding: '2rem' }}>
      No price data found for this library in the dataset.
    </p>
  );

  const totalKnown = myData.reduce((s, d) => s + Number(d.count), 0);
  const coveragePct = myGames?.length
    ? Math.round((totalKnown / myGames.length) * 100) : 0;

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <p style={{ color: '#64748b', fontSize: '0.82rem', margin: '0 0 0.75rem' }}>
        Price distribution for{' '}
        <strong style={{ color: '#94a3b8' }}>{totalKnown.toLocaleString()}</strong>
        {' '}of your owned games matched in the dataset
        {' '}({coveragePct}% coverage).
      </p>
      <div className="chart-scroll" ref={chartRef} style={{ overflowX: 'auto' }} />
    </div>
  );
}

export default UserPriceChart;
