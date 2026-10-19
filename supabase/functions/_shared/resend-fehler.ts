// Liest den lesbaren Grund aus einer Fehlerantwort von Resend ({"message":"…","name":"…"}).
// So sieht man in der App z. B. «The gross-ict.ch domain is not verified» statt nur «nicht gesendet».
export function resendGrund(errBody: string): string {
  try {
    const j = JSON.parse(errBody);
    return String(j?.message || j?.error?.message || errBody).slice(0, 300);
  } catch {
    return String(errBody).slice(0, 300);
  }
}
