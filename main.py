from flask import Flask, render_template, jsonify, request
import yfinance as yf
from datetime import datetime, timedelta
import numpy as np
import pandas as pd
import logging
import math

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/calculate', methods=['POST'])
def calculate():
    try:
        data = request.json
        logger.debug(f"Received request data: {data}")
        
        portfolio = data['portfolio']
        timeframe = data['timeframe']
        
        # Initialize all stocks with base price of 1
        initial_value = 100  # $100 initial investment
        
        # Get historical data
        end_date = datetime.now()
        start_date = get_start_date(timeframe)
        
        logger.debug(f"Fetching data from {start_date} to {end_date}")
        
        # Fetch and process historical data
        portfolio_data = []
        for stock in portfolio:
            ticker_symbol = stock['ticker']
            logger.debug(f"Fetching data for {ticker_symbol}")
            
            ticker = yf.Ticker(ticker_symbol)
            hist = ticker.history(start=start_date, end=end_date, interval='1d')
            
            if hist.empty:
                raise ValueError(f"No data found for ticker {ticker_symbol}")
            
            portfolio_data.append({
                'ticker': ticker_symbol,
                'weight': stock['weight'],
                'prices': hist['Close']
            })
            logger.debug(f"Successfully fetched data for {ticker_symbol}")

        # Calculate portfolio metrics and history
        returns, history = calculate_portfolio_performance(portfolio_data, initial_value)
        volatility = calculate_volatility(portfolio_data)
        daily_change = calculate_daily_change(portfolio_data)
        
        # Handle NaN values and convert to Python native types
        def clean_value(x):
            if isinstance(x, (np.floating, float)) and (math.isnan(x) or math.isinf(x)):
                return 0.0
            if isinstance(x, (np.integer, np.floating)):
                return float(x)
            return x

        # Clean the history values
        clean_values = [clean_value(x) for x in history.values]
        
        response_data = {
            'success': True,
            'metrics': {
                'totalReturn': clean_value(returns * 100),
                'portfolioValue': clean_value(initial_value * (1 + returns)),
                'volatility': clean_value(volatility * 100),
                'dailyChange': clean_value(daily_change * 100)
            },
            'history': {
                'dates': history.index.strftime('%Y-%m-%d').tolist(),
                'values': clean_values
            }
        }
        
        logger.debug("Calculation completed successfully")
        return jsonify(response_data)

    except Exception as e:
        logger.error(f"Error in calculate endpoint: {str(e)}", exc_info=True)
        return jsonify({
            'success': False,
            'error': str(e)
        })

def get_start_date(timeframe):
    end_date = datetime.now()
    timeframe_map = {
        '6M': timedelta(days=180),
        '1Y': timedelta(days=365),
        '2Y': timedelta(days=730),
        '5Y': timedelta(days=1825),
        '10Y': timedelta(days=3650)
    }
    return end_date - timeframe_map[timeframe]

def calculate_portfolio_performance(portfolio_data, initial_value):
    try:
        # Create a DataFrame with all stock prices
        all_prices = pd.DataFrame()
        for stock in portfolio_data:
            all_prices[stock['ticker']] = stock['prices']
        
        # Align all price series to have the same dates
        all_prices = all_prices.dropna()
        
        if all_prices.empty:
            raise ValueError("No overlapping dates found for the selected stocks")
        
        # Calculate returns for each stock
        returns = all_prices.pct_change()
        
        # Calculate weighted portfolio returns
        weights = [stock['weight'] for stock in portfolio_data]
        portfolio_returns = returns.dot(weights)
        
        # Calculate cumulative portfolio value
        portfolio_value = (1 + portfolio_returns).cumprod() * initial_value
        
        # Calculate total return
        total_return = (portfolio_value.iloc[-1] - initial_value) / initial_value
        
        return total_return, portfolio_value

    except Exception as e:
        logger.error(f"Error in portfolio performance calculation: {str(e)}", exc_info=True)
        raise

def calculate_volatility(portfolio_data):
    try:
        # Calculate portfolio volatility (annualized)
        all_returns = pd.DataFrame()
        weights = []
        
        for stock in portfolio_data:
            returns = stock['prices'].pct_change().dropna()
            all_returns[stock['ticker']] = returns
            weights.append(stock['weight'])
        
        # Align all return series to have the same dates
        all_returns = all_returns.dropna()
        
        if all_returns.empty:
            raise ValueError("No overlapping dates found for volatility calculation")
        
        weights = np.array(weights)
        cov_matrix = all_returns.cov() * 252  # Annualize covariance
        portfolio_variance = weights.T @ cov_matrix @ weights
        return np.sqrt(portfolio_variance)

    except Exception as e:
        logger.error(f"Error in volatility calculation: {str(e)}", exc_info=True)
        raise

def calculate_daily_change(portfolio_data):
    try:
        # Calculate the most recent daily change
        latest_returns = []
        weights = []
        
        for stock in portfolio_data:
            returns = stock['prices'].pct_change().dropna()
            if len(returns) > 0:
                latest_returns.append(returns.iloc[-1])
                weights.append(stock['weight'])
            else:
                raise ValueError(f"No returns data available for {stock['ticker']}")
        
        if not latest_returns:
            raise ValueError("No daily changes could be calculated")
            
        return np.dot(latest_returns, weights)

    except Exception as e:
        logger.error(f"Error in daily change calculation: {str(e)}", exc_info=True)
        raise

if __name__ == '__main__':
    app.run(debug=True)

