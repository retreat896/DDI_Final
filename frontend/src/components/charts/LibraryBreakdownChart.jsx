import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { positionTooltip } from '../../utils/tooltip.js';

function LibraryBreakdownChart({ games }) {
  const wrapRef  = useRef();
  const chartRef = useRef();

  useEffect(() => {
    if (!games || games.length === 0) return;

    const buckets = [
      { label: 'Never',    min: 0,     max: 0        },
      { label: '< 1h',     min: 0,     max: 60        },
      { label: '1–10h',    min: 60,    max: 600       },
      { label: '10–100h',  min: 600,   max: 6000      },
      { label: '100–500h', min: 6000,  max: 30000     },
      { label: '500h+',    min: 30000, max: Infinity   },
    ];
    const bucketColors = ['#475569','#3b82f6','#06b6d4','#10b981','#f59e0b','#ef4444'];

    const counts = buckets.map((b, i) => ({
      ...b,
      color: bucketColors[i],
      count: b.label === 'Never'
        ? games.filter(g => g.playtime_forever === 0).length
        : games.filter(g => g.playtime_forever > b.min && g.playtime_forever <= b.max).length,
    }));

    d3.select(chartRef.current).selectAll('*').remove();

    const containerW = wrapRef.current?.getBoundingClientRect().width || 500;
    const isMobile   = containerW < 480;

    const margin = { top: 20, right: 16, bottom: isMobile ? 38 : 46, left: isMobile ? 42 : 52 };
    const width  = Math.max(containerW - margin.left - margin.right, 260);
    const height = (isMobile ? 240 : 280) - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width',  width  + margin.left + margin.right)
      .attr('height', height + margin.top  + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(counts.map(d => d.label)).range([0, width]).padding(0.25);
    const y = d3.scaleLinear().domain([0, d3.max(counts, d => d.count) * 1.18]).nice().range([height, 0]);

    svg.append('g')
      .call(d3.axisLeft(y).ticks(4).tickSize(-width).tickFormat(''))
      .call(g => g.select('.domain').remove())
      .call(g => g.selectAll('.tick line').attr('stroke','rgba(255,255,255,0.07)').attr('stroke-dasharray','3,3'));

    svg.append('g')
      .call(d3.axisLeft(y).ticks(4))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text').style('fill','#94a3b8').style('font-size', isMobile ? '10px' : '11px');

    svg.append('g').attr('transform',`translate(0,${height})`)
      .call(d3.axisBottom(x))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text').style('fill','#94a3b8').style('font-size', isMobile ? '9px' : '11px');

    const tooltip = d3.select('body').select('.d3-library-tooltip');
    const tip = tooltip.empty()
      ? d3.select('body').append('div').attr('class','d3-tooltip d3-library-tooltip').style('opacity',0)
      : tooltip;

    svg.selectAll('.bar').data(counts).enter().append('rect').attr('class','bar')
      .attr('x', d => x(d.label)).attr('width', x.bandwidth())
      .attr('y', height).attr('height', 0)
      .attr('fill', d => d.color).attr('rx', 5)
      .on('mouseover', function(event, d) {
        d3.select(this).attr('opacity', 0.8);
        const pct = ((d.count / games.length) * 100).toFixed(1);
        tip.style('opacity',1).html(`<strong>${d.label}</strong><br/>${d.count} games · ${pct}%`)
          positionTooltip(tip, event);
      })
      .on('mouseout', function() { d3.select(this).attr('opacity',1); tip.style('opacity',0); })
      .transition().duration(700).delay((d,i) => i * 80)
      .attr('y', d => y(d.count)).attr('height', d => height - y(d.count));

    svg.selectAll('.bar-label').data(counts).enter().append('text').attr('class','bar-label')
      .attr('x', d => x(d.label) + x.bandwidth() / 2)
      .attr('y', d => y(d.count) - 4)
      .attr('text-anchor','middle')
      .style('fill','#cbd5e1').style('font-size', isMobile ? '9px' : '11px')
      .style('opacity',0)
      .text(d => d.count > 0 ? d.count : '')
      .transition().duration(500).delay((d,i) => i * 80 + 400).style('opacity',1);

    return () => { d3.select('body').select('.d3-library-tooltip').style('opacity',0); };
  }, [games]);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <p style={{ color:'#64748b', fontSize:'0.8rem', marginTop:0, marginBottom:'0.5rem' }}>
        Distribution of your {games?.length || 0} owned games by total time invested.
      </p>
      <div className="chart-scroll" ref={chartRef} />
    </div>
  );
}

export default LibraryBreakdownChart;
