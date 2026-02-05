import { describe, it, expect } from 'vitest';

describe('Supabase Connection', () => {
  it('should have valid Supabase credentials', () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    expect(url).toBeDefined();
    expect(key).toBeDefined();
    expect(url).toMatch(/^https:\/\/.+\.supabase\.co$/);
    expect(key).toMatch(/^eyJ/); // JWT tokens start with eyJ
  });

  it('should be able to connect to Supabase', async () => {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;

    // Test basic connectivity by calling the REST API
    const response = await fetch(`${url}/rest/v1/`, {
      headers: {
        'apikey': key!,
        'Authorization': `Bearer ${key}`,
      },
    });

    // Should return 200 or 404 (no tables yet), not 401 (unauthorized)
    expect([200, 404]).toContain(response.status);
  });
});
