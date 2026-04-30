import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Depreciation rates per category
const DEPRECIATION_RATES: Record<string, number> = {
  'Electronics': 0.30, 'Furniture': 0.08, 'Art & pictures': 0.02,
  'Jewelry': 0.03, 'Books': 0.10, 'Kitchen': 0.12,
  'Clothing & textiles': 0.20, 'Collectibles': -0.03,
  'Tools': 0.10, 'Sports & outdoors': 0.15, 'Decorations': 0.08, 'Other': 0.12,
}
const VALUE_FLOORS: Record<string, number> = {
  'Electronics': 0.05, 'Furniture': 0.20, 'Art & pictures': 0.30,
  'Jewelry': 0.40, 'Collectibles': 0.50, 'Other': 0.10,
}

// Free price sources by category
const PRICE_SOURCES: Record<string, string[]> = {
  'Electronics': ['finn.no', 'prisjakt.no', 'ebay.com'],
  'Furniture': ['finn.no', 'ikea.com', 'ebay.com'],
  'Art & pictures': ['finn.no', 'ebay.com', 'invaluable.com'],
  'Jewelry': ['finn.no', 'ebay.com', 'pricecharting.com'],
  'Collectibles': ['ebay.com', 'pricecharting.com', 'finn.no'],
  'Books': ['finn.no', 'ebay.com', 'bokkilden.no'],
  'Other': ['finn.no', 'ebay.com'],
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { title, description, category, condition, purchase_price, purchase_year, ai_identified_model } = await req.json()

    // 1. Depreciation calc if we have purchase data
    let depreciationEstimate = null
    if (purchase_price && purchase_year) {
      const yearsOld = new Date().getFullYear() - parseInt(purchase_year)
      const rate = DEPRECIATION_RATES[category] || 0.12
      const floor = VALUE_FLOORS[category] || 0.10
      const depreciated = purchase_price * Math.pow(1 - rate, yearsOld)
      depreciationEstimate = {
        value: Math.max(depreciated, purchase_price * floor),
        years_old: yearsOld,
        rate_used: rate,
        original_price: purchase_price,
      }
    }

    // 2. AI market estimate — use haiku (cheapest) for value, only sonnet for images
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001', // cheapest model — ~$0.001 per call
        max_tokens: 600,
        messages: [{
          role: 'user',
          content: `You are an expert Norwegian estate appraiser. Estimate the current Norwegian market value (in NOK) for this item.

Item: ${title}
Description: ${description || 'No description'}
Category: ${category}
Condition: ${condition || 'good'}
${ai_identified_model ? `AI identified as: ${ai_identified_model}` : ''}
${purchase_price ? `Original price: ${purchase_price} NOK (${purchase_year})` : ''}

Use your knowledge of:
- Current Norwegian second-hand market (finn.no prices)
- Typical depreciation for this category
- The specific model/brand if identifiable
- Condition impact

Respond ONLY with this JSON (no other text):
{
  "low_nok": <number>,
  "high_nok": <number>,
  "likely_nok": <number>,
  "reasoning": "2 sentences max explaining the estimate",
  "market_references": ["e.g. Similar Samsung TV on finn.no: 1500-2500 kr", "eBay completed listings: $150-200"],
  "price_check_urls": ["https://www.finn.no/bap/forsale/search.html?q=SEARCH_TERM", "https://www.ebay.com/sch/i.html?_nkw=SEARCH_TERM"],
  "estimated_year": "e.g. 2018-2020",
  "confidence": "high|medium|low",
  "category_trend": "appreciating|stable|depreciating"
}`
        }]
      })
    })

    const data = await response.json()
    const text = data.content[0].text
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const aiEstimate = JSON.parse(jsonMatch[0])

    // Fill in search URLs with actual item title
    const searchTerm = encodeURIComponent(title.split(' ').slice(0, 4).join(' '))
    aiEstimate.price_check_urls = [
      `https://www.finn.no/bap/forsale/search.html?q=${searchTerm}`,
      `https://www.ebay.com/sch/i.html?_nkw=${searchTerm}&LH_Sold=1&LH_Complete=1`,
    ]

    const sources = PRICE_SOURCES[category] || PRICE_SOURCES['Other']

    return new Response(JSON.stringify({
      success: true,
      data: {
        depreciation: depreciationEstimate,
        market: aiEstimate,
        price_sources: sources,
        summary: {
          low_nok: aiEstimate.low_nok,
          high_nok: aiEstimate.high_nok,
          likely_nok: aiEstimate.likely_nok,
        }
      }
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
