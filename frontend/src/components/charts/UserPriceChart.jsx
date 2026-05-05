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

function sortBuckets(arr) {
  return [...arr].sort((a, b) => {
    const ai = BUCKET_ORDER.indexOf(a.bucket);
    const bi = BUCKET_ORDER.indexOf(b.bucket);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });
}

/**
 * Price chart for a user's library.
 * - Single user: rainbow line + area chart.
 * - Two users:   solid-color grouped bar chart (blue = me, amber = them).
 */
function UserPriceChart({ myGames, myName, theirGames, theirName }) {
  const chartRef = useRef();
  const wrapRef  = useRef();
  const [myData,    setMyData]    = useState([]);
  const [theirData, setTheirData] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');

  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  useEffect(() => {
    if (!myGames || myGames.length === 0) return;
    setLoading(true);
    const appids = myGames.map(g => g.appid).filter(Boolean);
    axios.post(`${API_BASE}/api/analytics/user-price-distribution`, { appids })
      .then(res => setMyData(sortBuckets(res.data)))
      .catch(e => setError(e.response?.data?.error || 'Failed to load price data.'))
      .finally(() => setLoading(false));
  }, [myGames]);

  useEffect(() => {
    if (!theirGames || theirGames.length === 0) { setTheirData([]); return; }
    const appids = theirGames.map(g => g.appid).filter(Boolean);
    axios.post(`${API_BASE}/api/analytics/user-price-distribution`, { appids })
      .then(res => setTheirData(sortBuckets(res.data)))
      .catch(() => setTheirData([]));
  }, [theirGames]);

  // ── Draw chart ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (myData.length === 0 || !chartRef.current) return;
    d3.select(chartRef.current).selectAll('*').remove();

    const hasComparison = theirData.length > 0;

    const buckets = [...new Set([
      ...myData.map(d => d.bucket),
      ...theirData.map(d => d.bucket),
    ])].sort((a, b) => {
      const ai = BUCKET_ORDER.indexOf(a); const bi = BUCKET_ORDER.indexOf(b);
      return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    });

    const getCount = (arr, bucket) => Number(arr.find(d => d.bucket === bucket)?.count || 0);

    const margin = { top: 28, right: 28, bottom: 70, left: 60 };
    const containerW = wrapRef.current?.getBoundingClientRect().width || 820;
    const width  = Math.max(containerW - margin.left - margin.right, 300);
    const height = 260 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width',  width  + margin.left + margin.right)
      .attr('height', height + margin.top  + margin.bottom)
      .append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const maxVal = hasComparison
      ? d3.max(buckets, b => Math.max(getCount(myData, b), getCount(theirData, b)))
      : d3.max(myData, d => Number(d.count));

    const y = d3.scaleLinear().domain([0, maxVal * 1.15]).nice().range([height, 0]);

    // Grid
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke','rgba(255,255,255,0.06)').attr('stroke-dasharray','3,3'));

    // Y axis
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}k` : d))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text').attr('fill','#94a3b8').attr('font-size','11px');

    svg.append('text').attr('transform','rotate(-90)')
      .attr('x',-height/2).attr('y',-46)
      .attr('text-anchor','middle').attr('fill','#64748b').attr('font-size','12px')
      .text('Games Owned');

    const tip = d3.select('body').select('.d3-upg-tooltip').empty()
      ? d3.select('body').append('div').attr('class','d3-tooltip d3-upg-tooltip').style('opacity',0)
      : d3.select('body').select('.d3-upg-tooltip');

    if (!hasComparison) {
      // ── Rainbow line + area (single user) ─────────────────────────────────
      const x = d3.scalePoint().domain(buckets).range([0, width]).padding(0.3);

      svg.append('g').attr('transform',`translate(0,${height})`)
        .call(d3.axisBottom(x))
        .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
        .call(g => g.selectAll('.tick line').remove())
        .selectAll('text').attr('fill','#94a3b8').attr('font-size','11px')
        .attr('dy','1.2em').attr('transform','rotate(-30)').style('text-anchor','end');

      const defs = svg.append('defs');
      const N = 10;
      const areaGrad = defs.append('linearGradient').attr('id','upg-area-grad')
        .attr('x1','0%').attr('y1','0%').attr('x2','100%').attr('y2','0%');
      const lineGrad = defs.append('linearGradient').attr('id','upg-line-grad')
        .attr('x1','0%').attr('y1','0%').attr('x2','100%').attr('y2','0%');
      for (let i = 0; i <= N; i++) {
        const off = `${(i/N)*100}%`; const col = d3.interpolateRainbow(i/N);
        areaGrad.append('stop').attr('offset',off).attr('stop-color',col).attr('stop-opacity',0.25);
        lineGrad.append('stop').attr('offset',off).attr('stop-color',col);
      }
      const glow = defs.append('filter').attr('id','upg-glow');
      glow.append('feGaussianBlur').attr('stdDeviation','3').attr('result','coloredBlur');
      const m = glow.append('feMerge');
      m.append('feMergeNode').attr('in','coloredBlur');
      m.append('feMergeNode').attr('in','SourceGraphic');

      const areaGen = d3.area().x(d=>x(d.bucket)).y0(height).y1(d=>y(Number(d.count))).curve(d3.curveMonotoneX);
      svg.append('path').datum(myData).attr('fill','url(#upg-area-grad)').attr('d',areaGen)
        .attr('opacity',0).transition().duration(700).attr('opacity',1);

      const lineGen = d3.line().x(d=>x(d.bucket)).y(d=>y(Number(d.count))).curve(d3.curveMonotoneX);
      const path = svg.append('path').datum(myData)
        .attr('fill','none').attr('stroke','url(#upg-line-grad)').attr('stroke-width',2.5)
        .attr('filter','url(#upg-glow)').attr('d',lineGen);
      const tl = path.node().getTotalLength();
      path.attr('stroke-dasharray',`${tl} ${tl}`).attr('stroke-dashoffset',tl)
        .transition().duration(900).ease(d3.easeCubicOut).attr('stroke-dashoffset',0);

      svg.selectAll('.dot').data(myData).join('circle').attr('class','dot')
        .attr('cx',d=>x(d.bucket)).attr('cy',d=>y(Number(d.count)))
        .attr('r',4).attr('fill','#0f172a')
        .attr('stroke',(d,i)=>d3.interpolateRainbow(i/myData.length)).attr('stroke-width',2)
        .attr('opacity',0)
        .on('mouseover',function(event,d){
          d3.select(this).attr('r',6).attr('fill',d3.interpolateRainbow(myData.indexOf(d)/myData.length));
          tip.style('opacity',1).html(`<strong>${d.bucket}</strong><br/>${d.count} games`);
          positionTooltip(tip,event);
        })
        .on('mousemove',event=>positionTooltip(tip,event))
        .on('mouseout',function(){ d3.select(this).attr('r',4).attr('fill','#0f172a'); tip.style('opacity',0); })
        .transition().duration(300).delay((_,i)=>600+i*40).attr('opacity',1);

    } else {
      // ── Solid grouped bars (comparison) ───────────────────────────────────
      const x0 = d3.scaleBand().domain(buckets).range([0,width]).paddingInner(0.2);
      const x1 = d3.scaleBand().domain(['me','them']).range([0,x0.bandwidth()]).padding(0.06);

      svg.append('g').attr('transform',`translate(0,${height})`)
        .call(d3.axisBottom(x0))
        .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
        .call(g => g.selectAll('.tick line').remove())
        .selectAll('text').attr('fill','#94a3b8').attr('font-size','11px')
        .attr('transform','translate(-8,0)rotate(-40)').style('text-anchor','end');

      const colorMap = { me: '#3b82f6', them: '#f59e0b' };
      const labelMap = { me: myName || 'You', them: theirName || 'Compared' };
      const data = buckets.map(b => ({ bucket: b, me: getCount(myData, b), them: getCount(theirData, b) }));

      const groups = svg.selectAll('g.grp').data(data).enter().append('g')
        .attr('class','grp').attr('transform',d=>`translate(${x0(d.bucket)},0)`);

      ['me','them'].forEach(key => {
        groups.append('rect')
          .attr('x', x1(key)).attr('width', x1.bandwidth())
          .attr('y', d => y(d[key])).attr('height', d => Math.max(0, height - y(d[key])))
          .attr('fill', colorMap[key]).attr('rx', 3).attr('opacity', 0)
          .on('mouseover', function(event, d) {
            d3.select(this).attr('opacity', 1);
            tip.style('opacity',1).html(`<strong>${d.bucket}</strong><br/>${labelMap[key]}: <strong>${d[key]}</strong> game${d[key]!==1?'s':''}`);
            positionTooltip(tip, event);
          })
          .on('mousemove', event => positionTooltip(tip, event))
          .on('mouseout', function(){ d3.select(this).attr('opacity',0.85); tip.style('opacity',0); })
          .transition().duration(600).delay((_,i) => i*25).attr('opacity',0.85);
      });

      // Legend
      const legend = svg.append('g').attr('transform',`translate(${width-185},-8)`);
      Object.entries(colorMap).forEach(([key, color], i) => {
        const g = legend.append('g').attr('transform',`translate(${i*95},0)`);
        g.append('rect').attr('width',12).attr('height',12).attr('rx',2).attr('fill',color);
        g.append('text').attr('x',16).attr('y',10).attr('fill','#cbd5e1').attr('font-size','11px')
          .text((labelMap[key].length > 10 ? labelMap[key].slice(0,9)+'…' : labelMap[key]));
      });
    }

    return () => { d3.select('body').select('.d3-upg-tooltip').style('opacity',0); };
  }, [myData, theirData, myName, theirName]);

  if (loading) return <div className="skeleton-graph" />;
  if (error)   return <p style={{ color:'#ef4444', textAlign:'center' }}>{error}</p>;
  if (myData.length === 0) return (
    <p style={{ color:'#64748b', textAlign:'center', padding:'2rem' }}>
      No price data found for this library in the dataset.
    </p>
  );

  const totalKnown  = myData.reduce((s,d) => s + Number(d.count), 0);
  const coveragePct = myGames?.length ? Math.round((totalKnown / myGames.length) * 100) : 0;

  return (
    <div ref={wrapRef} style={{ width:'100%' }}>
      <p style={{ color:'#64748b', fontSize:'0.82rem', margin:'0 0 0.75rem' }}>
        Price distribution for{' '}
        <strong style={{ color:'#94a3b8' }}>{totalKnown.toLocaleString()}</strong>
        {' '}of your owned games matched in the dataset ({coveragePct}% coverage).
      </p>
      <div className="chart-scroll" ref={chartRef} style={{ overflowX:'auto' }} />
    </div>
  );
}

export default UserPriceChart;
