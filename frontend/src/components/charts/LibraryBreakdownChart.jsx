import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

/**
 * Library Breakdown: Shows count of games in each playtime bucket.
 * Buckets: Never Played, < 1h, 1–10h, 10–100h, 100–500h, 500h+
 */
function LibraryBreakdownChart({ games }) {
  const chartRef = useRef();

  useEffect(() => {
    if (!games || games.length === 0) return;

    const buckets = [
      { label: 'Never Played', min: 0, max: 0 },
      { label: '< 1h',         min: 0,  max: 60 },
      { label: '1–10h',        min: 60, max: 600 },
      { label: '10–100h',      min: 600, max: 6000 },
      { label: '100–500h',     min: 6000, max: 30000 },
      { label: '500h+',        min: 30000, max: Infinity },
    ];

    const counts = buckets.map(b => {
      let count;
      if (b.label === 'Never Played') {
        count = games.filter(g => g.playtime_forever === 0).length;
      } else {
        count = games.filter(g => g.playtime_forever > b.min && g.playtime_forever <= b.max).length;
      }
      return { ...b, count };
    });

    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 50, left: 55 };
    const width = 680 - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
      .domain(counts.map(d => d.label))
      .range([0, width])
      .padding(0.25);

    const y = d3.scaleLinear()
      .domain([0, d3.max(counts, d => d.count) * 1.15])
      .range([height, 0]);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .style('fill', 'var(--text-color)')
      .style('font-size', '11px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .selectAll('text')
      .style('fill', 'var(--text-color)');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45).attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .style('fill', '#94a3b8').style('font-size', '12px')
      .text('# of Games');

    const bucketColors = [
      '#475569', '#3b82f6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'
    ];

    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip').style('opacity', 0);

    svg.selectAll('rect')
      .data(counts)
      .enter()
      .append('rect')
      .attr('x', d => x(d.label))
      .attr('y', d => y(d.count))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.count))
      .attr('fill', (d, i) => bucketColors[i])
      .attr('rx', 5)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        tooltip.transition().duration(200).style('opacity', 1);
        const pct = ((d.count / games.length) * 100).toFixed(1);
        tooltip.html(`<strong>${d.label}</strong><br/>${d.count} games · ${pct}%`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        tooltip.transition().duration(300).style('opacity', 0);
      });

    // Value labels on bars
    svg.selectAll('.bar-label')
      .data(counts)
      .enter()
      .append('text')
      .attr('class', 'bar-label')
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', d => y(d.count) - 5)
      .attr('text-anchor', 'middle')
      .style('fill', '#cbd5e1')
      .style('font-size', '11px')
      .text(d => d.count > 0 ? d.count : '');

    return () => { d3.select('body').select('.d3-library-tooltip').style('opacity', 0); };
  }, [games]);

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.5rem' }}>
        Distribution of your {games?.length || 0} owned games by total time invested.
      </p>
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default LibraryBreakdownChart;
