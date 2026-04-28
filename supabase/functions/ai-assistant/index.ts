import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { messages, itemContext } = await req.json()

    const systemPrompt = `You are a friendly and knowledgeable estate assistant helping a family identify and value items from an estate. You have expertise in antiques, collectibles, furniture, art, jewelry, and household items.

Current item context:
${JSON.stringify(itemContext, null, 2)}

Your role:
- Help identify the item more precisely
- Ask relevant questions to determine value (age, provenance, condition details, brand/model)
- Provide market value insights when you have enough information
- Be warm and sensitive - this is often an emotional process for families
- Keep responses concise and practical
- If asked about value, give ranges in both USD and NOK (multiply USD by ~10.5)
- Suggest when professional appraisal might be worthwhile

Always respond in the same language the user writes in.`

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
        system: systemPrompt,
        messages: messages,
      })
    })

    const data = await response.json()
    const reply = data.content[0].text

    return new Response(JSON.stringify({ success: true, reply }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (error) {
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
