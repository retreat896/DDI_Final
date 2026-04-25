import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

function PlaytimeDonutChart({ games }) {
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

    const width = 620;
    const height = 340;
    const radius = Math.min(width * 0.42, height / 2) - 16;
    const innerRadius = radius * 0.55;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${Math.round(width * 0.32)}, ${height / 2})`);

    const color = d3.scaleOrdinal()
      .domain(data.map(d => d.name))
      .range([
        '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981',
        '#f59e0b', '#ef4444', '#ec4899', '#84cc16', '#64748b'
      ]);

    const pie = d3.pie().value(d => d.hours).sort(null);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(innerRadius).outerRadius(radius + 8);

    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip')
      .style('opacity', 0);

    const totalHours = d3.sum(data, d => d.hours);

    const slices = svg.selectAll('path')
      .data(pie(data))
      .enter()
      .append('path')
      .attr('d', arc)
      .attr('fill', d => color(d.data.name))
      .attr('stroke', 'rgba(15,23,42,0.6)')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).transition().duration(150).attr('d', arcHover);
        const pct = ((d.data.hours / totalHours) * 100).toFixed(1);
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`<strong>${d.data.name}</strong><br/>${d.data.hours.toFixed(1)} hrs · ${pct}%`)
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).transition().duration(150).attr('d', arc);
        tooltip.transition().duration(300).style('opacity', 0);
      });

    // Center label
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.3em')
      .style('fill', '#94a3b8')
      .style('font-size', '12px')
      .text('Total');
    svg.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.1em')
      .style('fill', '#f8fafc')
      .style('font-size', '18px')
      .style('font-weight', '700')
      .text(`${totalHours.toFixed(0)}h`);

    // Legend — fixed to the right third of the SVG, clear of all arcs
    const legendX = Math.round(width * 0.32) + radius + 24;
    const legend = d3.select(chartRef.current).select('svg')
      .append('g')
      .attr('transform', `translate(${legendX}, ${height / 2 - (data.length * 20) / 2})`);

    data.forEach((d, i) => {
      const g = legend.append('g').attr('transform', `translate(0, ${i * 22})`);
      g.append('rect').attr('width', 13).attr('height', 13).attr('rx', 3)
        .attr('fill', color(d.name));
      g.append('text')
        .attr('x', 20).attr('y', 10.5)
        .style('fill', '#cbd5e1')
        .style('font-size', '11.5px')
        .text(d.name.length > 20 ? d.name.slice(0, 19) + '…' : d.name);
    });

    return () => {
      d3.select('body').select('.d3-donut-tooltip').style('opacity', 0);
    };
  }, [games]);

  return <div ref={chartRef} style={{ display: 'flex', justifyContent: 'center' }} />;
}

export default PlaytimeDonutChart;
