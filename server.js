const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;

// Request counter
let requestCount = 0;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Flight search backend V2 is running!',
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

// Airport autocomplete with nearby airports
app.get('/api/autocomplete', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Missing query parameter' });
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
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
      return res.status(response.status).json({ error: 'API request failed', details: data });
    }

    res.json({ success: true, data: data });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Efficient price table endpoint (for flexible date searches)
app.get('/api/price-table', async (req, res) => {
  try {
    const {
      from,
      to,
      departureDate,
      returnDate,
      adults = '1',
      currency = 'GBP',
      market = 'GB',
      locale = 'en-GB'
    } = req.query;

    if (!from || !to) {
      return res.status(400).json({ error: 'Missing required parameters', required: ['from', 'to'] });
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    const params = new URLSearchParams({
      originSkyId: from,
      destinationSkyId: to,
      adults: adults,
      currency: currency,
      locale: locale,
      market: market
    });

    if (departureDate) params.append('departureDate', departureDate);
    if (returnDate) params.append('returnDate', returnDate);

    const url = `https://flights-scraper-real-time.p.rapidapi.com/flights/price-table?${params}`;

    console.log(`[${++requestCount}/150] Price Table: ${from} -> ${to}`);

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
      return res.status(response.status).json({ error: 'API request failed', details: data, status: response.status });
    }

    console.log(`✅ Price table retrieved (Request ${requestCount}/150)`);

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
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// Search flights endpoint (for fixed date searches)
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

    if (!from || !to || !departureDate) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['from', 'to', 'departureDate']
      });
    }

    const apiKey = process.env.RAPIDAPI_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'API key not configured' });
    }

    // Choose endpoint based on trip type
    const endpoint = tripType === 'oneway' 
      ? '/flights/search-oneway'
      : '/flights/search-return';

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
      limit: '20'
    });

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

// Start server
app.listen(PORT, () => {
  console.log(`✈️  Flight Search Backend V2 running on port ${PORT}`);
  console.log(`🔧 Using Flights Scraper Real-Time API`);
  console.log(`🔑 API Key configured: ${process.env.RAPIDAPI_KEY ? 'Yes' : 'No'}`);
  console.log(`📊 Request counter: ${requestCount}/150`);
  console.log(`🚀 New features: Price tables, Open-jaw, Nearby airports`);
});
