from flask import Flask, render_template, send_from_directory, jsonify, request
import os
import requests
from datetime import datetime
import time
from flask_cors import CORS
from functools import lru_cache

app = Flask(__name__, 
    static_url_path='/static',
    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'),
    template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
)
CORS(app)

# Cache stock data for 1 hour
@lru_cache(maxsize=100)
def fetch_stock_data(ticker, period1, period2):
    # Add .SI suffix for Singapore stocks if not present
    if ticker.startswith('^STI') or ticker.upper().endswith('.SI'):
        # Already has market identifier
        formatted_ticker = ticker
    else:
        # Check if it might be a Singapore stock (you can add more prefixes)
        sg_prefixes = ['C', 'D', 'F', 'G', 'H', 'J', 'K', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'Y', 'Z']
        if any(ticker.startswith(prefix) for prefix in sg_prefixes) and ticker[1:].isdigit():
            formatted_ticker = f"{ticker}.SI"
        else:
            formatted_ticker = ticker

    url = f'https://query2.finance.yahoo.com/v8/finance/chart/{formatted_ticker}'
    params = {
        'period1': period1,
        'period2': period2,
        'interval': '1d',
        'events': 'history'
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
    }
    
    try:
        time.sleep(1)  # 1 second delay
        
        response = requests.get(url, params=params, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching {formatted_ticker}: {str(e)}")
        if hasattr(e, 'response') and e.response.status_code == 404:
            # Try alternative format if first attempt fails
            if formatted_ticker.endswith('.SI'):
                # Try without .SI
                return fetch_stock_data(ticker.replace('.SI', ''), period1, period2)
            elif not formatted_ticker.endswith('.SI'):
                # Try with .SI
                return fetch_stock_data(f"{ticker}.SI", period1, period2)
        elif hasattr(e, 'response') and e.response.status_code == 503:
            raise Exception("Yahoo Finance service is temporarily unavailable. Please try again in a few minutes.")
        raise Exception(f"Could not fetch data for {ticker}. Please verify the ticker symbol.")

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/static/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/stock-data', methods=['GET'])
def get_stock_data():
    ticker = request.args.get('ticker')
    period1 = request.args.get('period1')
    period2 = request.args.get('period2')
    
    if not all([ticker, period1, period2]):
        return jsonify({'error': 'Missing parameters'}), 400
    
    try:
        data = fetch_stock_data(ticker, period1, period2)
        return jsonify(data)
    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 429:
            return jsonify({'error': 'Rate limit exceeded. Please try again later.'}), 429
        return jsonify({'error': str(e)}), e.response.status_code
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

