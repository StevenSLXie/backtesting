# Stock Portfolio Analyzer

A web-based tool for analyzing custom stock portfolios with support for both US and Singapore stocks.

## Features

- Create custom portfolios with multiple stocks
- Support for both US and Singapore stocks
- Calculate key portfolio metrics:
  - Total Return
  - Portfolio Value
  - Daily Change
  - Volatility
- Interactive performance graph
- Multiple timeframe analysis (6M, 1Y, 2Y, 5Y, 10Y)
- Real-time data from Yahoo Finance API

## Usage

### Stock Symbols
- US Stocks: Use regular ticker symbols (e.g., AAPL, GOOGL, META)
- Singapore Stocks: 
  - Add .SI suffix (e.g., D05.SI for DBS)
  - Common Singapore stocks:
    - D05.SI (DBS)
    - O39.SI (OCBC)
    - U11.SI (UOB)
    - C38U.SI (CapitaLand)
    - Z74.SI (SingTel)

### Portfolio Creation
1. Enter stock symbols in the ticker fields
2. Assign weights (percentages) to each stock
3. Ensure weights sum to 100%
4. Select desired timeframe
5. Click "Calculate Metrics" to view results

## Technical Details

- Frontend: HTML, CSS, JavaScript
- Backend: Python/Flask
- Data Source: Yahoo Finance API
- Deployment: Vercel
- Features:
  - Server-side API calls to avoid CORS issues
  - Rate limiting protection
  - Error handling for API failures
  - Caching for improved performance

## Development

### Prerequisites
- Python 3.x
- Flask
- Requests library

### Local Setup
1. Clone the repository
2. Install dependencies: