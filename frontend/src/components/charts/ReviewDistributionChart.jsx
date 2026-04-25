import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

/** Histogram of overall review score distribution (0–100%) from steam_games DB table. */
function ReviewDistributionChart() {
  const chartRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  useEffect(() => {
    axios.get(`${API_BASE}/api/analytics/review-distribution`)
      .then(res => setData(res.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load review distribution.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data.length > 0) draw(data);
  }, [data]);

  function draw(data) {
    if (!data || data.length === 0) return;
    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 50, left: 60 };
    const width = 680 - margin.left - margin.right;
    const height = 280 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, 100]).range([0, width]);
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => +d.count) * 1.15])
      .range([height, 0]);

    const bandWidth = (width / 20) - 2; // 20 bins across 0-100

    // Color scale: red (low) -> yellow (mid) -> green (high reviews)
    const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([0, 100]);

    // Grid
    svg.selectAll('line.grid-y')
      .data(y.ticks(5))
      .enter().append('line')
      .attr('x1', 0).attr('x2', width)
      .attr('y1', d => y(d)).attr('y2', d => y(d))
      .attr('stroke', 'rgba(255,255,255,0.05)');

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d => `${d}%`))
      .selectAll('text').style('fill', '#94a3b8').style('font-size', '11px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(0)}k` : d))
      .selectAll('text').style('fill', '#94a3b8');

    svg.append('text')
      .attr('x', width / 2).attr('y', height + 42)
      .attr('text-anchor', 'middle')
      .style('fill', '#64748b').style('font-size', '12px')
      .text('Overall Review Score (%)');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -50).attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .style('fill', '#64748b').style('font-size', '12px')
      .text('Number of Games');

    const tooltipSelection = d3.select('body').select('.d3-review-tooltip');
    const tooltip = tooltipSelection.empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-review-tooltip').style('opacity', 0)
      : tooltipSelection;

    svg.selectAll('rect')
      .data(data)
      .enter().append('rect')
      .attr('x', d => x(+d.bucket))
      .attr('y', height)
      .attr('width', bandWidth)
      .attr('height', 0)
      .attr('fill', d => colorScale(+d.bucket))
      .attr('rx', 3)
      .attr('opacity', 0.88)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 1).attr('stroke', '#fff').attr('stroke-width', 1);
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(`<strong>${d.bucket}–${+d.bucket + 5}%</strong><br/>${(+d.count).toLocaleString()} games`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 0.88).attr('stroke', 'none');
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .transition().duration(700).delay((d, i) => i * 20)
      .attr('y', d => y(+d.count))
      .attr('height', d => height - y(+d.count));

    return () => { d3.selectAll('.d3-tooltip').remove(); };
  }

  if (loading) return <div className="skeleton-graph"></div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
        Distribution of all Steam games by their overall positive review percentage. Color goes red → green with score.
      </p>
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default ReviewDistributionChart;
