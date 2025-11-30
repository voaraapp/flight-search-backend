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
  res.json({ status: 'OK', message: 'Flight search backend is running (Kiwi.com API)!' });
});

// Search flights endpoint using Kiwi.com API
app.get('/api/search-flights', async (req, res) => {
  try {
    // Get parameters from query string
    const {
      from,
      to,
      date,
      returnDate,
      adults = '1',
      currency = 'GBP'
    } = req.query;

    // Validate required parameters
    if (!from || !to || !date) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['from', 'to', 'date']
      });
    }

    // Get API key from environment variable (defaults to "picky" test key)
    const apiKey = process.env.KIWI_API_KEY || 'picky';
    
    console.log(`Searching flights: ${from} -> ${to} on ${date}`);
    console.log(`Using API key: ${apiKey === 'picky' ? 'picky (test key)' : 'custom key'}`);

    // Format date for Kiwi API (they want DD/MM/YYYY)
    const formatDate = (dateStr) => {
      const d = new Date(dateStr);
      const day = String(d.getDate()).padStart(2, '0');
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const year = d.getFullYear();
      return `${day}/${month}/${year}`;
    };

    // Build the Kiwi.com API URL
    const baseUrl = 'https://api.tequila.kiwi.com/v2/search';
    const params = new URLSearchParams({
      fly_from: from,
      fly_to: to,
      date_from: formatDate(date),
      date_to: formatDate(date),
      adults: adults,
      curr: currency,
      limit: 20, // Get top 20 results
      sort: 'price'
    });

    // Add return date if provided
    if (returnDate) {
      params.append('return_from', formatDate(returnDate));
      params.append('return_to', formatDate(returnDate));
    }

    const url = `${baseUrl}?${params}`;
    console.log('Calling Kiwi API...');

    // Make the API request
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiKey
      }
    });

    const data = await response.json();

    // Check if API returned an error
    if (!response.ok) {
      console.error('API Error:', response.status, data);
      return res.status(response.status).json({
        error: 'API request failed',
        details: data,
        status: response.status,
        message: response.status === 401 ? 'API key invalid or expired' : data.message || 'Unknown error'
      });
    }

    console.log(`Success! Found ${data.data?.length || 0} flights`);

    // Return the flight data
    res.json({
      success: true,
      data: data,
      resultCount: data.data?.length || 0
    });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Search for airport/city codes
app.get('/api/search-location', async (req, res) => {
  try {
    const { query } = req.query;
    
    if (!query) {
      return res.status(400).json({
        error: 'Missing query parameter'
      });
    }

    const apiKey = process.env.KIWI_API_KEY || 'picky';

    const url = `https://api.tequila.kiwi.com/locations/query?term=${encodeURIComponent(query)}&locale=en-US&location_types=airport&limit=10`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'apikey': apiKey
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
  console.log(`🔧 Using Kiwi.com API`);
  console.log(`🔑 API Key: ${process.env.KIWI_API_KEY ? 'Custom key configured' : 'Using "picky" test key'}`);
});
