import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import axios from 'axios';

/**
 * Line/Area chart: Steam Games Released By Year
 */
function ReleaseYearChart() {
  const chartRef = useRef();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState([]);
  const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

  useEffect(() => {
    axios.get(`${API_BASE}/api/analytics/releases-by-year`)
      .then(res => {
        // filter out invalid years if any, and make sure it's sorted
        const validData = res.data.filter(d => parseInt(d.year) >= 2000 && parseInt(d.year) <= new Date().getFullYear());
        setData(validData);
      })
      .catch(e => setError(e.response?.data?.error || 'Failed to load release year data.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    let cleanup;
    if (data.length > 0) {
      cleanup = draw(data);
    }
    return () => { if (cleanup) cleanup(); };
  }, [data]);

  function draw(data) {
    if (!data || data.length === 0) return;
    d3.select(chartRef.current).selectAll('*').remove();

    const margin = { top: 20, right: 30, bottom: 40, left: 60 };
    const width = 760 - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
      .domain(d3.extent(data, d => parseInt(d.year)))
      .range([0, width]);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => parseInt(d.count)) * 1.1])
      .range([height, 0]);

    // X Axis
    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).tickFormat(d3.format('d')).ticks(10))
      .selectAll('text').style('fill', '#94a3b8');

    // Y Axis
    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => d >= 1000 ? `${(d/1000).toFixed(1)}k` : d))
      .selectAll('text').style('fill', '#94a3b8');

    // Gradient definition for the area
    const defs = svg.append("defs");
    const gradient = defs.append("linearGradient")
      .attr("id", "area-gradient")
      .attr("x1", "0%").attr("y1", "0%")
      .attr("x2", "0%").attr("y2", "100%");
    
    gradient.append("stop").attr("offset", "0%").attr("stop-color", "rgba(59,130,246,0.6)");
    gradient.append("stop").attr("offset", "100%").attr("stop-color", "rgba(59,130,246,0.0)");

    // Area Generator
    const area = d3.area()
      .x(d => x(parseInt(d.year)))
      .y0(height)
      .y1(d => y(parseInt(d.count)))
      .curve(d3.curveMonotoneX);

    // Line Generator
    const line = d3.line()
      .x(d => x(parseInt(d.year)))
      .y(d => y(parseInt(d.count)))
      .curve(d3.curveMonotoneX);

    // Add Area
    svg.append("path")
      .datum(data)
      .attr("fill", "url(#area-gradient)")
      .attr("d", area)
      .attr("opacity", 0)
      .transition().duration(1000).attr("opacity", 1);

    // Add Line
    const path = svg.append("path")
      .datum(data)
      .attr("fill", "none")
      .attr("stroke", "#3b82f6")
      .attr("stroke-width", 3)
      .attr("d", line);
      
    const totalLength = path.node().getTotalLength();

    path
      .attr("stroke-dasharray", totalLength + " " + totalLength)
      .attr("stroke-dashoffset", totalLength)
      .transition()
      .duration(1500)
      .ease(d3.easeCubicOut)
      .attr("stroke-dashoffset", 0);

    // Tooltip
    const tooltipSelection = d3.select('body').select('.d3-release-tooltip');
    const tooltip = tooltipSelection.empty()
      ? d3.select('body').append('div').attr('class', 'd3-tooltip d3-release-tooltip').style('opacity', 0)
      : tooltipSelection;

    // Dots
    svg.selectAll(".dot")
      .data(data)
      .enter().append("circle")
      .attr("class", "dot")
      .attr("cx", d => x(parseInt(d.year)))
      .attr("cy", d => y(parseInt(d.count)))
      .attr("r", 4)
      .attr("fill", "#0f172a")
      .attr("stroke", "#60a5fa")
      .attr("stroke-width", 2)
      .attr("opacity", 0)
      .on('mouseover', function (event, d) {
        d3.select(this).attr('r', 6).attr('fill', '#60a5fa');
        tooltip.transition().duration(150).style('opacity', 1);
        tooltip.html(`<strong>${d.year}</strong><br/>${parseInt(d.count).toLocaleString()} games`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', function () {
        d3.select(this).attr('r', 4).attr('fill', '#0f172a');
        tooltip.transition().duration(300).style('opacity', 0);
      })
      .transition().duration(800).delay((d, i) => i * 50)
      .attr("opacity", 1);

    return () => { d3.select('body').select('.d3-release-tooltip').style('opacity', 0); };
  }

  if (loading) return <div className="skeleton-graph" style={{ height: '300px' }}></div>;
  if (error) return <p style={{ color: '#ef4444' }}>{error}</p>;

  return (
    <div>
      <p style={{ color: '#64748b', fontSize: '0.8rem', marginTop: 0, marginBottom: '0.75rem' }}>
        The explosion of game releases on Steam since 2000.
      </p>
      <div ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center' }} />
    </div>
  );
}

export default ReleaseYearChart;
