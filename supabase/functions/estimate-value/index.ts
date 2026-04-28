import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')
const EBAY_APP_ID = Deno.env.get('EBAY_APP_ID')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Depreciation rates per year by category (insurance model)
const DEPRECIATION_RATES: Record<string, number> = {
  'Electronics': 0.30,        // 30% per year - fast depreciation
  'Furniture': 0.08,          // 8% per year - slow, quality holds
  'Art & pictures': 0.02,     // 2% - can appreciate
  'Jewelry': 0.03,            // 3% - gold/silver holds value
  'Books': 0.10,              // 10% per year
  'Kitchen': 0.12,            // 12% per year
  'Clothing & textiles': 0.20, // 20% per year
  'Tools': 0.10,              // 10% per year
  'Sports & outdoors': 0.15,  // 15% per year
  'Collectibles': -0.03,      // Appreciates 3% per year on average
  'Decorations': 0.08,        // 8% per year
  'Other': 0.12,              // Default 12%
}

// Minimum value floor (% of original)
const VALUE_FLOOR: Record<string, number> = {
  'Electronics': 0.05,
  'Furniture': 0.20,
  'Art & pictures': 0.30,
  'Jewelry': 0.40,
  'Collectibles': 0.50,
  'Other': 0.10,
}

async function searchEbay(query: string): Promise<any[]> {
  if (!EBAY_APP_ID) return []
  
  try {
    const encoded = encodeURIComponent(query)
    const url = `https://svcs.ebay.com/services/search/FindingService/v1?OPERATION-NAME=findCompletedItems&SERVICE-VERSION=1.0.0&SECURITY-APPNAME=${EBAY_APP_ID}&RESPONSE-DATA-FORMAT=JSON&keywords=${encoded}&itemFilter(0).name=SoldItemsOnly&itemFilter(0).value=true&paginationInput.entriesPerPage=5&sortOrder=EndTimeSoonest`
    
    const res = await fetch(url)
    const data = await res.json()
    const items = data?.findCompletedItemsResponse?.[0]?.searchResult?.[0]?.item || []
    
    return items.map((item: any) => ({
      title: item.title?.[0],
      price: parseFloat(item.sellingStatus?.[0]?.currentPrice?.[0]?.__value__ || 0),
      currency: item.sellingStatus?.[0]?.currentPrice?.[0]?.['@currencyId'] || 'USD',
      soldDate: item.listingInfo?.[0]?.endTime?.[0],
      url: item.viewItemURL?.[0],
    }))
  } catch {
    return []
  }
}

async function getAIEstimate(title: string, description: string, category: string, condition: string, ebayResults: any[]): Promise<any> {
  const ebayContext = ebayResults.length > 0 
    ? `Recent eBay sold listings for similar items:\n${ebayResults.map(e => `- ${e.title}: ${e.currency} ${e.price}`).join('\n')}`
    : 'No eBay data available.'

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-opus-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: `You are an expert estate appraiser with 20 years experience. Estimate the current market value of this item.

Item: ${title}
Description: ${description}
Category: ${category}
Condition: ${condition}

${ebayContext}

Consider:
- Current market demand
- Condition impact on value
- Regional variations (Norway/Scandinavia market if applicable)
- Sentimental vs market value difference

Respond ONLY with JSON:
{
  "low_estimate": <number in USD>,
  "high_estimate": <number in USD>,
  "most_likely": <number in USD>,
  "currency": "USD",
  "confidence": "high|medium|low",
  "reasoning": "2-3 sentences explaining the estimate",
  "value_drivers": ["factor1", "factor2"],
  "market_notes": "Any relevant market context",
  "nok_multiplier": 10.5
}`
      }]
    })
  })

  const data = await response.json()
  const text = data.content[0].text
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON')
  return JSON.parse(jsonMatch[0])
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { title, description, category, condition, purchase_price, purchase_year } = await req.json()

    // 1. Calculate depreciation-based estimate
    let depreciationEstimate = null
    if (purchase_price && purchase_year) {
      const yearsOld = new Date().getFullYear() - parseInt(purchase_year)
      const rate = DEPRECIATION_RATES[category] || 0.12
      const floor = VALUE_FLOOR[category] || 0.10
      const depreciated = purchase_price * Math.pow(1 - rate, yearsOld)
      const floorValue = purchase_price * floor
      depreciationEstimate = {
        value: Math.max(depreciated, floorValue),
        years_old: yearsOld,
        rate_used: rate,
        original_price: purchase_price,
        method: 'insurance_depreciation'
      }
    }

    // 2. Search eBay for similar sold items
    const ebayQuery = `${title} ${condition}`.trim()
    const ebayResults = await searchEbay(ebayQuery)

    // 3. Get AI market estimate
    const aiEstimate = await getAIEstimate(title, description, category, condition, ebayResults)

    return new Response(JSON.stringify({
      success: true,
      data: {
        depreciation: depreciationEstimate,
        market: aiEstimate,
        ebay_sold: ebayResults,
        summary: {
          low_nok: Math.round(aiEstimate.low_estimate * (aiEstimate.nok_multiplier || 10.5)),
          high_nok: Math.round(aiEstimate.high_estimate * (aiEstimate.nok_multiplier || 10.5)),
          likely_nok: Math.round(aiEstimate.most_likely * (aiEstimate.nok_multiplier || 10.5)),
        }
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
