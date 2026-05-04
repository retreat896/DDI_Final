import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { positionTooltip } from '../../utils/tooltip.js';

function PlaytimeDonutChart({ games }) {
  const wrapRef  = useRef();
  const chartRef = useRef();
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (!games || games.length === 0) return;

    const sortedGames = games.filter(g => g.playtime_forever > 0).sort((a, b) => b.playtime_forever - a.playtime_forever);

    const ITEMS_PER_PAGE = 15;
    const startIndex = depth * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;

    const data = sortedGames.slice(startIndex, endIndex).map(g => ({ name: g.name, hours: g.playtime_forever / 60 }));

    const others = sortedGames.slice(endIndex).reduce((acc, g) => acc + g.playtime_forever / 60, 0);
    if (others > 0) data.push({ name: 'Others', hours: others });

    if (data.length === 0 && depth > 0) {
      setDepth(0);
      return;
    }

    const containerW  = wrapRef.current?.getBoundingClientRect().width || 500;
    const isMobile    = containerW < 480;

    const donutSize  = isMobile ? Math.min(containerW - 16, 320) : 340;
    const radius     = donutSize / 2 - 16;
    const innerRadius = radius * 0.55;

    const legendTextMaxLength = isMobile ? 0 : d3.max(data, d => d.name.length) || 0;
    const legendWidth = isMobile ? 0 : Math.max(200, legendTextMaxLength * 7 + 20);

    const svgW = isMobile ? donutSize : donutSize + legendWidth;
    const svgH = donutSize;

    let svg = d3.select(chartRef.current).select('svg');
    let g = svg.select('g.donut-group');

    if (svg.empty()) {
      svg = d3.select(chartRef.current)
        .append('svg');
      g = svg.append('g').attr('class', 'donut-group');
      
      g.append('text').attr('class', 'center-label-top')
        .attr('text-anchor','middle').attr('dy','-0.3em')
        .style('fill','#94a3b8').style('font-size','12px');
      g.append('text').attr('class', 'center-label-bottom')
        .attr('text-anchor','middle').attr('dy','1.1em')
        .style('fill','#f8fafc');
    }

    svg.attr('width', svgW).attr('height', svgH);
    g.attr('transform', `translate(${donutSize / 2}, ${donutSize / 2})`);

    const standardColors = [
      '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', 
      '#ec4899', '#84cc16', '#6366f1', '#14b8a6', '#a855f7', '#f43f5e', 
      '#f97316', '#eab308', '#22c55e'
    ];
    const getColor = (d, i) => d.data.name === 'Others' ? '#64748b' : standardColors[i % standardColors.length];

    const pie = d3.pie().value(d => d.hours).sort(null);
    const arc = d3.arc().innerRadius(innerRadius).outerRadius(radius);
    const arcHover = d3.arc().innerRadius(innerRadius).outerRadius(radius + 8);
    
    const currentTotalHours = d3.sum(data, d => d.hours);

    const tooltip = d3.select('body').select('.d3-donut-tooltip');
    const tip = tooltip.empty()
      ? d3.select('body').append('div').attr('class','d3-tooltip d3-donut-tooltip').style('opacity',0)
      : tooltip;

    const pieData = pie(data);

    const paths = g.selectAll('path.slice').data(pieData, d => d.data.name);

    paths.enter()
      .append('path')
      .attr('class', 'slice')
      .attr('fill', getColor)
      .attr('stroke', 'rgba(15,23,42,0.6)').attr('stroke-width', 2)
      .each(function(d) { 
         this._current = { startAngle: d.startAngle, endAngle: d.startAngle, value: 0 }; 
      })
      .merge(paths)
      .style('cursor', d => d.data.name === 'Others' ? 'pointer' : 'default')
      .on('click', function(event, d) {
        if (d.data.name === 'Others') {
           setDepth(prev => prev + 1);
           tip.style('opacity', 0);
        }
      })
      .on('mouseover', function(event, d) {
        d3.select(this).transition().duration(150).attr('d', arcHover);
        const pct = ((d.data.hours / currentTotalHours) * 100).toFixed(1);
        tip.style('opacity', 1);
        tip.html(`<strong>${d.data.name}</strong><br/>${d.data.hours.toFixed(1)} hrs · ${pct}%${d.data.name === 'Others' ? '<br/><span style="color:#fbbf24;font-size:0.8rem">Click to expand</span>' : ''}`);
        positionTooltip(tip, event);
      })
      .on('mouseout', function() {
        d3.select(this).transition().duration(150).attr('d', arc);
        tip.style('opacity', 0);
      })
      .transition().duration(750)
      .attr('fill', getColor)
      .attrTween('d', function(d) {
        const i = d3.interpolate(this._current, d);
        this._current = i(1);
        return t => arc(i(t));
      });

    paths.exit()
      .transition().duration(750)
      .attrTween('d', function(d) {
        const i = d3.interpolate(this._current, { startAngle: d.startAngle, endAngle: d.startAngle, value: 0 });
        return t => arc(i(t));
      })
      .remove();

    g.select('.center-label-top').text(depth > 0 ? `Level ${depth + 1}` : 'Total');
    g.select('.center-label-bottom')
      .style('font-size', isMobile ? '16px' : '18px')
      .text(`${currentTotalHours.toFixed(0)}h`);

    // Desktop legend
    let legendGroup = svg.select('g.legend-group');
    if (!isMobile) {
      if (legendGroup.empty()) {
        legendGroup = svg.append('g').attr('class', 'legend-group');
      }
      legendGroup.attr('transform', `translate(${donutSize + 12}, ${donutSize / 2 - (data.length * 20) / 2})`);
      
      const lgItems = legendGroup.selectAll('g.legend-item').data(data, d => d.name);
      
      const lgEnter = lgItems.enter().append('g').attr('class', 'legend-item')
        .attr('transform', (d, i) => `translate(0, ${i * 22})`);
        
      lgEnter.append('rect').attr('width',13).attr('height',13).attr('rx',3);
      lgEnter.append('text').attr('x',19).attr('y',10.5).style('fill','#cbd5e1').style('font-size','11.5px');
      
      const lgMerge = lgEnter.merge(lgItems);
      lgMerge.order().transition().duration(750).attr('transform', (d, i) => `translate(0, ${i * 22})`);
      lgMerge.select('rect').attr('fill', (d, i) => d.name === 'Others' ? '#64748b' : standardColors[i % standardColors.length]);
      lgMerge.select('text').text(d => d.name);
      
      lgItems.exit().remove();
    } else {
      legendGroup.remove();
    }

    return () => { d3.select('body').select('.d3-donut-tooltip').style('opacity',0); };
  }, [games, depth]);

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 480;
  
  const sortedGames = games ? games.filter(g => g.playtime_forever > 0).sort((a, b) => b.playtime_forever - a.playtime_forever) : [];
  const ITEMS_PER_PAGE = 15;
  const startIndex = depth * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const legendData = sortedGames.slice(startIndex, endIndex);
  const others = sortedGames.slice(endIndex).reduce((acc, g) => acc + g.playtime_forever / 60, 0);
  
  const standardColors = [
    '#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', 
    '#ec4899', '#84cc16', '#6366f1', '#14b8a6', '#a855f7', '#f43f5e', 
    '#f97316', '#eab308', '#22c55e'
  ];

  return (
    <div ref={wrapRef} style={{ width: '100%', position: 'relative' }}>
      {depth > 0 && (
        <button 
          onClick={() => setDepth(prev => Math.max(0, prev - 1))}
          style={{
            position: 'absolute', top: 0, left: 0, zIndex: 10,
            padding: '4px 12px', fontSize: '0.8rem', borderRadius: '4px',
            background: 'rgba(59,130,246,0.15)', color: '#93c5fd', border: '1px solid rgba(59,130,246,0.3)',
            cursor: 'pointer'
          }}>
          ← Back
        </button>
      )}
      <div className="chart-scroll" ref={chartRef} style={{ display: 'flex', justifyContent: 'center', marginTop: depth > 0 ? '1.5rem' : '0' }} />
      {/* HTML legend — shown on mobile below chart */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: '0.4rem 1rem',
        marginTop: '0.75rem', justifyContent: 'center',
        fontSize: '0.78rem', color: '#cbd5e1',
      }} className="donut-html-legend">
        {legendData.map((g, i) => (
          <div key={g.name} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: standardColors[i % standardColors.length], display: 'inline-block', flexShrink: 0 }} />
            <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
              {g.name.length > 18 ? g.name.slice(0, 17) + '…' : g.name}
            </span>
          </div>
        ))}
        {others > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: 11, height: 11, borderRadius: 3, background: '#64748b', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ color: '#94a3b8' }}>Others</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default PlaytimeDonutChart;
