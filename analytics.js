/**
 * PAC Analytics Dashboard
 * D3.js-powered charts for probability analysis
 * 
 * Charts:
 * 1. Probability Curves - Cumulative probability over refreshes with confidence bands
 * 2. Gold ROI Analysis - Expected value and diminishing returns
 * 3. Tornado Chart - Sensitivity analysis showing factor impacts
 */

(function() {
    'use strict';
    
    // Chart color palette
    const colors = {
        primary: '#38bdf8',      // Cyan
        secondary: '#22d3ee',    // Lighter cyan
        tertiary: '#a78bfa',     // Purple
        positive: '#4ade80',     // Green
        negative: '#f87171',     // Red
        warning: '#fbbf24',      // Yellow
        grid: '#1e293b',
        axis: '#334155',
        text: '#94a3b8',
        background: 'rgba(15, 23, 42, 0.95)'
    };
    
    // Confidence thresholds
    const thresholds = [
        { value: 50, color: 'rgba(56, 189, 248, 0.1)', label: '50%' },
        { value: 75, color: 'rgba(56, 189, 248, 0.15)', label: '75%' },
        { value: 90, color: 'rgba(56, 189, 248, 0.2)', label: '90%' }
    ];
    
    // Tooltip element
    let tooltip = null;
    
    function createTooltip() {
        if (tooltip) return tooltip;
        
        tooltip = d3.select('body')
            .append('div')
            .attr('class', 'chart-tooltip')
            .style('position', 'absolute')
            .style('background', colors.background)
            .style('border', `1px solid ${colors.primary}`)
            .style('border-radius', '8px')
            .style('padding', '10px 14px')
            .style('font-size', '12px')
            .style('color', 'white')
            .style('pointer-events', 'none')
            .style('z-index', '1000')
            .style('opacity', 0)
            .style('box-shadow', '0 4px 20px rgba(0, 0, 0, 0.5)');
        
        return tooltip;
    }
    
    function showTooltip(html, event) {
        const tip = createTooltip();
        tip.html(html)
            .style('left', (event.pageX + 15) + 'px')
            .style('top', (event.pageY - 10) + 'px')
            .style('opacity', 1);
    }
    
    function hideTooltip() {
        if (tooltip) {
            tooltip.style('opacity', 0);
        }
    }
    
    /**
     * Probability Curves Chart
     * Shows cumulative probability over refreshes with confidence bands
     */
    function renderProbabilityCurves(containerId) {
        const container = d3.select(`#${containerId}`);
        if (container.empty()) {
            console.warn(`Container #${containerId} not found`);
            return;
        }
        
        container.html(''); // Clear loading state
        
        const state = window.calculatorState;
        if (!state || !state.probabilities || state.probabilities.perRefresh === 0) {
            container.html(`
                <div class="no-data">
                    <div class="no-data-icon">📊</div>
                    <div>Configure calculator to see probability curves</div>
                </div>
            `);
            return;
        }
        
        // Get data - 50 refreshes for better detail
        const data = window.analyticsUtils.getProbabilityCurve(50);
        const levelData = window.analyticsUtils.getLevelComparison();
        
        // Dimensions - ensure minimum size
        const margin = { top: 20, right: 30, bottom: 50, left: 60 };
        const containerWidth = container.node().clientWidth || 500;
        const containerHeight = container.node().clientHeight || 350;
        const width = Math.max(containerWidth - margin.left - margin.right, 200);
        const height = Math.max(containerHeight - margin.top - margin.bottom, 150);
        
        // Create SVG
        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Scales - 0 to 50 refreshes
        const xScale = d3.scaleLinear()
            .domain([0, 50])
            .range([0, width]);
        
        const yScale = d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0]);
        
        // Grid lines
        svg.append('g')
            .attr('class', 'grid')
            .selectAll('line')
            .data([25, 50, 75, 100])
            .enter()
            .append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => yScale(d))
            .attr('y2', d => yScale(d))
            .attr('stroke', colors.grid)
            .attr('stroke-dasharray', '3,3');
        
        // Confidence threshold bands
        thresholds.forEach(threshold => {
            const thresholdRefresh = data.find(d => d.probability >= threshold.value);
            if (thresholdRefresh) {
                svg.append('rect')
                    .attr('x', 0)
                    .attr('y', yScale(threshold.value))
                    .attr('width', xScale(thresholdRefresh.refreshes))
                    .attr('height', height - yScale(threshold.value))
                    .attr('fill', threshold.color);
                
                // Threshold line
                svg.append('line')
                    .attr('x1', 0)
                    .attr('x2', xScale(thresholdRefresh.refreshes))
                    .attr('y1', yScale(threshold.value))
                    .attr('y2', yScale(threshold.value))
                    .attr('stroke', colors.primary)
                    .attr('stroke-dasharray', '5,5')
                    .attr('opacity', 0.5);
                
                // Vertical line at threshold
                svg.append('line')
                    .attr('x1', xScale(thresholdRefresh.refreshes))
                    .attr('x2', xScale(thresholdRefresh.refreshes))
                    .attr('y1', yScale(threshold.value))
                    .attr('y2', height)
                    .attr('stroke', colors.primary)
                    .attr('stroke-dasharray', '5,5')
                    .attr('opacity', 0.5);
                
                // Label
                svg.append('text')
                    .attr('x', xScale(thresholdRefresh.refreshes) + 5)
                    .attr('y', yScale(threshold.value) - 5)
                    .attr('fill', colors.primary)
                    .attr('font-size', '10px')
                    .text(`${threshold.label} @ ${thresholdRefresh.refreshes}r`);
            }
        });
        
        // Line generator
        const line = d3.line()
            .x(d => xScale(d.refreshes))
            .y(d => yScale(d.probability))
            .curve(d3.curveMonotoneX);
        
        // Area under curve
        const area = d3.area()
            .x(d => xScale(d.refreshes))
            .y0(height)
            .y1(d => yScale(d.probability))
            .curve(d3.curveMonotoneX);
        
        svg.append('path')
            .datum(data)
            .attr('fill', 'url(#areaGradient)')
            .attr('d', area);
        
        // Gradient definition
        const gradient = svg.append('defs')
            .append('linearGradient')
            .attr('id', 'areaGradient')
            .attr('x1', '0%')
            .attr('y1', '0%')
            .attr('x2', '0%')
            .attr('y2', '100%');
        
        gradient.append('stop')
            .attr('offset', '0%')
            .attr('stop-color', colors.primary)
            .attr('stop-opacity', 0.3);
        
        gradient.append('stop')
            .attr('offset', '100%')
            .attr('stop-color', colors.primary)
            .attr('stop-opacity', 0);
        
        // Main probability line
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', colors.primary)
            .attr('stroke-width', 3)
            .attr('d', line);
        
        // Next level comparison line (if applicable)
        if (state.level < 9) {
            const nextLevelProb = levelData[state.level]?.perRefresh / 100 || 0;
            const nextLevelData = [];
            for (let r = 1; r <= 50; r++) {
                nextLevelData.push({
                    refreshes: r,
                    probability: (1 - Math.pow(1 - nextLevelProb, r)) * 100
                });
            }
            
            svg.append('path')
                .datum(nextLevelData)
                .attr('fill', 'none')
                .attr('stroke', colors.tertiary)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '5,5')
                .attr('d', line);
        }
        
        // Axes
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).ticks(10).tickValues([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50]))
            .append('text')
            .attr('x', width / 2)
            .attr('y', 40)
            .attr('fill', colors.text)
            .attr('text-anchor', 'middle')
            .text('Refreshes');
        
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale).ticks(5).tickFormat(d => d + '%'))
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -45)
            .attr('fill', colors.text)
            .attr('text-anchor', 'middle')
            .text('Cumulative Probability');
        
        // Interactive overlay
        const focus = svg.append('g').style('display', 'none');
        
        focus.append('circle')
            .attr('r', 6)
            .attr('fill', colors.primary)
            .attr('stroke', 'white')
            .attr('stroke-width', 2);
        
        focus.append('line')
            .attr('class', 'focus-line-x')
            .attr('stroke', colors.primary)
            .attr('stroke-dasharray', '3,3')
            .attr('opacity', 0.5);
        
        focus.append('line')
            .attr('class', 'focus-line-y')
            .attr('stroke', colors.primary)
            .attr('stroke-dasharray', '3,3')
            .attr('opacity', 0.5);
        
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('mouseover', () => focus.style('display', null))
            .on('mouseout', () => {
                focus.style('display', 'none');
                hideTooltip();
            })
            .on('mousemove', function(event) {
                const [mx] = d3.pointer(event);
                const refreshes = Math.round(xScale.invert(mx));
                const dataPoint = data.find(d => d.refreshes === refreshes);
                
                if (dataPoint) {
                    focus.attr('transform', `translate(${xScale(refreshes)},${yScale(dataPoint.probability)})`);
                    focus.select('.focus-line-x')
                        .attr('x1', 0)
                        .attr('x2', -xScale(refreshes))
                        .attr('y1', 0)
                        .attr('y2', 0);
                    focus.select('.focus-line-y')
                        .attr('x1', 0)
                        .attr('x2', 0)
                        .attr('y1', 0)
                        .attr('y2', height - yScale(dataPoint.probability));
                    
                    showTooltip(`
                        <div style="font-weight: bold; color: ${colors.primary}; margin-bottom: 5px;">
                            ${refreshes} Refreshes (${refreshes * 2}g)
                        </div>
                        <div>Probability: <strong>${dataPoint.probability.toFixed(1)}%</strong></div>
                        <div>Expected copies: <strong>${dataPoint.expectedCopies.toFixed(2)}</strong></div>
                    `, event);
                }
            });
        
        // Legend
        const legend = container.append('div')
            .attr('class', 'chart-legend');
        
        legend.append('div')
            .attr('class', 'legend-item')
            .html(`<div class="legend-color" style="background: ${colors.primary}"></div><span>Current Level (${state.level})</span>`);
        
        if (state.level < 9) {
            legend.append('div')
                .attr('class', 'legend-item')
                .html(`<div class="legend-color" style="background: ${colors.tertiary}"></div><span>Level ${state.level + 1}</span>`);
        }
    }
    
    /**
     * Gold ROI Chart
     * Shows expected value curve with efficiency markers
     */
    function renderGoldROI(containerId) {
        const container = d3.select(`#${containerId}`);
        if (container.empty()) {
            console.warn(`Container #${containerId} not found`);
            return;
        }
        
        container.html('');
        
        const state = window.calculatorState;
        if (!state || !state.probabilities || state.probabilities.perRefresh === 0) {
            container.html(`
                <div class="no-data">
                    <div class="no-data-icon">💰</div>
                    <div>Configure calculator to see gold analysis</div>
                </div>
            `);
            return;
        }
        
        // Get data - 100 gold for better detail
        const data = window.analyticsUtils.getGoldROI(100);
        
        // Dimensions - ensure minimum size
        const margin = { top: 20, right: 60, bottom: 50, left: 60 };
        const containerWidth = container.node().clientWidth || 500;
        const containerHeight = container.node().clientHeight || 350;
        const width = Math.max(containerWidth - margin.left - margin.right, 200);
        const height = Math.max(containerHeight - margin.top - margin.bottom, 150);
        
        // Create SVG
        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Scales - 0 to 100 gold
        const xScale = d3.scaleLinear()
            .domain([0, 100])
            .range([0, width]);
        
        const yScaleProb = d3.scaleLinear()
            .domain([0, 100])
            .range([height, 0]);
        
        const yScaleCopies = d3.scaleLinear()
            .domain([0, d3.max(data, d => d.expectedCopies) * 1.1])
            .range([height, 0]);
        
        // Grid
        svg.append('g')
            .attr('class', 'grid')
            .selectAll('line')
            .data([25, 50, 75, 100])
            .enter()
            .append('line')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', d => yScaleProb(d))
            .attr('y2', d => yScaleProb(d))
            .attr('stroke', colors.grid)
            .attr('stroke-dasharray', '3,3');
        
        // Mark key thresholds
        const thresholdMarkers = [
            { prob: 50, label: '50%' },
            { prob: 75, label: '75%' },
            { prob: 90, label: '90%' }
        ];
        
        thresholdMarkers.forEach(marker => {
            const point = data.find(d => d.probability >= marker.prob);
            if (point) {
                svg.append('circle')
                    .attr('cx', xScale(point.gold))
                    .attr('cy', yScaleProb(point.probability))
                    .attr('r', 8)
                    .attr('fill', colors.warning)
                    .attr('stroke', 'white')
                    .attr('stroke-width', 2);
                
                svg.append('text')
                    .attr('x', xScale(point.gold))
                    .attr('y', yScaleProb(point.probability) - 15)
                    .attr('text-anchor', 'middle')
                    .attr('fill', colors.warning)
                    .attr('font-size', '11px')
                    .attr('font-weight', 'bold')
                    .text(`${point.gold}g`);
            }
        });
        
        // Line generators
        const probLine = d3.line()
            .x(d => xScale(d.gold))
            .y(d => yScaleProb(d.probability))
            .curve(d3.curveMonotoneX);
        
        const copiesLine = d3.line()
            .x(d => xScale(d.gold))
            .y(d => yScaleCopies(d.expectedCopies))
            .curve(d3.curveMonotoneX);
        
        // Probability line
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', colors.primary)
            .attr('stroke-width', 3)
            .attr('d', probLine);
        
        // Expected copies line
        svg.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', colors.positive)
            .attr('stroke-width', 2)
            .attr('stroke-dasharray', '5,5')
            .attr('d', copiesLine);
        
        // Target copies line
        if (state.probabilities.copiesStillNeeded > 0) {
            svg.append('line')
                .attr('x1', 0)
                .attr('x2', width)
                .attr('y1', yScaleCopies(state.probabilities.copiesStillNeeded))
                .attr('y2', yScaleCopies(state.probabilities.copiesStillNeeded))
                .attr('stroke', colors.negative)
                .attr('stroke-width', 2)
                .attr('stroke-dasharray', '8,4');
            
            svg.append('text')
                .attr('x', width - 5)
                .attr('y', yScaleCopies(state.probabilities.copiesStillNeeded) - 5)
                .attr('text-anchor', 'end')
                .attr('fill', colors.negative)
                .attr('font-size', '10px')
                .text(`Need: ${state.probabilities.copiesStillNeeded} copies`);
        }
        
        // Left axis (Probability)
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScaleProb).ticks(5).tickFormat(d => d + '%'))
            .append('text')
            .attr('transform', 'rotate(-90)')
            .attr('x', -height / 2)
            .attr('y', -45)
            .attr('fill', colors.primary)
            .attr('text-anchor', 'middle')
            .text('Probability');
        
        // Right axis (Copies)
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(${width},0)`)
            .call(d3.axisRight(yScaleCopies).ticks(5).tickFormat(d => d.toFixed(1)))
            .append('text')
            .attr('transform', 'rotate(90)')
            .attr('x', height / 2)
            .attr('y', -45)
            .attr('fill', colors.positive)
            .attr('text-anchor', 'middle')
            .text('Expected Copies');
        
        // Bottom axis
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).tickValues([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]).tickFormat(d => d + 'g'))
            .append('text')
            .attr('x', width / 2)
            .attr('y', 40)
            .attr('fill', colors.text)
            .attr('text-anchor', 'middle')
            .text('Gold Invested');
        
        // Interactive overlay
        const bisect = d3.bisector(d => d.gold).left;
        
        const focus = svg.append('g').style('display', 'none');
        
        focus.append('line')
            .attr('class', 'focus-line')
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', 'white')
            .attr('stroke-dasharray', '3,3')
            .attr('opacity', 0.5);
        
        svg.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('mouseover', () => focus.style('display', null))
            .on('mouseout', () => {
                focus.style('display', 'none');
                hideTooltip();
            })
            .on('mousemove', function(event) {
                const [mx] = d3.pointer(event);
                const gold = xScale.invert(mx);
                const i = bisect(data, gold, 1);
                const d = data[i - 1] || data[i];
                
                if (d) {
                    focus.attr('transform', `translate(${xScale(d.gold)},0)`);
                    
                    showTooltip(`
                        <div style="font-weight: bold; color: ${colors.warning}; margin-bottom: 5px;">
                            ${d.gold}g (${d.refreshes} refreshes)
                        </div>
                        <div style="color: ${colors.primary}">Hit chance: <strong>${d.probability.toFixed(1)}%</strong></div>
                        <div style="color: ${colors.positive}">Expected copies: <strong>${d.expectedCopies.toFixed(2)}</strong></div>
                        <div style="color: ${colors.text}">Efficiency: <strong>${(d.efficiency * 100).toFixed(3)}</strong> per gold</div>
                    `, event);
                }
            });
        
        // Legend
        const legend = container.append('div')
            .attr('class', 'chart-legend');
        
        legend.append('div')
            .attr('class', 'legend-item')
            .html(`<div class="legend-color" style="background: ${colors.primary}"></div><span>Hit Probability</span>`);
        
        legend.append('div')
            .attr('class', 'legend-item')
            .html(`<div class="legend-color" style="background: ${colors.positive}"></div><span>Expected Copies</span>`);
        
        legend.append('div')
            .attr('class', 'legend-item')
            .html(`<div class="legend-color" style="background: ${colors.warning}; border-radius: 50%"></div><span>Key Thresholds</span>`);
    }
    
    /**
     * Tornado Chart
     * Sensitivity analysis showing factor impacts
     */
    function renderTornadoChart(containerId) {
        const container = d3.select(`#${containerId}`);
        if (container.empty()) {
            console.warn(`Container #${containerId} not found`);
            return;
        }
        
        container.html('');
        
        const state = window.calculatorState;
        if (!state || !state.probabilities) {
            container.html(`
                <div class="no-data">
                    <div class="no-data-icon">🌪️</div>
                    <div>Configure calculator to see sensitivity analysis</div>
                </div>
            `);
            return;
        }
        
        // Get data
        const data = window.analyticsUtils.getSensitivityData();
        
        if (data.length === 0) {
            container.html(`
                <div class="no-data">
                    <div class="no-data-icon">🌪️</div>
                    <div>Adjust settings to see factor impacts</div>
                </div>
            `);
            return;
        }
        
        // Dimensions - ensure minimum size
        const margin = { top: 20, right: 50, bottom: 30, left: 150 };
        const containerWidth = container.node().clientWidth || 500;
        const containerHeight = container.node().clientHeight || 350;
        const width = Math.max(containerWidth - margin.left - margin.right, 150);
        const barHeight = 45;
        const height = Math.max(data.length * barHeight, 150);
        
        // Create SVG with calculated height
        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        // Scales
        const maxImpact = Math.max(d3.max(data, d => Math.abs(d.impact)), 3);
        
        const xScale = d3.scaleLinear()
            .domain([-maxImpact, maxImpact])
            .range([0, width]);
        
        const yScale = d3.scaleBand()
            .domain(data.map(d => d.name))
            .range([0, height])
            .padding(0.3);
        
        // Center line
        svg.append('line')
            .attr('x1', xScale(0))
            .attr('x2', xScale(0))
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', colors.axis)
            .attr('stroke-width', 2);
        
        // Bars
        svg.selectAll('.bar')
            .data(data)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => d.impact >= 0 ? xScale(0) : xScale(d.impact))
            .attr('y', d => yScale(d.name))
            .attr('width', d => Math.abs(xScale(d.impact) - xScale(0)))
            .attr('height', yScale.bandwidth())
            .attr('fill', d => d.type === 'positive' ? colors.positive : colors.negative)
            .attr('rx', 4)
            .attr('opacity', 0.8)
            .on('mouseover', function(event, d) {
                d3.select(this).attr('opacity', 1);
                showTooltip(`
                    <div style="font-weight: bold; color: ${d.type === 'positive' ? colors.positive : colors.negative}; margin-bottom: 5px;">
                        ${d.name}
                    </div>
                    <div>Impact: <strong>${d.impact >= 0 ? '+' : ''}${d.impact.toFixed(2)}%</strong></div>
                    <div style="color: ${colors.text}; font-size: 11px; margin-top: 5px;">
                        ${d.type === 'positive' ? '↑ Increases your odds' : '↓ Decreases your odds'}
                    </div>
                `, event);
            })
            .on('mouseout', function() {
                d3.select(this).attr('opacity', 0.8);
                hideTooltip();
            });
        
        // Impact labels
        svg.selectAll('.impact-label')
            .data(data)
            .enter()
            .append('text')
            .attr('class', 'impact-label')
            .attr('x', d => d.impact >= 0 ? xScale(d.impact) + 8 : xScale(d.impact) - 8)
            .attr('y', d => yScale(d.name) + yScale.bandwidth() / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', d => d.impact >= 0 ? 'start' : 'end')
            .attr('fill', d => d.type === 'positive' ? colors.positive : colors.negative)
            .attr('font-size', '12px')
            .attr('font-weight', 'bold')
            .text(d => `${d.impact >= 0 ? '+' : ''}${d.impact.toFixed(1)}%`);
        
        // Y axis (factor names)
        svg.append('g')
            .attr('class', 'axis')
            .call(d3.axisLeft(yScale))
            .selectAll('text')
            .attr('fill', colors.text)
            .attr('font-size', '12px');
        
        // X axis
        svg.append('g')
            .attr('class', 'axis')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(xScale).ticks(7).tickFormat(d => (d >= 0 ? '+' : '') + d.toFixed(1) + '%'));
        
        // Legend
        const legend = container.append('div')
            .attr('class', 'chart-legend');
        
        legend.append('div')
            .attr('class', 'legend-item')
            .html(`<div class="legend-color" style="background: ${colors.positive}"></div><span>Increases Odds</span>`);
        
        legend.append('div')
            .attr('class', 'legend-item')
            .html(`<div class="legend-color" style="background: ${colors.negative}"></div><span>Decreases Odds</span>`);
    }
    
    /**
     * Main render function
     * Called when navigating to analytics page or when state changes
     */
    function renderAllCharts() {
        if (!window.calculatorState || !window.calculatorState.probabilities) {
            console.log('⏳ Waiting for calculator state...');
            // Retry after a short delay
            setTimeout(renderAllCharts, 250);
            return;
        }
        
        console.log('📊 Rendering analytics charts...');
        
        try {
            renderProbabilityCurves('chart-probability-curves');
        } catch (e) {
            console.error('Error rendering probability curves:', e);
        }
        
        try {
            renderGoldROI('chart-gold-roi');
        } catch (e) {
            console.error('Error rendering gold ROI:', e);
        }
        
        try {
            renderTornadoChart('chart-tornado');
        } catch (e) {
            console.error('Error rendering tornado chart:', e);
        }
    }
    
    // Expose render function globally
    window.renderAnalytics = renderAllCharts;
    
    // Listen for state changes (debounced)
    let renderTimeout = null;
    window.addEventListener('calculatorStateChange', () => {
        // Only re-render if on analytics page
        const container = document.getElementById('pageContainer');
        if (container && container.getAttribute('data-active-page') === 'analytics') {
            clearTimeout(renderTimeout);
            renderTimeout = setTimeout(renderAllCharts, 150);
        }
    });
    
    // Initial render if already on analytics page
    setTimeout(() => {
        const container = document.getElementById('pageContainer');
        if (container && container.getAttribute('data-active-page') === 'analytics') {
            renderAllCharts();
        }
    }, 500);
    
    console.log('✓ Analytics module loaded');
})();
