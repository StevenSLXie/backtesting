from flask import Flask, render_template, send_from_directory, jsonify, request
import os
import requests
from datetime import datetime
from flask_cors import CORS

app = Flask(__name__, 
    static_url_path='/static',
    static_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'static'),
    template_folder=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'templates')
)
CORS(app)

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
    
    url = f'https://query2.finance.yahoo.com/v8/finance/chart/{ticker}'
    params = {
        'period1': period1,
        'period2': period2,
        'interval': '1d',
        'events': 'history'
    }
    
    try:
        print(f"Fetching data for {ticker} from Yahoo Finance...")  # Debug log
        response = requests.get(url, params=params)
        response.raise_for_status()  # Raise an exception for bad status codes
        data = response.json()
        print(f"Successfully fetched data for {ticker}")  # Debug log
        return jsonify(data)
    except requests.RequestException as e:
        print(f"Error fetching data for {ticker}: {str(e)}")  # Debug log
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)

