const fs = require('fs');
const file = 'lib/data.ts';

const appendContent = `
// -----------------------------
// Ticket Items (Time Tracking & Positions)
// -----------------------------

export async function getTicketItems(ticketId: string) {
    const { data, error } = await supabase
        .from('ticket_items')
        .select('*, product:product_id ( id, name, price, type, unit, vat_rate )')
        .eq('ticket_id', ticketId)
        .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
}

export async function addTicketItem(item: any) {
    const { data, error } = await supabase
        .from('ticket_items')
        .insert([item])
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteTicketItem(id: string) {
    const { error } = await supabase
        .from('ticket_items')
        .delete()
        .eq('id', id);

    if (error) throw new Error(error.message);
    return { success: true };
}

export async function getProducts() {
    const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
}
`;

fs.appendFileSync(file, appendContent);
console.log('Successfully appended ticket items logic to lib/data.ts');
