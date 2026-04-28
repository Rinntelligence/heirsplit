import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const CATEGORIES = [
  'Furniture', 'Art & pictures', 'Books', 'Kitchen', 
  'Decorations', 'Electronics', 'Clothing & textiles', 
  'Jewelry', 'Tools', 'Sports & outdoors', 'Collectibles', 'Other'
]

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { imageBase64, mimeType } = await req.json()
    
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
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mimeType, data: imageBase64 }
            },
            {
              type: 'text',
              text: `You are an estate item analyzer. Look at this image and respond ONLY with valid JSON, no other text.

Analyze the item and provide:
1. A clear, specific title (e.g. "Oak rocking chair, early 1900s" not just "chair")
2. A detailed description (material, color, condition, notable features, estimated era/age)
3. The best matching category from: ${CATEGORIES.join(', ')}
4. Estimated age or decade (e.g. "1970s", "circa 1920", "modern 2000s")
5. Condition: excellent, good, fair, or poor
6. Any identifying features that could help determine value (brand, model, markings, hallmarks)
7. 2-3 follow-up questions to ask the owner to better determine value

Respond ONLY with this JSON structure:
{
  "title": "...",
  "description": "...",
  "category": "...",
  "estimated_age": "...",
  "condition": "...",
  "identifying_features": "...",
  "follow_up_questions": ["...", "...", "..."],
  "confidence": "high|medium|low"
}`
            }
          ]
        }]
      })
    })

    const data = await response.json()
    const text = data.content[0].text
    
    // Parse JSON from Claude's response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON in response')
    const result = JSON.parse(jsonMatch[0])

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
