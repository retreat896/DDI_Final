import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { positionTooltip } from '../../utils/tooltip.js';

function PlaytimeDonutChart({ games }) {
  const wrapRef  = useRef();
  const chartRef = useRef();

  useEffect(() => {
    if (!games || games.length === 0) return;

    const data = games
      .filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 8)
      .map(g => ({ name: g.name, hours: g.playtime_forever / 60 }));

    const others = games
      .filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(8)
      .reduce((acc, g) => acc + g.playtime_forever / 60, 0);
    if (others > 0) data.push({ name: 'Others', hours: others });

    d3.select(chartRef.current).selectAll('*').remove();

    const containerW  = wrapRef.current?.getBoundingClientRect().width || 500;
    const isMobile    = containerW < 480;

    // On mobile: donut takes full width, legend is rendered as HTML below
    // On desktop: side-by-side inside one wide SVG
    const donutSize  = isMobile ? Math.min(containerW - 16, 320) : 340;
    const radius     = donutSize / 2 - 16;
    const innerRadius = radius * 0.55;

    const svgW = isMobile ? donutSize : donutSize + 200;
    const svgH = donutSize;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', svgW).attr('height', svgH)
      .append('g')
      .attr('transform', `translate(${donutSize / 2}, ${donutSize / 2})`);

    const color = d3.scaleOrdinal()
      .domain(data.map(d => d.name))
      .range(['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#84cc16','#64748b']);

    const pie      = d3.pie().value(d => d.hours).sort(null);
    const arc      = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(innerRadius).outerRadius(radius + 8);
    const totalHours = d3.sum(data, d => d.hours);

    const tooltip = d3.select('body').select('.d3-donut-tooltip');
    const tip = tooltip.empty()
      ? d3.select('body').append('div').attr('class','d3-tooltip d3-donut-tooltip').style('opacity',0)
      : tooltip;

    svg.selectAll('path')
      .data(pie(data)).enter().append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name))
      .attr('stroke', 'rgba(15,23,42,0.6)').attr('stroke-width', 2)
      .style('cursor','pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).transition().duration(150).attr('d', arcHover);
        const pct = ((d.data.hours / totalHours) * 100).toFixed(1);
        tip.style('opacity', 1);
        tip.html(`<strong>${d.data.name}</strong><br/>${d.data.hours.toFixed(1)} hrs · ${pct}%`)
          positionTooltip(tip, event);
      })
      .on('mouseout', function() {
        d3.select(this).transition().duration(150).attr('d', arc);
        tip.style('opacity', 0);
      });

    // Center label
    svg.append('text').attr('text-anchor','middle').attr('dy','-0.3em')
      .style('fill','#94a3b8').style('font-size','12px').text('Total');
    svg.append('text').attr('text-anchor','middle').attr('dy','1.1em')
      .style('fill','#f8fafc').style('font-size', isMobile ? '16px' : '18px')
      .style('font-weight','700').text(`${totalHours.toFixed(0)}h`);

    // Desktop legend (inside SVG, to the right)
    if (!isMobile) {
      const legend = d3.select(chartRef.current).select('svg')
        .append('g')
        .attr('transform', `translate(${donutSize + 12}, ${donutSize / 2 - (data.length * 20) / 2})`);
      data.forEach((d, i) => {
        const g = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
        g.append('rect').attr('width',13).attr('height',13).attr('rx',3).attr('fill', color(d.name));
        g.append('text').attr('x',19).attr('y',10.5)
          .style('fill','#cbd5e1').style('font-size','11.5px')
          .text(d.name.length > 20 ? d.name.slice(0,19) + '…' : d.name);
      });
    }

    return () => { d3.select('body').select('.d3-donut-tooltip').style('opacity',0); };
  }, [games]);

  // Mobile: render HTML legend below the SVG
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;
  const legendData = games
    ? games.filter(g => g.playtime_forever > 0)
        .sort((a, b) => b.playtime_forever - a.playtime_forever).slice(0, 9)
    : [];

  const colors = ['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444','#ec4899','#84cc16','#64748b'];

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div className="chart-scroll" ref={chartRef} style={{ display: 'flex', justifyContent: 'center' }} />
      {/* HTML legend — shown on mobile below chart, hidden on desktop (SVG legend handles it) */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem',
        marginTop: '0.75rem', justifyContent: 'center',
        fontSize: '0.78rem', color: '#cbd5e1',
      }} className="donut-html-legend">
        {legendData.map((g, i) => (
          <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: colors[i] || '#64748b', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
              {g.name.length > 18 ? g.name.slice(0, 17) + '…' : g.name}
            </span>
          </div>
        ))}
        {legendData.length >= 9 && <span style={{ color: '#64748b' }}>+ Others</span>}
      </div>
    </div>
  );
}

export default PlaytimeDonutChart;
