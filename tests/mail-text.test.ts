import { describe, expect, it } from "vitest";
import { htmlZuText } from "../supabase/functions/_shared/mail-text";

describe("Textfassung der Mail", () => {
  it("macht aus Absätzen und Zeilenumbrüchen lesbaren Text", () => {
    expect(htmlZuText("<p>Sehr geehrte Damen und Herren,</p><p>anbei die Rechnung <strong>RE-1</strong>.</p>Freundliche Grüsse<br/>Gross ICT"))
      .toBe("Sehr geehrte Damen und Herren,\nanbei die Rechnung RE-1.\nFreundliche Grüsse\nGross ICT");
  });
  it("nennt die Adresse eines Links im Text", () => {
    expect(htmlZuText('<a href="https://example.ch/zahlen">Jetzt online bezahlen</a>')).toBe("Jetzt online bezahlen: https://example.ch/zahlen");
  });
  it("lässt Zählpixel, Styles und Skripte weg", () => {
    const t = htmlZuText('<style>p{color:red}</style><p>Hallo</p><img src="https://x.ch/pixel" width="1" height="1" />');
    expect(t).toBe("Hallo");
  });
  it("löst gängige Zeichencodes auf", () => {
    expect(htmlZuText("<p>A&nbsp;&amp;&nbsp;B</p>")).toBe("A & B");
  });
  it("gibt Tabellenzeilen untereinander wieder", () => {
    const t = htmlZuText("<table><tr><td>Betrag:</td><td>CHF 52.50</td></tr><tr><td>Fällig:</td><td>30.10.2026</td></tr></table>");
    expect(t.split("\n")).toEqual(["Betrag: CHF 52.50", "Fällig: 30.10.2026"]);
  });
});
