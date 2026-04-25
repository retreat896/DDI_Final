import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

/**
 * Grouped bar chart: for each publisher tier (Indie / AA / AAA),
 * shows game count, avg review %, and avg owners side-by-side.
 */
function PublisherTierChart() {
  const chartRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  useEffect(() => {
    axios.get(`${API_BASE}/api/analytics/publisher-tiers`)
      .then(res => setData(res.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load publisher tier data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (data.length > 0) draw(data);
  }, [data]);

  function draw(data) {
    if (!data || data.length === 0) return;
    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 30, right: 30, bottom: 50, left: 70 };
    const width = 620 - margin.left - margin.right;
    const height = 320 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const tiers = data.map(d => d.tier);
    const metrics = ['game_count', 'avg_positive_pct', 'avg_owners_k'];

    // Normalize data
    const processed = data.map(d => ({
      tier: d.tier,
      game_count: +d.game_count,
      avg_positive_pct: +(d.avg_positive_pct || 0),
      avg_owners_k: Math.round(+(d.avg_owners || 0) / 1000),
    }));

    const x0 = d3.scaleBand().domain(tiers).range([0, width]).paddingInner(0.3);
    const x1 = d3.scaleBand().domain(metrics).range([0, x0.bandwidth()]).padding(0.08);

    // Each metric has its own y scale for readability
    const yScales = {
      game_count: d3.scaleLinear()
        .domain([0, d3.max(processed, d => d.game_count) * 1.2]).range([height, 0]),
      avg_positive_pct: d3.scaleLinear().domain([0, 100]).range([height, 0]),
      avg_owners_k: d3.scaleLinear()
        .domain([0, d3.max(processed, d => d.avg_owners_k) * 1.2]).range([height, 0]),
    };

    // Use the game_count scale for the left axis (most informative)
    svg.append('g').call(d3.axisLeft(yScales.game_count).ticks(5))
      .selectAll('text').style('fill', '#94a3b8');

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .selectAll('text').style('fill', '#cbd5e1').style('font-size', '13px').style('font-weight', '600');

    const colorMap = {
      game_count: '#3b82f6',
      avg_positive_pct: '#10b981',
      avg_owners_k: '#f59e0b',
    };

    const labelMap = {
      game_count: '# Games',
      avg_positive_pct: 'Avg Review %',
      avg_owners_k: 'Avg Owners (k)',
    };

    const tooltipSelection = d3.select('body').select('.d3-publisher-tooltip');
    const tooltip = tooltipSelection.empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-publisher-tooltip').style('opacity', 0)
      : tooltipSelection;

    processed.forEach(d => {
      const g = svg.append('g').attr('transform', `translate(${x0(d.tier)},0)`);
      metrics.forEach(m => {
        g.append('rect')
          .attr('x', x1(m))
          .attr('y', yScales[m](d[m]))
          .attr('width', x1.bandwidth())
          .attr('height', height - yScales[m](d[m]))
          .attr('fill', colorMap[m])
          .attr('rx', 4)
          .on('mouseover', function (event) {
            d3.select(this).attr('opacity', 0.75);
            tooltip.transition().duration(150).style('opacity', 1);
            const val = m === 'avg_owners_k'
              ? `${d[m].toLocaleString()}k`
              : m === 'avg_positive_pct'
              ? `${d[m]}%`
              : d[m].toLocaleString();
            tooltip.html(`<strong>${d.tier}</strong> – ${labelMap[m]}<br/>${val}`)
              .style('left', (event.pageX + 10) + 'px')
              .style('top', (event.pageY - 28) + 'px');
          })
          .on('mouseout', function () {
            d3.select(this).attr('opacity', 1);
            tooltip.transition().duration(300).style('opacity', 0);
          });

        // Value label
        g.append('text')
          .attr('x', x1(m) + x1.bandwidth() / 2)
          .attr('y', yScales[m](d[m]) - 4)
          .attr('text-anchor', 'middle')
          .style('fill', colorMap[m])
          .style('font-size', '10px')
          .style('font-weight', '600')
          .text(m === 'avg_positive_pct' ? `${d[m]}%` : m === 'avg_owners_k' ? `${d[m]}k` : d[m].toLocaleString());
      });
    });

    // Legend
    const legend = svg.append('g').attr('transform', `translate(0, -22)`);
    Object.entries(labelMap).forEach(([key, label], i) => {
      const g = legend.append('g').attr('transform', `translate(${i * 145}, 0)`);
      g.append('rect').attr('width', 12).attr('height', 12).attr('rx', 3).attr('fill', colorMap[key]);
      g.append('text').attr('x', 16).attr('y', 10)
        .style('fill', '#94a3b8').style('font-size', '11px').text(label);
    });

    return () => { d3.select('body').select('.d3-publisher-tooltip').style('opacity', 0); };
  }

  if (loading) return <div className="skeleton-graph"></div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
        Indie vs. AA vs. AAA comparison: number of titles, average review score, and average estimated ownership.
      </p>
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default PublisherTierChart;
