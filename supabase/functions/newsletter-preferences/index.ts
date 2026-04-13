import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (req.method === 'GET') {
      const url = new URL(req.url)
      const customerId = url.searchParams.get('user')

      if (!customerId) {
        return new Response(JSON.stringify({ error: 'Missing user parameter' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // 1. Hole den Kunden und seinen aktuellen Opt-Out Status
      const { data: customer, error: custErr } = await supabase
        .from('customers')
        .select('first_name, last_name, company_name, newsletter_opt_out, customer_newsletter_categories(category_id)')
        .eq('id', customerId)
        .single()

      if (custErr || !customer) {
        return new Response(JSON.stringify({ error: 'Customer not found' }), { 
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // 2. Hole alle verfügbaren Kategorien
      const { data: allCategories, error: catErr } = await supabase
        .from('newsletter_categories')
        .select('id, name, description')
        .order('name', { ascending: true })

      if (catErr) {
        return new Response(JSON.stringify({ error: 'Error loading categories' }), { 
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // 3. Finde heraus, welche Kategorien der Kunde aktiv abonniert hat
      const subscribedIds = customer.customer_newsletter_categories?.map((c: any) => c.category_id) || []

      const name = customer.company_name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim() || 'Kunde'

      return new Response(JSON.stringify({
        customer: { name, optOut: customer.newsletter_opt_out },
        categories: allCategories,
        subscribed: subscribedIds
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    if (req.method === 'POST') {
      const { userId, subscribedCategoryIds } = await req.json()
      
      if (!userId || !Array.isArray(subscribedCategoryIds)) {
        return new Response(JSON.stringify({ error: 'Invalid payload' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
      }

      // Opt-Out Logik: Wenn der Kunde gar keine Kategorie mehr abonniert hat, setzen wir ihn komplett auf opt_out = true.
      // Hat er Kategorien gewählt, setzen wir opt_out wieder auf false.
      const isCompletelyOptedOut = subscribedCategoryIds.length === 0

      // 1. Opt-Out Status updaten
      const { error: updateErr } = await supabase
        .from('customers')
        .update({ newsletter_opt_out: isCompletelyOptedOut })
        .eq('id', userId)

      if (updateErr) throw updateErr

      // 2. Alte Zuordnungen löschen
      const { error: delErr } = await supabase
        .from('customer_newsletter_categories')
        .delete()
        .eq('customer_id', userId)

      if (delErr) throw delErr

      // 3. Neue Zuordnungen hinzufügen
      if (subscribedCategoryIds.length > 0) {
        const inserts = subscribedCategoryIds.map((cid: string) => ({
          customer_id: userId,
          category_id: cid
        }))

        const { error: insErr } = await supabase
          .from('customer_newsletter_categories')
          .insert(inserts)

        if (insErr) throw insErr
      }

      return new Response(JSON.stringify({ success: true, isOptedOut: isCompletelyOptedOut }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    return new Response('Method Not Allowed', { status: 405, headers: corsHeaders })

  } catch (error: any) {
    return new Response(JSON.stringify({ error: String(error?.message) }), { 
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
