import { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { positionTooltip } from '../../utils/tooltip.js';

/**
 * Side-by-side grouped bar chart comparing top 10 games of two Steam profiles.
 */
function CompareProfilesChart({ myGames, myName, theirGames, theirName }) {
  const chartRef = useRef();
  const wrapRef  = useRef();
  const [comparisonStats, setComparisonStats] = useState(null);

  useEffect(() => {
    if (!myGames || myGames.length === 0 || !theirGames || theirGames.length === 0) {
      setComparisonStats(null);
      return;
    }

    // Calculate comparison stats
    const myStats = {
      totalPlaytime: myGames.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) / 60, // hours
      recentPlaytime: myGames.reduce((sum, g) => sum + (g.playtime_2weeks || 0), 0) / 60, // hours
      totalGames: myGames.length,
      avgTimePerGame: myGames.length > 0 ? myGames.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) / myGames.length / 60 : 0 // hours
    };

    const theirStats = {
      totalPlaytime: theirGames.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) / 60,
      recentPlaytime: theirGames.reduce((sum, g) => sum + (g.playtime_2weeks || 0), 0) / 60,
      totalGames: theirGames.length,
      avgTimePerGame: theirGames.length > 0 ? theirGames.reduce((sum, g) => sum + (g.playtime_forever || 0), 0) / theirGames.length / 60 : 0
    };

    setComparisonStats({ myStats, theirStats });

    // Build a union of top 10 games from each player
    const myTop = myGames
      .filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 10);

    const theirTop = theirGames
      .filter(g => g.playtime_forever > 0)
      .sort((a, b) => b.playtime_forever - a.playtime_forever)
      .slice(0, 10);

    // Union of game names (prefer their appids for lookup)
    const allNames = [...new Set([...myTop.map(g => g.name), ...theirTop.map(g => g.name)])];

    const getHours = (gamesList, name) => {
      const g = gamesList.find(x => x.name === name);
      return g ? g.playtime_forever / 60 : 0;
    };

    const data = allNames.slice(0, 12).map(name => ({
      name,
      me: getHours(myGames, name),
      them: getHours(theirGames, name),
    }));

    d3.select(chartRef.current).selectAll('*').remove();

    // Calculate dynamic bottom margin based on longest game name when rotated
    const tempSvg = d3.select(chartRef.current).append('svg').attr('width', 0).attr('height', 0);
    const tempText = tempSvg.append('text').style('font-size', '11px');
    const maxNameWidth = d3.max(data, d => {
      tempText.text(d.name);
      return tempText.node().getComputedTextLength();
    });
    tempSvg.remove();

    // Approximate height needed for rotated text (rotated -40 degrees, so height is width * sin(40) + some padding)
    const rotatedHeight = maxNameWidth * Math.sin(40 * Math.PI / 180) + 30; // add more padding for translation
    const dynamicBottomMargin = Math.max(130, rotatedHeight);

    const margin = { top: 20, right: 20, bottom: dynamicBottomMargin, left: 65 };
    const containerW = wrapRef.current?.getBoundingClientRect().width || 820;
    const width = Math.max(containerW - margin.left - margin.right, 320);
    const height = 360 - margin.top - margin.bottom;

    const svg = d3.select(chartRef.current)
      .append('svg')
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const x0 = d3.scaleBand()
      .domain(data.map(d => d.name))
      .range([0, width])
      .paddingInner(0.25);

    const x1 = d3.scaleBand()
      .domain(['me', 'them'])
      .range([0, x0.bandwidth()])
      .padding(0.1);

    const y = d3.scaleLinear()
      .domain([0, d3.max(data, d => Math.max(d.me, d.them)) * 1.15])
      .range([height, 0]);

    svg.append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x0))
      .selectAll('text')
      .attr('transform', 'translate(-10,0)rotate(-40)')
      .style('text-anchor', 'end')
      .style('fill', 'var(--text-color)')
      .style('font-size', '11px');

    svg.append('g')
      .call(d3.axisLeft(y).ticks(5).tickFormat(d => `${d.toFixed(0)}h`))
      .selectAll('text')
      .style('fill', 'var(--text-color)');

    svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -55).attr('x', -height / 2)
      .attr('text-anchor', 'middle')
      .style('fill', '#94a3b8').style('font-size', '12px')
      .text('Hours Played');

    const tooltip = d3.select('body').append('div')
      .attr('class', 'd3-tooltip').style('opacity', 0);

    const colorMap = { me: '#3b82f6', them: '#f59e0b' };

    const groups = svg.selectAll('g.group')
      .data(data)
      .enter()
      .append('g')
      .attr('transform', d => `translate(${x0(d.name)},0)`);

    ['me', 'them'].forEach(key => {
      groups.append('rect')
        .attr('x', x1(key))
        .attr('y', d => y(d[key]))
        .attr('width', x1.bandwidth())
        .attr('height', d => height - y(d[key]))
        .attr('fill', colorMap[key])
        .attr('rx', 3)
        .on('mouseover', function (event, d) {
          d3.select(this).attr('opacity', 0.75);
          const who = key === 'me' ? myName || 'You' : theirName;
          tooltip.style('opacity', 1);
          tooltip.html(`<strong>${d.name}</strong><br/>${who}: ${d[key].toFixed(1)}h`)
            positionTooltip(tooltip, event);
        })
        .on('mouseout', function () {
          d3.select(this).attr('opacity', 1);
          tooltip.style('opacity', 0);
        });
    });

    // Legend
    const legend = svg.append('g').attr('transform', `translate(${width - 160}, -5)`);
    [{ key: 'me', label: myName || 'You' }, { key: 'them', label: theirName }].forEach(({ key, label }, i) => {
      const g = legend.append('g').attr('transform', `translate(${i * 85}, 0)`);
      g.append('rect').attr('width', 12).attr('height', 12).attr('rx', 3).attr('fill', colorMap[key]);
      g.append('text').attr('x', 16).attr('y', 10)
        .style('fill', '#cbd5e1').style('font-size', '11px')
        .text(label.length > 10 ? label.slice(0, 9) + '…' : label);
    });

    return () => { d3.select('body').select('.d3-compare-tooltip').style('opacity', 0); };
  }, [myGames, theirGames, myName, theirName]);

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div>
      {!theirGames && (
        <div style={{ textAlign: 'center', padding: '2rem', color: '#475569', fontSize: '0.9rem' }}>
          Add a profile in the header to begin comparison
        </div>
      )}
      <div className="chart-scroll" ref={chartRef} style={{ overflowX: 'auto', display: 'flex', justifyContent: 'center', marginBottom: '2rem' }} />

      {theirGames && myGames && comparisonStats && (
        <div style={{ marginTop: '2rem' }}>
          <h4 style={{ color: '#f8fafc', marginBottom: '1.5rem', fontSize: '1.1rem' }}>Overall Statistics Comparison</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            {/* Total Playtime */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem',
              backdropFilter: 'blur(12px)'
            }}>
              <h5 style={{ color: '#94a3b8', margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 500 }}>Total Playtime</h5>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#3b82f6', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {comparisonStats.myStats.totalPlaytime.toFixed(0)}h
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{myName || 'You'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {comparisonStats.theirStats.totalPlaytime.toFixed(0)}h
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{theirName}</div>
                </div>
              </div>
            </div>

            {/* Recent Playtime */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem',
              backdropFilter: 'blur(12px)'
            }}>
              <h5 style={{ color: '#94a3b8', margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 500 }}>Recent Playtime (2 weeks)</h5>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#3b82f6', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {comparisonStats.myStats.recentPlaytime.toFixed(1)}h
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{myName || 'You'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {comparisonStats.theirStats.recentPlaytime.toFixed(1)}h
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{theirName}</div>
                </div>
              </div>
            </div>

            {/* Total Games Owned */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem',
              backdropFilter: 'blur(12px)'
            }}>
              <h5 style={{ color: '#94a3b8', margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 500 }}>Games Owned</h5>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#3b82f6', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {comparisonStats.myStats.totalGames}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{myName || 'You'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {comparisonStats.theirStats.totalGames}
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{theirName}</div>
                </div>
              </div>
            </div>

            {/* Average Time Per Game */}
            <div style={{
              background: 'rgba(30, 41, 59, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '12px',
              padding: '1.5rem',
              backdropFilter: 'blur(12px)'
            }}>
              <h5 style={{ color: '#94a3b8', margin: '0 0 1rem 0', fontSize: '0.9rem', fontWeight: 500 }}>Avg. Time Per Game</h5>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ color: '#3b82f6', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {comparisonStats.myStats.avgTimePerGame.toFixed(1)}h
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{myName || 'You'}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ color: '#f59e0b', fontSize: '1.5rem', fontWeight: 'bold' }}>
                    {comparisonStats.theirStats.avgTimePerGame.toFixed(1)}h
                  </div>
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>{theirName}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}

export default CompareProfilesChart;
