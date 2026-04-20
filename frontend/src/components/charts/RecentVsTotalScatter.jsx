import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

/**
 * Scatter plot: recent playtime (last 2 weeks) vs total playtime.
 * Reveals binge games (high recent, low total) vs favorites (high both).
 */
function RecentVsTotalScatter({ games }) {
  const chartRef = useRef();

  useEffect(() => {
    if (!games || games.length === 0) return;

    const data = games
      .filter(g => g.playtime_forever > 0 && g.playtime_2weeks > 0)
      .map(g => ({
        appid: g.appid,
        name: g.name,
        total: g.playtime_forever / 60,
        recent: g.playtime_2weeks / 60,
      }));

    if (data.length === 0) return;

    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 60, left: 70 };
    const width = 720 - margin.left - margin.right;
    const height = 340 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLog()
      .domain([0.1, d3.max(data, d => d.total) * 1.3])
      .range([0, width]);

    const y = d3.scaleLog()
      .domain([0.1, d3.max(data, d => d.recent) * 1.5])
      .range([height, 0]);

    const radiusScale = d3.scaleSqrt()
      .domain([0, d3.max(data, d => d.total)])
      .range([4, 20]);

    // Grid lines
    svg.selectAll('line.grid-y')
      .data(y.ticks(5))
      .enter().append('line')
      .attr('class', 'grid-y')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', 'rgba(255,255,255,0.05)');

    svg.selectAll('line.grid-x')
      .data(x.ticks(5))
      .enter().append('line')
      .attr('class', 'grid-x')
      .attr('x1', d => x(d)).attr('x2', d => x(d))
      .attr('y1', 0).attr('y2', height)
      .attr('stroke', 'rgba(255,255,255,0.05)');

    // Axes
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5, '~s').tickFormat(d => d >= 1 ? `${d.toFixed(0)}h` : ''))
      .selectAll('text').style('fill', 'var(--text-color)');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(4, '~s').tickFormat(d => d >= 1 ? `${d.toFixed(0)}h` : ''))
      .selectAll('text').style('fill', 'var(--text-color)');

    svg.append('text')
      .attr('x', width / 2).attr('y', height + 50)
      .attr('text-anchor', 'middle')
      .style('fill', '#94a3b8').style('font-size', '12px')
      .text('Total Hours Played (log scale)');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -55).attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .style('fill', '#94a3b8').style('font-size', '12px')
      .text('Hours Played (last 2 weeks)');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip').style('opacity', 0);

    // Dots
    const colorGrad = d3.scaleSequential(d3.interpolateCool)
      .domain([0, data.length]);

    data.sort((a, b) => b.total - a.total).forEach((d, i) => {
      svg.append('circle')
        .attr('cx', x(Math.max(d.total, 0.1)))
        .attr('cy', y(Math.max(d.recent, 0.1)))
        .attr('r', radiusScale(d.total))
        .attr('fill', colorGrad(i))
        .attr('fill-opacity', 0.75)
        .attr('stroke', 'rgba(255,255,255,0.2)')
        .attr('stroke-width', 1)
        .style('cursor', 'pointer')
        .on('mouseover', function (event) {
          d3.select(this).attr('fill-opacity', 1).attr('stroke', '#fff');
          tooltip.transition().duration(200).style('opacity', 1);
          tooltip.html(`<strong>${d.name}</strong><br/>Total: ${d.total.toFixed(1)}h<br/>Recent: ${d.recent.toFixed(1)}h`)
            .style('left', (event.pageX + 12) + 'px')
            .style('top', (event.pageY - 28) + 'px');
        })
        .on('mouseout', function () {
          d3.select(this).attr('fill-opacity', 0.75).attr('stroke', 'rgba(255,255,255,0.2)');
          tooltip.transition().duration(300).style('opacity', 0);
        });
    });

    return () => { d3.selectAll('.d3-tooltip').remove(); };
  }, [games]);

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.5rem' }}>
        Only games with recent activity are shown. Bubble size = total hours.
      </p>
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default RecentVsTotalScatter;
