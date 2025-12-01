const express = require("express");
const cors = require("cors");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // SERVE FRONTEND

const API_URL = "https://flights-scraper-real-time.p.rapidapi.com/v2/flight/round-trip";

app.get("/", (req, res) => {
  res.sendFile(__dirname + "/public/index.html");
});

// ---- Format API data into readable results ----
function formatItineraryResponse(data, dep, arr) {
  if (!data?.data?.itineraries) return [];

  return data.data.itineraries.map(itin => {
    const outSeg = itin.outbound?.sectorSegments?.[0];
    const inSeg = itin.inbound?.sectorSegments?.[0];

    return {
      from: dep,
      to: arr,
      outDeparture: outSeg?.departure,
      outArrival: outSeg?.arrival,
      returnDeparture: inSeg?.departure,
      returnArrival: inSeg?.arrival,
      stopsOutbound: outSeg?.stops?.length ?? 0,
      stopsInbound: inSeg?.stops?.length ?? 0,
      airline: outSeg?.carrierName ?? "Unknown",
      price: parseFloat(itin.price?.amount || "0")
    };
  });
}

// ---- ORIGINAL SINGLE ROUTE (kept untouched) ----
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
        "x-rapidapi-key": process.env.RAPIDAPI_KEY,
        "x-rapidapi-host": "flights-scraper-real-time.p.rapidapi.com"
      }
    });

    const data = await response.json();
    return res.json({ results: formatItineraryResponse(data, from, to) });

  } catch (err) {
    console.error("❌ /api/search error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ---- NEW MULTI-AIRPORT FLEXIBLE ----
app.post("/api/search-flex", async (req, res) => {
  try {
    const { departures, arrivals, departureDate, returnDate, adults = 1, currency = "GBP" } = req.body;
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
            "x-rapidapi-key": process.env.RAPIDAPI_KEY,
            "x-rapidapi-host": "flights-scraper-real-time.p.rapidapi.com"
          }
        });

        const data = await response.json();
        const formatted = formatItineraryResponse(data, dep, arr);
        allResults.push(...formatted);
      }
    }

    allResults.sort((a, b) => a.price - b.price);
    return res.json({ results: allResults });

  } catch (err) {
    console.error("❌ /api/search-flex error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// ---- START SERVER ----
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
