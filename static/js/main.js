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

    async function fetchStockData(ticker, startDate, endDate) {
        // Convert dates to Unix timestamps
        const period1 = Math.floor(startDate.getTime() / 1000);
        const period2 = Math.floor(endDate.getTime() / 1000);
        
        // Use Yahoo Finance API v6 which typically has less CORS issues
        const historicalUrl = `https://query2.finance.yahoo.com/v8/finance/chart/${ticker}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
        
        try {
            const response = await fetch(historicalUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                },
                mode: 'cors'
            });

            if (!response.ok) throw new Error('Failed to fetch historical data');
            
            const data = await response.json();
            
            if (data.chart.error) {
                throw new Error(`Yahoo Finance API error for ${ticker}`);
            }

            const quotes = data.chart.result[0];
            const timestamps = quotes.timestamp;
            const closePrices = quotes.indicators.quote[0].close;

            return timestamps.map((timestamp, index) => ({
                date: timestamp * 1000, // Convert to milliseconds
                close: closePrices[index]
            })).filter(item => item.close !== null); // Filter out null values
            
        } catch (error) {
            console.error(`Error fetching data for ${ticker}:`, error);
            throw new Error(`Failed to fetch data for ${ticker}. Please try again later.`);
        }
    }

    function getDateRange(timeframe) {
        const endDate = new Date();
        const startDate = new Date();
        
        switch(timeframe) {
            case '6M': startDate.setMonth(endDate.getMonth() - 6); break;
            case '1Y': startDate.setFullYear(endDate.getFullYear() - 1); break;
            case '2Y': startDate.setFullYear(endDate.getFullYear() - 2); break;
            case '5Y': startDate.setFullYear(endDate.getFullYear() - 5); break;
            case '10Y': startDate.setFullYear(endDate.getFullYear() - 10); break;
        }
        
        return { startDate, endDate };
    }

    async function calculateMetrics() {
        const entries = document.querySelectorAll('.stock-entry');
        const timeframe = timeframeSelect.value;
        const portfolio = Array.from(entries).map(entry => ({
            ticker: entry.querySelector('.ticker').value.toUpperCase(),
            weight: parseFloat(entry.querySelector('.weight').value) / 100
        }));

        if (!validatePortfolio(portfolio)) {
            alert('Please ensure all fields are filled and weights sum to 100%');
            return;
        }

        setLoadingState(true);

        try {
            const { startDate, endDate } = getDateRange(timeframe);
            const stocksData = await Promise.all(
                portfolio.map(stock => 
                    fetchStockData(stock.ticker, startDate, endDate)
                )
            );

            const metrics = calculatePortfolioMetrics(stocksData, portfolio);
            updateMetrics(metrics);
            createGraph(metrics.history, timeframe);
        } catch (error) {
            console.error('Error:', error);
            alert('Failed to calculate metrics. Please check the ticker symbols and try again.');
        } finally {
            setLoadingState(false);
        }
    }

    function calculatePortfolioMetrics(stocksData, portfolio) {
        // Initialize portfolio with base value of 100
        const initialValue = 100;
        let portfolioHistory = [];
        
        // Find the earliest common start date
        const startDates = stocksData.map(data => data[0].date);
        const latestStartDate = Math.max(...startDates);
        
        // Align all stock data to start from the same date
        stocksData = stocksData.map(data => 
            data.filter(day => day.date >= latestStartDate)
        );
        
        // Normalize prices to start at 1
        stocksData = stocksData.map(data => {
            const initialPrice = data[0].close;
            return data.map(day => ({
                ...day,
                close: day.close / initialPrice
            }));
        });

        // Calculate weighted portfolio values
        const numDays = stocksData[0].length;
        for (let i = 0; i < numDays; i++) {
            let portfolioValue = 0;
            for (let j = 0; j < stocksData.length; j++) {
                portfolioValue += stocksData[j][i].close * portfolio[j].weight * initialValue;
            }
            portfolioHistory.push({
                date: new Date(stocksData[0][i].date),
                value: portfolioValue
            });
        }

        // Calculate metrics
        const totalReturn = (portfolioHistory[portfolioHistory.length - 1].value - initialValue) / initialValue;
        const dailyReturns = portfolioHistory.map((day, i) => 
            i > 0 ? (day.value - portfolioHistory[i-1].value) / portfolioHistory[i-1].value : 0
        );
        
        // Calculate annualized volatility
        const volatility = calculateVolatility(dailyReturns);
        
        return {
            totalReturn: totalReturn * 100,
            portfolioValue: portfolioHistory[portfolioHistory.length - 1].value,
            volatility: volatility * 100,
            dailyChange: (dailyReturns[dailyReturns.length - 1] || 0) * 100,
            history: portfolioHistory
        };
    }

    function calculateVolatility(dailyReturns) {
        const mean = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
        const squaredDiffs = dailyReturns.map(r => Math.pow(r - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / squaredDiffs.length;
        return Math.sqrt(variance * 252); // Annualized volatility
    }

    function validatePortfolio(portfolio) {
        if (!portfolio.length) return false;
        
        const validInputs = portfolio.every(stock => 
            stock.ticker && 
            !isNaN(stock.weight) && 
            stock.weight >= 0 && 
            stock.weight <= 1
        );
        
        const totalWeight = portfolio.reduce((sum, stock) => sum + stock.weight, 0);
        return validInputs && Math.abs(totalWeight - 1) < 0.0001;
    }

    function setLoadingState(isLoading) {
        calculateButton.disabled = isLoading;
        calculateButton.textContent = isLoading ? 'Calculating...' : 'Calculate Metrics';
        
        if (isLoading) {
            document.getElementById('total-return').textContent = '...';
            document.getElementById('portfolio-value').textContent = '...';
            document.getElementById('daily-change').textContent = '...';
            document.getElementById('volatility').textContent = '...';
        }
    }

    function updateMetrics(metrics) {
        document.getElementById('total-return').textContent = `${metrics.totalReturn.toFixed(2)}%`;
        document.getElementById('portfolio-value').textContent = `$${metrics.portfolioValue.toFixed(2)}`;
        document.getElementById('daily-change').textContent = `${metrics.dailyChange.toFixed(2)}%`;
        document.getElementById('volatility').textContent = `${metrics.volatility.toFixed(2)}%`;
    }

    function createGraph(history, timeframe) {
        const trace = {
            x: history.map(point => point.date),
            y: history.map(point => point.value),
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
            showlegend: true
        };

        Plotly.newPlot('graph-container', [trace], layout);
    }
}); 