import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import * as Data from "@/lib/data";

// Nur-Lesen-Rolle: users.read_only = true blendet Erstellen/Löschen-Aktionen aus.
// Reine UI-Massnahme für Gast-Zugänge (z.B. Treuhänder) – ergänzt die Rollenrechte.
export function useIsReadOnly(): boolean {
    const { data: sessionData } = useQuery({
        queryKey: ["currentSession"],
        queryFn: async () => {
            const { data } = await supabase.auth.getSession();
            return data.session;
        },
    });

    const { data: userProfile } = useQuery({
        queryKey: ["userProfile", sessionData?.user?.id],
        queryFn: () => Data.getUserProfile(sessionData?.user?.id as string),
        enabled: !!sessionData?.user?.id,
    });

    return (userProfile as any)?.read_only === true;
}
