import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { positionTooltip } from '../../utils/tooltip.js';

function PlaytimeBarChart({ games, onGameClick }) {
  const wrapRef = useRef();
  const chartRef = useRef();

  useEffect(() => {
    if (!games || games.length === 0) return;

    const data = games
      .filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 15)
      .map(g => ({ appid: g.appid, name: g.name, hours: +(g.playtime_forever / 60).toFixed(1) }));

    if (data.length === 0) return;

    d3.select(chartRef.current).selectAll('*').remove();

    // Responsive: use container width, minimum 400px so the chart scrolls on tiny screens
    const containerW = wrapRef.current?.getBoundingClientRect().width || 600;
    const isMobile   = containerW < 520;

    const margin = { top: 20, right: 20, bottom: isMobile ? 90 : 110, left: isMobile ? 42 : 56 };
    const width  = Math.max(containerW - margin.left - margin.right, 320);
    const height = (isMobile ? 260 : 340) - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width',  width  + margin.left + margin.right)
      .attr('height', height + margin.top  + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient').attr('id', 'pb-grad')
      .attr('x1','0%').attr('y1','0%').attr('x2','0%').attr('y2','100%');
    gradient.append('stop').attr('offset','0%') .attr('stop-color','#3b82f6');
    gradient.append('stop').attr('offset','100%').attr('stop-color','#8b5cf6');

    const x = d3.scaleBand().range([0, width]).domain(data.map(d => d.name)).padding(0.22);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.hours) * 1.1]).range([height, 0]);

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}h`))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text').style('fill','#94a3b8').style('font-size', isMobile ? '10px' : '12px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickSize(-width).tickFormat(''))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke','rgba(255,255,255,0.07)').attr('stroke-dasharray','3,3'));

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text')
        .attr('transform', 'rotate(-40)')
        .style('text-anchor', 'end')
        .style('fill', '#94a3b8')
        .style('font-size', isMobile ? '9px' : '11px');

    const tooltip = d3.select('body').select('.d3-playtime-tooltip');
    const tip = tooltip.empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-playtime-tooltip').style('opacity', 0)
      : tooltip;

    svg.selectAll('.bar')
      .data(data).enter().append('rect').attr('class','bar')
      .attr('x', d => x(d.name)).attr('width', x.bandwidth())
      .attr('y', height).attr('height', 0)
      .attr('fill','url(#pb-grad)').attr('rx', 4)
      .style('cursor', onGameClick ? 'pointer' : 'default')
      .on('click', (event, d) => { if (onGameClick) onGameClick(d.appid); })
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.85);
        tip.style('opacity',1).html(`<strong>${d.name}</strong><br/>${d.hours}h played`);
        positionTooltip(tip, event);
      })
      .on('mousemove', function(event) {
        positionTooltip(tip, event);
      })
      .on('mouseout', function() { d3.select(this).attr('opacity',1); tip.style('opacity',0); })
      .transition().duration(700).delay((d,i) => i * 40)
      .attr('y', d => y(d.hours))
      .attr('height', d => height - y(d.hours));

    return () => { d3.select('body').select('.d3-playtime-tooltip').style('opacity',0); };
  }, [games]);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div className="chart-scroll" ref={chartRef} />
    </div>
  );
}

export default PlaytimeBarChart;
