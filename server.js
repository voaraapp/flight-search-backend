
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Request counter (resets when server restarts)
let requestCount = 0;

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Serve the HTML page
app.use(express.static('public'));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Flight search backend is running!',
    apiRequestCount: requestCount,
    apiLimit: 150
  });
});

// Get request count
app.get('/api/request-count', (req, res) => {
  res.json({
    count: requestCount,
    limit: 150,
    remaining: 150 - requestCount
  });
});

// Airport autocomplete endpoint
app.get('/api/autocomplete', async (req, res) => {
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
        error: 'API key not configured',
        message: 'Please set RAPIDAPI_KEY environment variable in Render'
      });
    }

    const url = `https://flights-scraper-real-time.p.rapidapi.com/flights/auto-complete?query=${encodeURIComponent(query)}`;

    console.log(`[${++requestCount}/150] Autocomplete: ${query}`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'flights-scraper-real-time.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
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

// Search flights endpoint
app.get('/api/search-flights', async (req, res) => {
  try {
    const {
      from,
      to,
      departureDate,
      returnDate,
      tripType = 'return',
      adults = '1',
      children = '0',
      infants = '0',
      stops = '2',
      cabinClass = 'ECONOMY',
      currency = 'GBP',
      market = 'GB',
      locale = 'en-GB',
      sort = 'PRICE'
    } = req.query;

    // Validate required parameters
    if (!from || !to || !departureDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['from', 'to', 'departureDate']
      });
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    
    if (!apiKey) {
      return res.status(500).json({
        error: 'API key not configured'
      });
    }

    // Choose endpoint based on trip type
    const endpoint = tripType === 'oneway' 
      ? '/flights/search-oneway'
      : '/flights/search-return';

    // Build query parameters
    const params = new URLSearchParams({
      originSkyId: from,
      destinationSkyId: to,
      departureDate: departureDate,
      adults: adults,
      children: children,
      infants: infants,
      stops: stops,
      cabinClass: cabinClass,
      currency: currency,
      market: market,
      locale: locale,
      sort: sort,
      limit: '20',
      allowReturnFromDifferentStationOrAirport: 'true',
      allowReturnToDifferentStationOrAirport: 'true'
    });

    // Add return date if it's a return trip
    if (tripType === 'return' && returnDate) {
      params.append('returnDate', returnDate);
    }

    const url = `https://flights-scraper-real-time.p.rapidapi.com${endpoint}?${params}`;

    console.log(`[${++requestCount}/150] Search: ${from} -> ${to} (${departureDate}${returnDate ? ' - ' + returnDate : ''})`);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': 'flights-scraper-real-time.p.rapidapi.com',
        'x-rapidapi-key': apiKey
      }
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('API Error:', data);
      return res.status(response.status).json({
        error: 'API request failed',
        details: data,
        status: response.status
      });
    }

    // Count results
    const resultCount = data.data?.itineraries?.length || 0;
    console.log(`✅ Found ${resultCount} flights (Request ${requestCount}/150)`);

    res.json({
      success: true,
      data: data,
      meta: {
        requestCount: requestCount,
        requestLimit: 150,
        requestsRemaining: 150 - requestCount
      }
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
  console.log(`🔧 Using Flights Scraper Real-Time API`);
  console.log(`🔑 API Key configured: ${process.env.RAPIDAPI_KEY ? 'Yes' : 'No'}`);
  console.log(`📊 Request counter initialized at: ${requestCount}/150`);
});
