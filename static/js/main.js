// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const stockEntries = document.getElementById('stock-entries');
    const addStockButton = document.getElementById('add-stock');
    const calculateButton = document.getElementById('calculate');
    const timeframeSelect = document.getElementById('timeframe');
    
    // Initialize with one stock entry
    addStockEntry();

    // Add stock entry handler
    addStockButton.addEventListener('click', addStockEntry);

    // Calculate metrics handler
    calculateButton.addEventListener('click', calculateMetrics);
    
    // Also recalculate when timeframe changes
    timeframeSelect.addEventListener('change', () => {
        if (document.querySelectorAll('.ticker').length > 0) {
            calculateMetrics();
        }
    });

    function addStockEntry() {
        const entry = document.createElement('div');
        entry.className = 'stock-entry';
        entry.innerHTML = `
            <input type="text" placeholder="Ticker Symbol" class="ticker">
            <input type="number" min="0" max="100" step="1" placeholder="Weight %" class="weight">
            <button onclick="this.parentElement.remove()">×</button>
        `;
        stockEntries.appendChild(entry);
    }

    function calculateMetrics() {
        const entries = document.querySelectorAll('.stock-entry');
        const timeframe = document.getElementById('timeframe').value;
        const portfolio = Array.from(entries).map(entry => ({
            ticker: entry.querySelector('.ticker').value.toUpperCase(),
            weight: parseFloat(entry.querySelector('.weight').value) / 100
        }));

        // Validate inputs
        if (!validatePortfolio(portfolio)) {
            alert('Please ensure all fields are filled and weights sum to 100%');
            return;
        }

        // Show loading state
        setLoadingState(true);

        // Call backend API
        fetch('/calculate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                portfolio: portfolio,
                timeframe: timeframe
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            setLoadingState(false);
            if (data.success) {
                // Check for valid numbers before updating
                if (isValidMetrics(data.metrics) && isValidHistory(data.history)) {
                    updateMetrics(data.metrics);
                    createGraph(data.history, timeframe);
                } else {
                    throw new Error('Invalid data received from server');
                }
            } else {
                alert('Error: ' + data.error);
            }
        })
        .catch(error => {
            setLoadingState(false);
            console.error('Error:', error);
            alert('Failed to calculate metrics. Please check the ticker symbols and try again.');
        });
    }

    function isValidMetrics(metrics) {
        return metrics &&
               !isNaN(metrics.totalReturn) &&
               !isNaN(metrics.portfolioValue) &&
               !isNaN(metrics.volatility) &&
               !isNaN(metrics.dailyChange);
    }

    function isValidHistory(history) {
        return history &&
               Array.isArray(history.dates) &&
               Array.isArray(history.values) &&
               history.dates.length > 0 &&
               history.values.length > 0 &&
               history.values.every(v => !isNaN(v));
    }

    function setLoadingState(isLoading) {
        const loadingText = '...';
        if (isLoading) {
            document.getElementById('total-return').textContent = loadingText;
            document.getElementById('portfolio-value').textContent = loadingText;
            document.getElementById('daily-change').textContent = loadingText;
            document.getElementById('volatility').textContent = loadingText;
            calculateButton.disabled = true;
        } else {
            calculateButton.disabled = false;
        }
    }

    function validatePortfolio(portfolio) {
        const weightSum = portfolio.reduce((sum, stock) => sum + stock.weight, 0);
        return portfolio.every(stock => stock.ticker && !isNaN(stock.weight)) &&
               Math.abs(weightSum - 1) < 0.0001;
    }

    function updateMetrics(metrics) {
        document.getElementById('total-return').textContent = `${metrics.totalReturn.toFixed(2)}%`;
        document.getElementById('portfolio-value').textContent = `$${metrics.portfolioValue.toFixed(2)}`;
        document.getElementById('daily-change').textContent = `${metrics.dailyChange.toFixed(2)}%`;
        document.getElementById('volatility').textContent = `${metrics.volatility.toFixed(2)}%`;
    }

    function createGraph(history, timeframe) {
        const trace = {
            x: history.dates,
            y: history.values,
            type: 'scatter',
            mode: 'lines',
            name: 'Portfolio Value'
        };

        const layout = {
            title: `Portfolio Performance (${timeframe})`,
            xaxis: { 
                title: 'Date',
                rangeslider: {visible: true}
            },
            yaxis: { 
                title: 'Value ($)',
                tickformat: '$.2f'
            },
            showlegend: true,
            legend: {
                x: 0,
                y: 1
            }
        };

        const config = {
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToAdd: ['drawline', 'drawopenpath', 'eraseshape']
        };

        Plotly.newPlot('graph-container', [trace], layout, config);
    }
}); 