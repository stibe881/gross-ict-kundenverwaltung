import fetch from 'node-fetch';

async function test() {
    const res = await fetch('https://gross-ict.ch');
    const text = await res.text();
    const matches = [...text.matchAll(/<script[^>]+src=["'](.*?)["']/g)];
    for (const match of matches) {
        const src = match[1];
        if (src.endsWith('.js')) {
            const jsUrl = new URL(src, 'https://gross-ict.ch').href;
            console.log("Fetching JS:", jsUrl);
            const jsRes = await fetch(jsUrl);
            const jsText = await jsRes.text();
            console.log("Contains impressum?", jsText.toLowerCase().includes('impressum'));
        }
    }
}
test();
