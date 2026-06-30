import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { corsHeaders } from "../_shared/cors.ts"

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY') || ''

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, payload } = await req.json()

    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in Edge Function environment")
    }

    if (action === 'generateChat') {
      const { systemPrompt, history, userMessage } = payload
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            ...history,
            { role: 'user', parts: [{ text: userMessage }] },
          ],
          generationConfig: {
            temperature: 0.7,
            topP: 0.95,
            topK: 40,
            maxOutputTokens: 1024,
          },
          safetySettings: [
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ],
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API error (Chat):', errorText)
        throw new Error('Failed to generate chat response from Gemini')
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    } 
    
    else if (action === 'generateEmbeddings') {
      const { text } = payload
      
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/text-embedding-004',
          content: { parts: [{ text }] },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Gemini API error (Embedding):', errorText)
        throw new Error('Failed to generate embeddings from Gemini')
      }

      const data = await response.json()
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    else {
      throw new Error(`Unsupported action: ${action}`)
    }

  } catch (error: any) {
    console.error('Edge Function Error:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
