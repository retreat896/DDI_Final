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

    // Calculate dynamic bottom margin based on longest game name when rotated
    const tempSvg = d3.select(chartRef.current).append('svg').attr('width', 0).attr('height', 0);
    const tempText = tempSvg.append('text').style('font-size', isMobile ? '9px' : '11px');
    const maxNameWidth = d3.max(data, d => {
      tempText.text(d.name);
      return tempText.node().getComputedTextLength();
    });
    tempSvg.remove();

    // Approximate height needed for rotated text (rotated -40 degrees, so height is width * sin(40) + some padding)
    const rotatedHeight = maxNameWidth * Math.sin(40 * Math.PI / 180) + 20;
    const dynamicBottomMargin = Math.max(isMobile ? 90 : 110, rotatedHeight);

    const margin = { top: 20, right: 20, bottom: dynamicBottomMargin, left: isMobile ? 42 : 56 };
    const width  = Math.max(containerW - margin.left - margin.right, 320);
    const height = (isMobile ? 260 : 340) - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width',  width  + margin.left + margin.right)
      .attr('height', height + margin.top  + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const defs = svg.append('defs');
    const colors = [
      ['#60a5fa', '#3b82f6'], ['#a78bfa', '#8b5cf6'], ['#f472b6', '#ec4899'],
      ['#fb7185', '#f43f5e'], ['#fb923c', '#f97316'], ['#fbbf24', '#f59e0b'],
      ['#facc15', '#eab308'], ['#a3e635', '#84cc16'], ['#4ade80', '#22c55e'],
      ['#34d399', '#10b981'], ['#2dd4bf', '#14b8a6'], ['#22d3ee', '#06b6d4'],
      ['#38bdf8', '#0ea5e9'], ['#818cf8', '#6366f1'], ['#e879f9', '#d946ef']
    ];
    colors.forEach((c, i) => {
      const grad = defs.append('linearGradient').attr('id', `pb-grad-${i}`)
        .attr('x1','0%').attr('y1','0%').attr('x2','0%').attr('y2','100%');
      grad.append('stop').attr('offset','0%').attr('stop-color', c[0]);
      grad.append('stop').attr('offset','100%').attr('stop-color', c[1]);
    });

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
      .attr('fill', (d, i) => `url(#pb-grad-${i % colors.length})`).attr('rx', 4)
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
