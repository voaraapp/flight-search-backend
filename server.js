const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS for all origins (allows your frontend to call this backend)
app.use(cors());
app.use(express.json());

// Serve the HTML page at the root
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Flight search backend is running!' });
});

// Search flights endpoint
app.get('/api/search-flights', async (req, res) => {
  try {
    // Get parameters from query string
    const {
      from,
      to,
      date,
      returnDate,
      adults = '1',
      cabinClass = 'economy',
      currency = 'GBP',
      market = 'en-GB',
      countryCode = 'UK'
    } = req.query;

    // Validate required parameters
    if (!from || !to || !date) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['from', 'to', 'date']
      });
    }

    // Get API key from environment variable
    const apiKey = process.env.RAPIDAPI_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'API key not configured',
        message: 'Please set RAPIDAPI_KEY environment variable in Render'
      });
    }

    // Build the API URL
    // Note: Using airport codes for both skyId and entityId as a starting point
    // We may need to add an airport lookup endpoint later for proper entityIds
    const url = `https://sky-scrapper.p.rapidapi.com/api/v2/flights/searchFlights?originSkyId=${from}&destinationSkyId=${to}&originEntityId=${from}&destinationEntityId=${to}&date=${date}${returnDate ? `&returnDate=${returnDate}` : ''}&cabinClass=${cabinClass}&adults=${adults}&sortBy=best&currency=${currency}&market=${market}&countryCode=${countryCode}`;

    console.log('Calling API:', url);

    // Make the API request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });

    const data = await response.json();

    // Check if API returned an error
    if (!response.ok) {
      console.error('API Error:', data);
      return res.status(response.status).json({
        error: 'API request failed',
        details: data,
        status: response.status
      });
    }

    // Return the flight data
    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Search for airport/city codes (helper endpoint for future use)
app.get('/api/search-location', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        error: 'Missing query parameter'
      });
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'API key not configured'
      });
    }

    const url = `https://sky-scrapper.p.rapidapi.com/api/v1/flights/searchAirport?query=${encodeURIComponent(query)}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'sky-scrapper.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: 'API request failed',
        details: data
      });
    }

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`✈️  Flight Search Backend running on port ${PORT}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔑 API Key configured: ${process.env.RAPIDAPI_KEY ? 'Yes' : 'No'}`);
});
