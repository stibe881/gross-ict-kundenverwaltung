const fs = require('fs');
const dotenvStr = fs.readFileSync('.env', 'utf8');
const lines = dotenvStr.split('\n');
const env = {};
lines.forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2].trim();
});

const API_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const URL = env.EXPO_PUBLIC_SUPABASE_URL;

async function check() {
    const email = 'diatest55@gross-ict.ch';
    const password = 'TestPassword123!';

    // Create user using REST API directly to avoid dependencies
    console.log("Creating user via direct REST API...");
    const createRes = await fetch(`${URL}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
            'apikey': SERVICE_KEY,
            'Authorization': `Bearer ${SERVICE_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            email,
            password,
            email_confirm: true
        })
    });

    const createData = await createRes.json();
    console.log("Create response:", createData);

    if (createData.id) {
        console.log("Successfully created Auth user:", createData.id);
        // test login
        const loginRes = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': API_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email,
                password
            })
        });
        const loginData = await loginRes.json();
        console.log("Login res:", loginData.user ? "Success" : loginData.error_description || loginData.msg);

        // cleanup
        await fetch(`${URL}/auth/v1/admin/users/${createData.id}`, {
            method: 'DELETE',
            headers: {
                'apikey': SERVICE_KEY,
                'Authorization': `Bearer ${SERVICE_KEY}`
            }
        });
        console.log("Cleaned up user");
    } else {
        console.error("Failed to create user");
    }
}

check();
