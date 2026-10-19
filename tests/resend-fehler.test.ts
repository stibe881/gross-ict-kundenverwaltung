import { describe, expect, it } from "vitest";
import { resendGrund } from "../supabase/functions/_shared/resend-fehler";

describe("Grund aus der Resend-Fehlerantwort", () => {
  it("liest message aus dem JSON", () => {
    expect(resendGrund('{"message":"The gross-ict.ch domain is not verified.","name":"validation_error","statusCode":403}'))
      .toBe("The gross-ict.ch domain is not verified.");
  });
  it("liest verschachtelte Fehler", () => {
    expect(resendGrund('{"error":{"message":"Too many requests"}}')).toBe("Too many requests");
  });
  it("gibt kein-JSON-Text gekürzt zurück", () => {
    expect(resendGrund("Bad Gateway")).toBe("Bad Gateway");
    expect(resendGrund("x".repeat(500))).toHaveLength(300);
  });
});
