// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { TodayCard } from "@shared/today";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { MeProvider } from "@/hooks/useMe";
import { WorkCard } from "./WorkCard";

const me = { id: 1, displayName: "Jakub", roles: ["production" as const], activeCompanyId: 1, companies: [{ id: 1, name: "Solovya" }] };
const card = (p: Partial<TodayCard>): TodayCard => ({
  id: "t1",
  companyId: 1,
  processType: "production",
  reference: "MO-1",
  product: "Lemon Haze",
  quantity: 120,
  unit: "pcs",
  responsible: "Jakub",
  status: "open",
  action: "openTask",
  ...p,
});
const show = (c: TodayCard) =>
  render(
    <LanguageProvider>
      <MeProvider me={me}>
        <WorkCard card={c} />
      </MeProvider>
    </LanguageProvider>,
  );

afterEach(cleanup);

describe("WorkCard (Muster A)", () => {
  it("shows company, reference, quantity, one main action and the safe way out", () => {
    show(card({}));
    expect(screen.getByText("Lemon Haze")).toBeTruthy();
    expect(screen.getByText(/Solovya · MO-1 · 120 Stk\./)).toBeTruthy();
    const links = screen.getAllByRole("link");
    expect(links.map((l) => l.textContent)).toEqual(["Fertigung öffnen", "Etwas passt nicht"]);
    expect(links[0]!.getAttribute("href")).toBe("/aufgabe/t1");
  });

  it("waiting for Vincent has no second work button", () => {
    show(card({ status: "review", action: "viewDetails" }));
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Details ansehen"]);
    expect(screen.getByText("Vincent prüft – du musst nichts mehr buchen")).toBeTruthy();
  });

  it("a stop card names the reason and offers only the clarification", () => {
    show(card({ status: "blocked", action: "openClarification", blockReason: "lot" }));
    expect(screen.getByText("Lot unklar")).toBeTruthy();
    expect(screen.getAllByRole("link").map((l) => l.textContent)).toEqual(["Klärung öffnen"]);
  });
});
