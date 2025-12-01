import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const API_URL = "https://flights-scraper-real-time.p.rapidapi.com/v2/flight/round-trip";
const API_KEY = process.env.RAPIDAPI_KEY;

// --- Existing Single Route (DO NOT DELETE) ---
app.post("/api/search", async (req, res) => {
  try {
    const { from, to, departureDate, returnDate, adults = 1, currency = "GBP" } = req.body;

    const url = new URL(API_URL);
    url.searchParams.append("fromId", `${from}-sky`);
    url.searchParams.append("toId", `${to}-sky`);
    url.searchParams.append("date", departureDate);
    url.searchParams.append("returnDate", returnDate);
    url.searchParams.append("selectedCabins", "ECONOMY");
    url.searchParams.append("adult", adults);
    url.searchParams.append("currency", currency);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "x-rapidapi-key": API_KEY,
        "x-rapidapi-host": "flights-scraper-real-time.p.rapidapi.com"
      }
    });

    const data = await response.json();
    res.json({ results: formatItineraryResponse(data, from, to) });

  } catch (error) {
    console.error("❌ /api/search ERROR:", error);
    return res.status(500).json({ error: "Server error" });
  }
});

// --- NEW Multi-Airport Flexible Search ---
app.post("/api/search-flex", async (req, res) => {
  try {
    const { departures, arrivals, departureDate, returnDate, adults = 1, currency = "GBP" } = req.body;
    if (!departures || !arrivals) {
      return res.status(400).json({ error: "Missing airports" });
    }

    let allResults = [];

    for (const dep of departures) {
      for (const arr of arrivals) {
        const url = new URL(API_URL);
        url.searchParams.append("fromId", `${dep}-sky`);
        url.searchParams.append("toId", `${arr}-sky`);
        url.searchParams.append("date", departureDate);
        url.searchParams.append("returnDate", returnDate);
        url.searchParams.append("selectedCabins", "ECONOMY");
        url.searchParams.append("adult", adults);
        url.searchParams.append("currency", currency);

        const response = await fetch(url.toString(), {
          method: "GET",
          headers: {
            "x-rapidapi-key": API_KEY,
            "x-rapidapi-host": "flights-scraper-real-time.p.rapidapi.com"
          }
        });

        const data = await response.json();
        const formatted = formatItineraryResponse(data, dep, arr);
        allResults.push(...formatted);
      }
    }

    if (allResults.length === 0) return res.json({ results: [] });

    allResults.sort((a, b) => a.price - b.price);

    res.json({ results: allResults });

  } catch (error) {
    console.error("❌ /api/search-flex ERROR:", error);
    return res.status(500).json({ error: "Server Error" });
  }
});

// ---- Response Formatter ----
function formatItineraryResponse(data, dep, arr) {
  if (!data?.data?.itineraries) return [];

  return data.data.itineraries.map(itin => {
    const outSeg = itin.outbound?.sectorSegments?.[0];
    const inSeg = itin.inbound?.sectorSegments?.[0];
    return {
      from: dep,
      to: arr,
      outDeparture: outSeg?.departure ?? null,
      outArrival: outSeg?.arrival ?? null,
      returnDeparture: inSeg?.departure ?? null,
      returnArrival: inSeg?.arrival ?? null,
      stopsOutbound: outSeg?.stops?.length ?? 0,
      stopsInbound: inSeg?.stops?.length ?? 0,
      airline: outSeg?.carrierName ?? "Unknown",
      price: parseFloat(itin.price?.amount || 0)
    };
  });
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Backend running on ${PORT}`));
