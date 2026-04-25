import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

/** Horizontal bar chart of top genres by game count from the DB. */
function GenreBreakdownChart() {
  const chartRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  useEffect(() => {
    axios.get(`${API_BASE}/api/analytics/genres`)
      .then(res => setData(res.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load genre data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data.length > 0) draw(data);
  }, [data]);

  function draw(data) {
    if (!data || data.length === 0) return;
    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 10, right: 120, bottom: 20, left: 130 };
    const width = 680 - margin.left - margin.right;
    const height = Math.max(data.length * 30, 200);

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand()
      .domain(data.map(d => d.genre))
      .range([0, height])
      .padding(0.22);

    const x = d3.scaleLinear()
      .domain([0, d3.max(data, d => +d.count) * 1.1])
      .range([0, width]);

    svg.append('g').call(d3.axisLeft(y))
      .selectAll('text').style('fill', '#cbd5e1').style('font-size', '12px');

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5))
      .selectAll('text').style('fill', '#94a3b8');

    const colorScale = d3.scaleSequential(d3.interpolateCool).domain([0, data.length]);

    const tooltipSelection = d3.select('body').select('.d3-genre-tooltip');
    const tooltip = tooltipSelection.empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-genre-tooltip').style('opacity', 0)
      : tooltipSelection;

    svg.selectAll('rect')
      .data(data)
      .enter().append('rect')
      .attr('y', d => y(d.genre))
      .attr('x', 0)
      .attr('height', y.bandwidth())
      .attr('width', 0)
      .attr('fill', (d, i) => colorScale(i))
      .attr('rx', 4)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.8);
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(`<strong>${d.genre}</strong><br/>${(+d.count).toLocaleString()} games`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .transition().duration(600).delay((d, i) => i * 30)
      .attr('width', d => x(+d.count));

    // Count labels
    svg.selectAll('.count-label')
      .data(data)
      .enter().append('text')
      .attr('class', 'count-label')
      .attr('y', d => y(d.genre) + y.bandwidth() / 2 + 4)
      .attr('x', d => x(+d.count) + 6)
      .style('fill', '#94a3b8')
      .style('font-size', '11px')
      .text(d => (+d.count).toLocaleString());

    return () => { d3.selectAll('.d3-tooltip').remove(); };
  }

  if (loading) return <div className="skeleton-graph"></div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
        Game count per primary genre across all titles in the dataset.
      </p>
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default GenreBreakdownChart;
