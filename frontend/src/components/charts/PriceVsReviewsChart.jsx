import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

/** Scatter: game price (x) vs review score % (y), bubble sized by ownership. */
function PriceVsReviewsChart() {
  const chartRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  useEffect(() => {
    axios.get(`${API_BASE}/api/analytics/price-vs-reviews`)
      .then(res => setData(res.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load price vs review data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data.length > 0) draw(data);
  }, [data]);

  function draw(data) {
    if (!data || data.length === 0) return;
    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 60, left: 65 };
    const width = 720 - margin.left - margin.right;
    const height = 360 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const maxPrice = Math.min(d3.max(data, d => +d.price), 70);
    const x = d3.scaleLinear().domain([0, maxPrice]).range([0, width]);
    const y = d3.scaleLinear().domain([0, 100]).range([height, 0]);

    const rScale = d3.scaleSqrt()
      .domain([0, d3.max(data, d => +(d.total_reviews || 0))])
      .range([2, 14]);

    // Grid lines
    svg.selectAll('line.gy').data(y.ticks(5)).enter().append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', 'rgba(255,255,255,0.05)');

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => `$${d}`))
      .selectAll('text').style('fill', '#94a3b8').style('font-size', '11px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d}%`))
      .selectAll('text').style('fill', '#94a3b8');

    svg.append('text')
      .attr('x', width / 2).attr('y', height + 50)
      .attr('text-anchor', 'middle')
      .style('fill', '#64748b').style('font-size', '12px')
      .text('Game Price (USD)');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -55).attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .style('fill', '#64748b').style('font-size', '12px')
      .text('Positive Review %');

    // Soft guide line at 70% (Mostly Positive threshold)
    svg.append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', y(70)).attr('y2', y(70))
      .attr('stroke', 'rgba(16,185,129,0.25)')
      .attr('stroke-dasharray', '5,4');
    svg.append('text')
      .attr('x', width - 4).attr('y', y(70) - 4)
      .attr('text-anchor', 'end')
      .style('fill', 'rgba(16,185,129,0.6)').style('font-size', '10px')
      .text('Mostly Positive');

    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 100]);

    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip').style('opacity', 0);

    svg.selectAll('circle')
      .data(data.filter(d => +d.price <= maxPrice))
      .enter().append('circle')
      .attr('cx', d => x(+d.price))
      .attr('cy', d => y(+d.review_pct))
      .attr('r', d => rScale(+(d.total_reviews || 0)))
      .attr('fill', d => colorScale(+d.review_pct))
      .attr('fill-opacity', 0.65)
      .attr('stroke', 'rgba(255,255,255,0.12)')
      .attr('stroke-width', 1)
      .style('cursor', 'pointer')
      .on('mouseover', function (event, d) {
        d3.select(this).attr('fill-opacity', 1).attr('stroke', '#fff');
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(
          `<strong>${d.name}</strong><br/>` +
          `Price: $${(+d.price).toFixed(2)}<br/>` +
          `Reviews: ${d.review_pct}% positive<br/>` +
          `Total: ${(+d.total_reviews).toLocaleString()}`
        )
          .style('left', (event.pageX + 12) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('fill-opacity', 0.65).attr('stroke', 'rgba(255,255,255,0.12)');
        tooltip.transition().duration(300).style('opacity', 0);
      });

    return () => { d3.select('body').select('.d3-pvr-tooltip').style('opacity', 0); };
  }

  if (loading) return <p style={{ color: '#64748b' }}>Loading price vs reviews data from database…</p>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
        500 randomly sampled games. Bubble size = total review volume. Color: red → green by score. Capped at $70.
      </p>
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default PriceVsReviewsChart;
