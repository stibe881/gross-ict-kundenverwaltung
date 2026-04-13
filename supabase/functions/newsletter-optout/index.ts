import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

Deno.serve(async (req) => {
  // Check request method
  if (req.method !== 'GET') {
    return new Response('Method Not Allowed', { status: 405 })
  }

  try {
    const url = new URL(req.url)
    const customerId = url.searchParams.get('user')

    if (!customerId) {
      return new Response('Missing user parameter', { status: 400 })
    }

    // Create a Supabase client with the Auth context of the function
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Update customer opt-out status
    const { error } = await supabaseClient
      .from('customers')
      .update({ newsletter_opt_out: true })
      .eq('id', customerId)

    if (error) {
      console.error('Error updating customer:', error)
      return new Response(`Fehler bei der Abmeldung. Bitte kontaktieren Sie uns.`, {
        status: 500,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      })
    }

    // Redirect to the customer's WordPress success page
    return new Response(null, {
      status: 302,
      headers: new Headers({
        'Location': 'https://www.gross-ict.ch/abmeldung-newsletter'
      })
    })
  } catch (error: any) {
    return new Response(String(error?.message), { status: 500 })
  }
})
