import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

function PlaytimeBarChart({ games, onGameClick }) {
  const chartRef = useRef();
  
  useEffect(() => {
    if (!games || games.length === 0) return;
    
    // Process data: filter out 0 playtime, sort by playtime, take top 15
    const data = games
      .filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 15)
      .map(g => ({
        appid: g.appid,
        name: g.name,
        hours: (g.playtime_forever / 60).toFixed(1)
      }));

    if (data.length === 0) return;

    // Clear old svg
    d3.select(chartRef.current).selectAll('*').remove();

    // Setup dimensions
    const margin = { top: 30, right: 30, bottom: 120, left: 60 };
    const width = 800 - margin.left - margin.right;
    const height = 400 - margin.top - margin.bottom;

    // Create SVG
    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    // X axis
    const x = d3.scaleBand()
      .range([0, width])
      .domain(data.map(d => d.name))
      .padding(0.2);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-45)')
      .style('text-anchor', 'end')
      .style('fill', 'var(--text-color)')
      .style('font-size', '12px');

    // Y axis
    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => +d.hours)])
      .range([height, 0]);

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5))
      .selectAll('text')
      .style('fill', 'var(--text-color)');

    // Y axis label
    svg.append('text')
      .attr('text-anchor', 'end')
      .attr('transform', 'rotate(-90)')
      .attr('y', -45)
      .attr('x', -height / 2 + 50)
      .style('fill', 'var(--text-color)')
      .text('Hours Played');

    // Tooltip
    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip')
      .style('opacity', 0);

    // Bars
    svg.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', d => x(d.name))
      .attr('y', d => y(d.hours))
      .attr('width', x.bandwidth())
      .attr('height', d => height - y(d.hours))
      .attr('fill', 'url(#barGradient)')
      .attr('rx', 4)
      .style('cursor', onGameClick ? 'pointer' : 'default')
      .on('click', (event, d) => {
        if (onGameClick) onGameClick(d.appid);
      })
      .on('mouseover', (event, d) => {
        d3.select(event.currentTarget).attr('fill', '#60a5fa');
        tooltip.transition().duration(200).style('opacity', 1);
        tooltip.html(`<strong>${d.name}</strong><br/>${d.hours} Hours`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', (event) => {
        d3.select(event.currentTarget).attr('fill', 'url(#barGradient)');
        tooltip.transition().duration(500).style('opacity', 0);
      });

    // Defining gradients
    const defs = svg.append('defs');
    const gradient = defs.append('linearGradient')
      .attr('id', 'barGradient')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    
    gradient.append('stop')
      .attr('offset', '0%')
      .attr('stop-color', '#3b82f6');
    
    gradient.append('stop')
      .attr('offset', '100%')
      .attr('stop-color', '#8b5cf6');

    return () => {
      d3.selectAll('.d3-tooltip').remove();
    };
  }, [games]);

  return <div ref={chartRef} style={{ width: '100%', overflowX: 'auto', display: 'flex', justifyContent: 'center' }}></div>;
}

export default PlaytimeBarChart;
