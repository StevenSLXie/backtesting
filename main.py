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
    url = f'https://query2.finance.yahoo.com/v8/finance/chart/{ticker}'
    params = {
        'period1': period1,
        'period2': period2,
        'interval': '1d',
        'events': 'history'
    }
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    # Add delay between requests
    time.sleep(0.5)  # 500ms delay
    
    response = requests.get(url, params=params, headers=headers)
    
    if response.status_code == 429:  # Too Many Requests
        time.sleep(2)  # Wait longer and retry
        response = requests.get(url, params=params, headers=headers)
    
    response.raise_for_status()
    return response.json()

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

