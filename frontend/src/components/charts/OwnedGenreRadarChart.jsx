import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';
import { positionTooltip } from '../../utils/tooltip.js';

function OwnedGenreRadarChart({ games }) {
  const chartRef = useRef();
  const wrapRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  useEffect(() => {
    if (!games || games.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    const appIds = [...new Set(games.map(g => Number(g.appid)).filter(Boolean))];
    if (appIds.length === 0) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    axios.post(`${API_BASE}/api/analytics/owned-genres`, { appids: appIds })
      .then(res => setData(res.data))
      .catch(e => setError(e.response?.data?.error || 'Failed to load owned genres.'))
      .finally(() => setLoading(false));
  }, [games]);

  useEffect(() => {
    if (data.length > 0) draw(data);
  }, [data]);

  function draw(data) {
    if (!data || data.length === 0) return;
    d3.select(chartRef.current).selectAll('*').remove();

    const containerW = wrapRef.current?.getBoundingClientRect().width || 600;
    const width = Math.max(containerW, 340);
    const height = 420;
    const margin = { top: 40, right: 40, bottom: 40, left: 40 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;
    const radius = Math.min(chartWidth, chartHeight) / 2 - 50;
    const centerX = chartWidth / 2 + margin.left;
    const centerY = chartHeight / 2 + margin.top;
    const categories = data.slice(0, 8);
    const axisCount = categories.length;
    const maxValue = d3.max(categories, d => +d.count) || 1;
    const angleSlice = (Math.PI * 2) / axisCount;
    const radialScale = d3.scaleLinear().domain([0, maxValue]).range([0, radius]);

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    const wrapper = svg.append('g');

    // Concentric grid
    const levels = 4;
    for (let level = 1; level <= levels; level += 1) {
      const levelFactor = radius * (level / levels);
      wrapper.append('circle')
        .attr('cx', centerX)
        .attr('cy', centerY)
        .attr('r', levelFactor)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(203,213,225,0.18)')
        .attr('stroke-dasharray', '4,4');

      wrapper.append('text')
        .attr('x', centerX)
        .attr('y', centerY - levelFactor - 6)
        .attr('text-anchor', 'middle')
        .style('fill', '#94a3b8')
        .style('font-size', '10px')
        .text(Math.round(maxValue * (level / levels)).toLocaleString());
    }

    // Axes and labels
    const axis = wrapper.selectAll('.axis').data(categories).enter().append('g').attr('class', 'axis');
    axis.append('line')
      .attr('x1', centerX)
      .attr('y1', centerY)
      .attr('x2', (d, i) => centerX + Math.cos(angleSlice * i - Math.PI / 2) * radius)
      .attr('y2', (d, i) => centerY + Math.sin(angleSlice * i - Math.PI / 2) * radius)
      .attr('stroke', 'rgba(203,213,225,0.25)');

    axis.append('text')
      .attr('x', (d, i) => centerX + Math.cos(angleSlice * i - Math.PI / 2) * (radius + 18))
      .attr('y', (d, i) => centerY + Math.sin(angleSlice * i - Math.PI / 2) * (radius + 18))
      .attr('dy', '0.35em')
      .attr('text-anchor', d => {
        const angle = angleSlice * categories.indexOf(d) - Math.PI / 2;
        return Math.abs(Math.cos(angle)) < 0.1 ? 'middle' : (Math.cos(angle) > 0 ? 'start' : 'end');
      })
      .style('fill', '#cbd5e1')
      .style('font-size', '11px')
      .style('font-weight', 600)
      .text(d => d.genre)
      .call(text => text.each(function(d, i) {
        const self = d3.select(this);
        const angle = angleSlice * i - Math.PI / 2;
        if (Math.sin(angle) > 0.1) self.attr('dy', '1.1em');
      }));

    const radarLine = d3.lineRadial()
      .radius(d => radialScale(d.count))
      .angle((d, i) => i * angleSlice)
      .curve(d3.curveLinearClosed);

    const tooltipSelection = d3.select('body').select('.d3-owned-genres-tooltip');
    const tooltip = tooltipSelection.empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-owned-genres-tooltip').style('opacity', 0)
      : tooltipSelection;

    const radarGroup = wrapper.append('g');
    const radarData = categories.map((d, i) => ({ ...d, angle: i * angleSlice }));

    radarGroup.append('path')
      .datum(radarData)
      .attr('d', radarLine)
      .attr('transform', `translate(${centerX},${centerY})`)
      .attr('fill', 'rgba(59,130,246,0.25)')
      .attr('stroke', '#3b82f6')
      .attr('stroke-width', 2);

    radarGroup.selectAll('.radar-point')
      .data(radarData)
      .enter().append('circle')
      .attr('class', 'radar-point')
      .attr('cx', d => centerX + Math.cos(d.angle - Math.PI / 2) * radialScale(d.count))
      .attr('cy', d => centerY + Math.sin(d.angle - Math.PI / 2) * radialScale(d.count))
      .attr('r', 5)
      .attr('fill', '#3b82f6')
      .attr('stroke', '#fff')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this).attr('r', 7);
        tooltip.style('opacity', 1)
          .html(`<strong>${d.genre}</strong><br/>${d.count.toLocaleString()} games`);
        positionTooltip(tooltip, event);
      })
      .on('mousemove', function(event, d) {
        positionTooltip(tooltip, event);
      })
      .on('mouseout', function() {
        d3.select(this).attr('r', 5);
        tooltip.style('opacity', 0);
      });

    return () => { d3.select('body').select('.d3-owned-genres-tooltip').style('opacity', 0); };
  }

  if (!games || games.length === 0) {
    return <p style={{ color: '#94a3b8' }}>Sign in with Steam to see your owned genres radar chart.</p>;
  }

  if (loading) return <div className="skeleton-graph"></div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;
  if (!data || data.length === 0) {
    return <p style={{ color: '#94a3b8' }}>No genre mapping available for your owned apps.</p>;
  }

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
        A radar chart showing your top owned genres, mapped from the Steam dataset metadata.
      </p>
      <div ref={chartRef} style={{ overflow: 'hidden' }} />
    </div>
  );
}

export default OwnedGenreRadarChart;
