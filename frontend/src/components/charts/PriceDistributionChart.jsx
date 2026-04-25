import { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

const BUCKET_ORDER = [
  'Free',
  'Under $1',
  '$1',  '$2',  '$3',  '$4',  '$5',  '$6',  '$7',  '$8',  '$9',
  '$10', '$11', '$12', '$13', '$14', '$15', '$16', '$17', '$18', '$19',
  '$20-$29', '$30-$39', '$40-$49', '$50-$59',
  '$60-$69', '$70-$79', '$80-$89', '$90-$99',
  '$100+',
];

function PriceDistributionChart() {
  const mainRef    = useRef();
  const contextRef = useRef();
  const brushRef   = useRef();       // holds the d3 brush instance
  const brushGRef  = useRef();       // holds the <g> element for the brush

  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState('');
  const [allData, setAllData]         = useState([]);
  const [displayData, setDisplayData] = useState([]);

  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';
  const isZoomed = displayData.length > 0 && displayData.length < allData.length;

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    axios.get(`${API_BASE}/api/analytics/price-distribution`)
      .then(res => {
        const sorted = [...res.data].sort((a, b) => {
          const ai = BUCKET_ORDER.indexOf(a.bucket);
          const bi = BUCKET_ORDER.indexOf(b.bucket);
          return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        });
        setAllData(sorted);
        setDisplayData(sorted);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load price distribution.'))
      .finally(() => setLoading(false));
  }, []);

  // ── Draw main chart whenever displayData changes ───────────────────────────
  useEffect(() => {
    if (displayData.length > 0) drawMain(displayData);
  }, [displayData]);

  // ── Draw context chart whenever allData changes ───────────────────────────
  useEffect(() => {
    if (allData.length > 0) drawContext(allData);
  }, [allData]);

  // ── Reset zoom ────────────────────────────────────────────────────────────
  const resetZoom = useCallback(() => {
    setDisplayData(allData);
    // Clear the brush selection visually
    if (brushGRef.current && brushRef.current) {
      d3.select(brushGRef.current).call(brushRef.current.move, null);
    }
  }, [allData]);

  // ── Main chart (zoomed view) ──────────────────────────────────────────────
  function drawMain(data) {
    if (!data || data.length === 0 || !mainRef.current) return;
    d3.select(mainRef.current).selectAll('*').remove();

    const container = mainRef.current.getBoundingClientRect();
    const margin = { top: 28, right: 32, bottom: 56, left: 72 };
    const width  = (container.width || 580) - margin.left - margin.right;
    const height = 260 - margin.top - margin.bottom;

    const svg = d3.select(mainRef.current)
      .append('svg')
      .attr('width',  width  + margin.left + margin.right)
      .attr('height', height + margin.top  + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint()
      .domain(data.map(d => d.bucket))
      .range([0, width]).padding(0.3);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => +d.count) * 1.15]).nice()
      .range([height, 0]);

    // Defs
    const defs = svg.append('defs');
    const areaGrad = defs.append('linearGradient').attr('id', 'pm-area-grad')
      .attr('x1','0%').attr('y1','0%').attr('x2','0%').attr('y2','100%');
    areaGrad.append('stop').attr('offset','0%') .attr('stop-color','rgba(59,130,246,0.55)');
    areaGrad.append('stop').attr('offset','100%').attr('stop-color','rgba(59,130,246,0.02)');
    const glow = defs.append('filter').attr('id','pm-glow');
    glow.append('feGaussianBlur').attr('stdDeviation','3').attr('result','coloredBlur');
    const merge = glow.append('feMerge');
    merge.append('feMergeNode').attr('in','coloredBlur');
    merge.append('feMergeNode').attr('in','SourceGraphic');

    // Grid
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line')
        .attr('stroke','rgba(255,255,255,0.07)').attr('stroke-dasharray','3,3'));

    // Axes
    svg.append('g').attr('transform',`translate(0,${height})`)
      .call(d3.axisBottom(x))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text')
        .attr('fill','#94a3b8').attr('font-size','11px')
        .attr('dy','1.2em').attr('transform','rotate(-30)')
        .style('text-anchor','end');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}k` : d))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text').attr('fill','#94a3b8').attr('font-size','11px');

    svg.append('text').attr('x', width/2).attr('y', height+52)
      .attr('text-anchor','middle').attr('fill','#64748b').attr('font-size','12px')
      .text('Price Range');
    svg.append('text').attr('transform','rotate(-90)').attr('x',-height/2).attr('y',-54)
      .attr('text-anchor','middle').attr('fill','#64748b').attr('font-size','12px')
      .text('Number of Games');

    // Area
    const areaGen = d3.area()
      .x(d => x(d.bucket)).y0(height).y1(d => y(+d.count)).curve(d3.curveMonotoneX);
    svg.append('path').datum(data)
      .attr('fill','url(#pm-area-grad)').attr('d', areaGen)
      .attr('opacity',0).transition().duration(700).attr('opacity',1);

    // Line
    const lineGen = d3.line()
      .x(d => x(d.bucket)).y(d => y(+d.count)).curve(d3.curveMonotoneX);
    const linePath = svg.append('path').datum(data)
      .attr('fill','none').attr('stroke','#3b82f6').attr('stroke-width',3)
      .attr('filter','url(#pm-glow)').attr('d', lineGen);
    const tl = linePath.node().getTotalLength();
    linePath.attr('stroke-dasharray',`${tl} ${tl}`).attr('stroke-dashoffset', tl)
      .transition().duration(1000).ease(d3.easeCubicOut).attr('stroke-dashoffset', 0);

    // Tooltip
    const existing = d3.select('body').select('.d3-price-tooltip');
    const tip = existing.empty()
      ? d3.select('body').append('div').attr('class','d3-tooltip d3-price-tooltip').style('opacity',0)
      : existing;

    // Dots + labels
    svg.selectAll('.dot').data(data).join('circle').attr('class','dot')
      .attr('cx', d => x(d.bucket)).attr('cy', d => y(+d.count))
      .attr('r', 5).attr('fill','#0f172a').attr('stroke','#60a5fa').attr('stroke-width',2.5)
      .attr('opacity', 0)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r',7).attr('fill','#60a5fa');
        tip.style('opacity',1)
          .html(`<strong>${d.bucket}</strong><br/>${(+d.count).toLocaleString()} games`);
      })
      .on('mousemove', function(event) {
        tip.style('left',(event.pageX+12)+'px').style('top',(event.pageY-28)+'px');
      })
      .on('mouseout', function() {
        d3.select(this).attr('r',5).attr('fill','#0f172a');
        tip.style('opacity',0);
      })
      .transition().duration(500).delay((d,i) => 500+i*50).attr('opacity',1);

    svg.selectAll('.val-label').data(data).join('text').attr('class','val-label')
      .attr('x', d => x(d.bucket)).attr('y', d => y(+d.count)-12)
      .attr('text-anchor','middle').attr('fill','#94a3b8').attr('font-size','10px')
      .attr('opacity',0)
      .text(d => +d.count >= 1000 ? `${(+d.count/1000).toFixed(1)}k` : d.count)
      .transition().duration(400).delay((d,i) => 800+i*50).attr('opacity',1);
  }

  // ── Context / overview mini-chart with brush ──────────────────────────────
  function drawContext(data) {
    if (!data || data.length === 0 || !contextRef.current) return;
    d3.select(contextRef.current).selectAll('*').remove();

    const container = contextRef.current.getBoundingClientRect();
    const margin = { top: 6, right: 32, bottom: 28, left: 72 };
    const width  = (container.width || 580) - margin.left - margin.right;
    const height = 60 - margin.top - margin.bottom;

    const svg = d3.select(contextRef.current)
      .append('svg')
      .attr('width',  width  + margin.left + margin.right)
      .attr('height', height + margin.top  + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scalePoint()
      .domain(data.map(d => d.bucket)).range([0, width]).padding(0.3);
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => +d.count) * 1.1]).range([height, 0]);

    // Mini area
    const areaGen = d3.area()
      .x(d => x(d.bucket)).y0(height).y1(d => y(+d.count)).curve(d3.curveMonotoneX);
    svg.append('path').datum(data)
      .attr('fill','rgba(59,130,246,0.2)').attr('stroke','rgba(59,130,246,0.5)')
      .attr('stroke-width', 1.5).attr('d', areaGen);

    // X axis (tick labels only)
    svg.append('g').attr('transform',`translate(0,${height})`)
      .call(d3.axisBottom(x).tickSize(3))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.1)'))
      .selectAll('text')
        .attr('fill','#64748b').attr('font-size','9px')
        .attr('dy','1.2em').attr('transform','rotate(-30)')
        .style('text-anchor','end');

    // Helper: convert pixel x → nearest bucket index
    function pxToBucketIdx(px) {
      const steps = data.map((d, i) => ({ i, cx: x(d.bucket) }));
      let best = 0, bestDist = Infinity;
      steps.forEach(s => { const d = Math.abs(s.cx - px); if (d < bestDist) { bestDist = d; best = s.i; } });
      return best;
    }

    // Brush
    const brush = d3.brushX()
      .extent([[0, 0], [width, height]])
      .on('end', function(event) {
        if (!event.selection) return;
        const [px0, px1] = event.selection;
        const i0 = pxToBucketIdx(px0);
        const i1 = pxToBucketIdx(px1);
        const filtered = data.slice(Math.min(i0, i1), Math.max(i0, i1) + 1);
        if (filtered.length >= 2) setDisplayData(filtered);
      });

    brushRef.current = brush;
    const bGroup = svg.append('g').attr('class','brush').call(brush);
    brushGRef.current = bGroup.node();

    // Style the brush selection
    bGroup.select('.selection')
      .attr('fill','rgba(139,92,246,0.2)')
      .attr('stroke','rgba(139,92,246,0.6)')
      .attr('stroke-width', 1.5);
  }

  if (loading) return <div className="skeleton-graph"></div>;
  if (error)   return <p style={{ color:'#ef4444', textAlign:'center' }}>{error}</p>;

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'0.5rem' }}>
        <p style={{ color:'#64748b', fontSize:'0.85rem', margin:0 }}>
          {isZoomed
            ? <>Showing <strong style={{ color:'#94a3b8' }}>{displayData[0]?.bucket} → {displayData[displayData.length-1]?.bucket}</strong>. Drag the overview below to change range.</>
            : <>Number of Steam games in each price bracket ({allData.reduce((s,d) => s + +d.count, 0).toLocaleString()} titles). Drag the overview below to zoom in.</>
          }
        </p>
        {isZoomed && (
          <button
            onClick={resetZoom}
            style={{
              padding: '0.3rem 0.9rem',
              fontSize: '0.78rem',
              borderRadius: '999px',
              border: '1px solid rgba(139,92,246,0.5)',
              background: 'rgba(139,92,246,0.15)',
              color: '#c4b5fd',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              marginLeft: '1rem',
            }}
          >
            ↺ Reset Zoom
          </button>
        )}
      </div>

      {/* Main zoomed chart */}
      <div ref={mainRef} style={{ width:'100%' }} />

      {/* Context / overview with brush */}
      <p style={{ color:'#475569', fontSize:'0.72rem', margin:'4px 0 2px 72px' }}>
        Overview — drag to select range
      </p>
      <div ref={contextRef} style={{ width:'100%' }} />
    </div>
  );
}

export default PriceDistributionChart;
