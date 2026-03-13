import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { GoogleGenerativeAI, Part } from "https://esm.sh/@google/generative-ai@0.21.0";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
    // Handle CORS preflight requests
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }

    try {
        const apiKey = Deno.env.get("GEMINI_API_KEY");
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is missing in Edge Function environment variables.");
        }

        const { fileBase64, mimeType } = await req.json();

        if (!fileBase64 || !mimeType) {
            throw new Error("fileBase64 and mimeType are required.");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        // Use gemini-2.5-flash since it is supported by the user's Gemini API key
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
            Please analyze this receipt/invoice and extract the following information.
            Return the result STRICTLY as a raw JSON object with no markdown formatting or extra text.
            If a value cannot be found, use null or a sensible default as described below.

            {
                "amount": <number, the total amount to pay including tax>,
                "date": <string, the date of the receipt in YYYY-MM-DD format, or today's date if not found>,
                "supplier": <string, the name of the company/store/restaurant. Be concise.>,
                "description": <string, a very short 1-4 word summary of what this was (e.g. "Mittagessen", "Software Abo", "Büromaterial")>,
                "tax_rate": <number, estimate the highest VAT percentage based on the text. In Switzerland this is usually 8.1, 2.6, 3.8, or 0. If unknown default to 0>
            }
        `;

        const imageParts: Part[] = [
            {
                inlineData: {
                    data: fileBase64,
                    mimeType: mimeType,
                },
            },
        ];

        const result = await model.generateContent([prompt, ...imageParts]);
        const responseText = result.response.text();

        // Clean up markdown markers if Gemini still includes them despite instructions
        let cleanJson = responseText.trim();
        if (cleanJson.startsWith('```json')) {
            cleanJson = cleanJson.substring(7);
        }
        if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.substring(3);
        }
        if (cleanJson.endsWith('```')) {
            cleanJson = cleanJson.substring(0, cleanJson.length - 3);
        }
        
        const extractedData = JSON.parse(cleanJson);

        return new Response(JSON.stringify(extractedData), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (error: any) {
        console.error("Error in analyze-receipt function:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
        );
    }
});
