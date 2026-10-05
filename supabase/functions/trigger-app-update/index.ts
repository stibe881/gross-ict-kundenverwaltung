import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const GITHUB_REPO = "stibe881/gross-ict-kundenverwaltung";
const WORKFLOW_FILE = "app-release.yml";
// Separater Workflow für die öffentliche Webseite gross-ict.ch —
// bewusst NICHT Teil von "Alles aktualisieren"
const WEBSITE_WORKFLOW_FILE = "website-deploy.yml";

function githubHeaders() {
  const token = Deno.env.get("GITHUB_PAT");
  if (!token) throw new Error("GITHUB_PAT ist nicht gesetzt (supabase secrets set GITHUB_PAT=github_pat_...)");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

// Nur Admins dürfen Releases auslösen
async function requireAdmin(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) throw new Error("Nicht eingeloggt");

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data: userData, error } = await supabaseAdmin.auth.getUser(jwt);
  if (error || !userData?.user) throw new Error("Nicht eingeloggt");

  const { data: profile } = await supabaseAdmin
    .from("users")
    .select("roles")
    .eq("id", userData.user.id)
    .single();
  if (!profile?.roles?.includes("admin")) throw new Error("Nur Admins dürfen App-Updates auslösen");
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, bump, target } = await req.json();
    await requireAdmin(req);

    if (action === "trigger") {
      // Webseite: eigener Workflow ohne Versions-Logik
      if (target === "website") {
        const res = await fetch(
          `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WEBSITE_WORKFLOW_FILE}/dispatches`,
          {
            method: "POST",
            headers: githubHeaders(),
            body: JSON.stringify({ ref: "main" }),
          }
        );
        if (res.status !== 204) {
          const body = await res.text();
          throw new Error(`Webseiten-Deploy konnte nicht gestartet werden (${res.status}): ${body}`);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const validBump = ["build", "patch", "minor"].includes(bump) ? bump : "build";
      const validTarget = ["all", "apps", "web"].includes(target) ? target : "all";
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
        {
          method: "POST",
          headers: githubHeaders(),
          body: JSON.stringify({ ref: "main", inputs: { bump: validBump, target: validTarget } }),
        }
      );
      if (res.status !== 204) {
        const body = await res.text();
        throw new Error(`GitHub Workflow konnte nicht gestartet werden (${res.status}): ${body}`);
      }
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === "status") {
      const workflowFile = target === "website" ? WEBSITE_WORKFLOW_FILE : WORKFLOW_FILE;
      const res = await fetch(
        `https://api.github.com/repos/${GITHUB_REPO}/actions/workflows/${workflowFile}/runs?per_page=1`,
        { headers: githubHeaders() }
      );
      const data = await res.json();
      const run = data?.workflow_runs?.[0];
      return new Response(JSON.stringify(run ? {
        status: run.status,           // queued | in_progress | completed
        conclusion: run.conclusion,   // success | failure | null
        created_at: run.created_at,
        html_url: run.html_url,
      } : { status: "none" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    throw new Error(`Unbekannte Aktion: ${action}`);
  } catch (error) {
    console.error("[trigger-app-update] Error:", error);
    return new Response(JSON.stringify({
      error: error instanceof Error ? error.message : String(error),
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
})
