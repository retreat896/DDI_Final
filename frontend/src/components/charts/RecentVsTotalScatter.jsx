import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { positionTooltip } from '../../utils/tooltip.js';

function RecentVsTotalScatter({ games }) {
  const wrapRef  = useRef();
  const chartRef = useRef();

  useEffect(() => {
    if (!games || games.length === 0) return;

    const data = games
      .filter(g => g.playtime_forever > 0 && g.playtime_2weeks > 0)
      .map(g => ({ appid: g.appid, name: g.name, total: g.playtime_forever / 60, recent: g.playtime_2weeks / 60 }));

    if (data.length === 0) return;
    d3.select(chartRef.current).selectAll('*').remove();

    const containerW = wrapRef.current?.getBoundingClientRect().width || 560;
    const isMobile   = containerW < 480;

    const margin = { top: 20, right: 20, bottom: isMobile ? 50 : 60, left: isMobile ? 52 : 68 };
    const width  = Math.max(containerW - margin.left - margin.right, 280);
    const height = (isMobile ? 280 : 340) - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width',  width  + margin.left + margin.right)
      .attr('height', height + margin.top  + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLog().domain([0.1, d3.max(data, d => d.total) * 1.3]).range([0, width]);
    const y = d3.scaleLog().domain([0.1, d3.max(data, d => d.recent) * 1.5]).range([height, 0]);
    const rScale = d3.scaleSqrt().domain([0, d3.max(data, d => d.total)]).range([isMobile ? 3 : 4, isMobile ? 14 : 20]);

    // Grid
    svg.selectAll('line.gy').data(y.ticks(4)).enter().append('line').attr('class','gy')
      .attr('x1',0).attr('x2',width).attr('y1',d=>y(d)).attr('y2',d=>y(d))
      .attr('stroke','rgba(255,255,255,0.05)');
    svg.selectAll('line.gx').data(x.ticks(4)).enter().append('line').attr('class','gx')
      .attr('x1',d=>x(d)).attr('x2',d=>x(d)).attr('y1',0).attr('y2',height)
      .attr('stroke','rgba(255,255,255,0.05)');

    svg.append('g').attr('transform',`translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(isMobile ? 3 : 5,'~s').tickFormat(d => d >= 1 ? `${d.toFixed(0)}h` : ''))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text').style('fill','#94a3b8').style('font-size', isMobile ? '10px' : '11px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(isMobile ? 3 : 4,'~s').tickFormat(d => d >= 1 ? `${d.toFixed(0)}h` : ''))
      .call(g => g.select('.domain').attr('stroke','rgba(255,255,255,0.15)'))
      .call(g => g.selectAll('.tick line').remove())
      .selectAll('text').style('fill','#94a3b8').style('font-size', isMobile ? '10px' : '11px');

    svg.append('text').attr('x',width/2).attr('y',height+(isMobile?42:50))
      .attr('text-anchor','middle').style('fill','#64748b').style('font-size', isMobile ? '10px' : '12px')
      .text('Total Hours (log scale)');
    svg.append('text').attr('transform','rotate(-90)').attr('y',-(isMobile?44:58)).attr('x',-height/2)
      .attr('text-anchor','middle').style('fill','#64748b').style('font-size', isMobile ? '10px' : '12px')
      .text('Hours (last 2 weeks)');

    const tooltip = d3.select('body').select('.d3-scatter-tooltip');
    const tip = tooltip.empty()
      ? d3.select('body').append('div').attr('class','d3-tooltip d3-scatter-tooltip').style('opacity',0)
      : tooltip;

    const colorGrad = d3.scaleSequential(d3.interpolateCool).domain([0, data.length]);
    data.sort((a, b) => b.total - a.total).forEach((d, i) => {
      svg.append('circle')
        .attr('cx', x(Math.max(d.total, 0.1))).attr('cy', y(Math.max(d.recent, 0.1)))
        .attr('r', rScale(d.total)).attr('fill', colorGrad(i)).attr('fill-opacity', 0.75)
        .attr('stroke','rgba(255,255,255,0.2)').attr('stroke-width',1).style('cursor','pointer')
        .on('mouseover', function(event) {
          d3.select(this).attr('fill-opacity',1).attr('stroke','#fff');
          tip.style('opacity',1).html(`<strong>${d.name}</strong><br/>Total: ${d.total.toFixed(1)}h<br/>Recent: ${d.recent.toFixed(1)}h`)
            positionTooltip(tip, event);
        })
        .on('mouseout', function() {
          d3.select(this).attr('fill-opacity',0.75).attr('stroke','rgba(255,255,255,0.2)');
          tip.style('opacity',0);
        });
    });

    return () => { d3.select('body').select('.d3-scatter-tooltip').style('opacity',0); };
  }, [games]);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <p style={{ color:'#64748b', fontSize:'0.8rem', marginTop:0, marginBottom:'0.5rem' }}>
        Only games with recent activity are shown. Bubble size = total hours.
      </p>
      <div className="chart-scroll" ref={chartRef} />
    </div>
  );
}

export default RecentVsTotalScatter;
