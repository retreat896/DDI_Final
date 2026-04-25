import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

/**
 * Bar chart showing proportions of Free, Early Access, and Controller Supported games.
 */
function GameFeaturesChart() {
  const chartRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  useEffect(() => {
    axios.get(`${API_BASE}/api/analytics/game-features`)
      .then(res => {
        setData(res.data);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load game features.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cleanup;
    if (data && data.total_games > 0) {
      cleanup = draw(data);
    }
    return () => { if (cleanup) cleanup(); };
  }, [data]);

  function draw(rawData) {
    if (!rawData) return;
    d3.select(chartRef.current).selectAll('*').remove();

    const chartData = [
      { id: 'achievements', label: 'Has Achievements',    count: rawData.has_achievements,           color: '#3b82f6' },
      { id: 'controller',   label: 'Controller Support',  count: rawData.controller_support_games,   color: '#f43f5e' },
      { id: 'multilingual', label: 'Multilingual (10+)',  count: rawData.multilingual,               color: '#10b981' },
      { id: 'free',         label: 'Free to Play',        count: rawData.free_games,                 color: '#8b5cf6' },
      { id: 'early_access', label: 'Early Access',        count: rawData.early_access_games,         color: '#f59e0b' },
      { id: 'dlc',          label: 'Has DLC',             count: rawData.has_dlc,                    color: '#14b8a6' },
      { id: 'age',          label: 'Age Restricted (18+)',count: rawData.age_restricted,             color: '#ef4444' },
    ].sort((a, b) => b.count - a.count);

    const total = rawData.total_games;

    const margin = { top: 20, right: 60, bottom: 40, left: 165 };
    const width = 680 - margin.left - margin.right;
    const height = 340 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const y = d3.scaleBand()
      .domain(chartData.map(d => d.label))
      .range([0, height])
      .padding(0.3);

    const x = d3.scaleLinear()
      .domain([0, 100])
      .range([0, width]);

    // Y Axis
    svg.append('g')
      .call(d3.axisLeft(y).tickSize(0))
      .select('.domain').remove();
      
    svg.selectAll('.tick text')
      .style('fill', '#cbd5e1')
      .style('font-size', '13px')
      .style('font-weight', '500')
      .attr('dx', '-8px');

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d => d + '%'))
      .selectAll('text').style('fill', '#94a3b8');

    // Grid lines
    svg.append('g')
      .attr('class', 'grid')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(5).tickSize(-height).tickFormat(''))
      .call(g => g.select('.domain').attr('stroke', 'rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').attr('stroke', 'rgba(255,255,255,0.06)'));

    const tooltipSelection = d3.select('body').select('.d3-features-tooltip');
    const tooltip = tooltipSelection.empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-features-tooltip').style('opacity', 0)
      : tooltipSelection;

    // Background track bars
    svg.selectAll('.track')
      .data(chartData)
      .enter().append('rect')
      .attr('class', 'track')
      .attr('y', d => y(d.label))
      .attr('x', 0)
      .attr('height', y.bandwidth())
      .attr('width', width)
      .attr('fill', 'rgba(15, 23, 42, 0.4)')
      .attr('rx', 6);

    // Value bars
    svg.selectAll('.bar')
      .data(chartData)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('y', d => y(d.label))
      .attr('x', 0)
      .attr('height', y.bandwidth())
      .attr('width', 0)
      .attr('fill', d => d.color)
      .attr('rx', 6)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('opacity', 0.85);
        tooltip.transition().duration(150).style('opacity', 1);
        const pct = ((d.count / total) * 100).toFixed(1);
        tooltip.html(`<strong>${d.label}</strong><br/>${d.count.toLocaleString()} games (${pct}%)`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('opacity', 1);
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .transition().duration(800).delay((d, i) => i * 100)
      .attr('width', d => x((d.count / total) * 100));

    // Value labels
    svg.selectAll('.label')
      .data(chartData)
      .enter().append('text')
      .attr('class', 'label')
      .attr('y', d => y(d.label) + y.bandwidth() / 2 + 5)
      .attr('x', -20)
      .style('fill', '#fff')
      .style('font-size', '12px')
      .style('font-weight', '600')
      .style('opacity', 0)
      .text(d => `${((d.count / total) * 100).toFixed(1)}%`)
      .transition().duration(800).delay((d, i) => i * 100 + 400)
      .style('opacity', 1)
      .attr('x', d => x((d.count / total) * 100) + 8);

    return () => { d3.select('body').select('.d3-features-tooltip').style('opacity', 0); };
  }

  if (loading) return <div className="skeleton-graph" style={{ height: '380px' }}></div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
        Percentage of all Steam games with each feature — sorted by prevalence.
      </p>
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default GameFeaturesChart;
