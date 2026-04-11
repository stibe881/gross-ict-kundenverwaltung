import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

serve(async (req) => {
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

    const html = `
      <!DOCTYPE html>
      <html lang="de">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Newsletter Abmeldung erfolgreich</title>
          <style>
              body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f9fafb; margin: 0; }
              .container { background-color: white; padding: 40px; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); text-align: center; max-width: 400px; }
              h1 { color: #111827; font-size: 24px; margin-bottom: 16px; }
              p { color: #6b7280; font-size: 16px; line-height: 1.5; margin-bottom: 24px; }
              .icon { background-color: #d1fae5; color: #059669; width: 64px; height: 64px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 32px; margin: 0 auto 24px; }
          </style>
      </head>
      <body>
          <div class="container">
              <div class="icon">✓</div>
              <h1>Erfolgreich abgemeldet</h1>
              <p>Ihre E-Mail-Adresse wurde aus unserem Newsletter-Verteiler entfernt. Sie werden künftig keine Werbe-E-Mails mehr von uns erhalten.</p>
          </div>
      </body>
      </html>
    `

    return new Response(html, {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
  } catch (error) {
    return new Response(String(error?.message), { status: 500 })
  }
})
