import { describe, it, expect } from "vitest";
import {
  buildPeopleById,
  buildPrimaryOwnerByFraction,
  buildFinanceBreakdown,
  buildFractionBalances,
  buildFloorMatrix,
} from "./finance.js";

describe("buildPeopleById", () => {
  it("indexes people by id", () => {
    const people = [
      { id: "p1", fullName: "João" },
      { id: "p2", fullName: "Maria" },
    ];
    const result = buildPeopleById(people);
    expect(result.p1.fullName).toBe("João");
    expect(result.p2.fullName).toBe("Maria");
  });

  it("returns empty object for empty array", () => {
    expect(buildPeopleById([])).toEqual({});
  });
});

describe("buildPrimaryOwnerByFraction", () => {
  it("maps fraction to primary owner name", () => {
    const peopleById = { p1: { fullName: "João Silva" } };
    const data = {
      fractionParties: [
        { fractionId: "f1", personId: "p1", relationship: "owner", isPrimary: true },
        { fractionId: "f1", personId: "p2", relationship: "tenant", isPrimary: false },
      ],
    };
    const result = buildPrimaryOwnerByFraction(data, peopleById);
    expect(result.f1).toBe("João Silva");
  });

  it("shows 'Sem titular' when person not found", () => {
    const data = {
      fractionParties: [
        { fractionId: "f1", personId: "missing", relationship: "owner", isPrimary: true },
      ],
    };
    const result = buildPrimaryOwnerByFraction(data, {});
    expect(result.f1).toBe("Sem titular");
  });
});

describe("buildFinanceBreakdown", () => {
  it("calculates totals from charges and payments", () => {
    const data = {
      charges: [
        { id: "c1", fractionId: "f1", amount: 100, period: "2026-01", dueDate: "2026-01-08", status: "open" },
        { id: "c2", fractionId: "f1", amount: 100, period: "2026-02", dueDate: "2026-02-08", status: "overdue" },
      ],
      payments: [
        { id: "pay1", chargeId: "c1", fractionId: "f1", amount: 100, method: "mbway", paidAt: "2026-01-05" },
      ],
    };
    const result = buildFinanceBreakdown(data);
    expect(result.emitted).toBe(200);
    expect(result.collected).toBe(100);
    expect(result.overdue).toBe(100);
    expect(result.openBalance).toBe(100);
    expect(result.openCharges).toHaveLength(1);
    expect(result.byMethod.mbway).toBe(100);
  });

  it("handles empty data", () => {
    const result = buildFinanceBreakdown({ charges: [], payments: [] });
    expect(result.emitted).toBe(0);
    expect(result.collected).toBe(0);
    expect(result.openCharges).toHaveLength(0);
  });
});

describe("buildFractionBalances", () => {
  it("calculates balance per fraction", () => {
    const data = {
      charges: [
        { fractionId: "f1", amount: 200 },
        { fractionId: "f2", amount: 100 },
      ],
      payments: [
        { fractionId: "f1", amount: 150 },
      ],
    };
    const result = buildFractionBalances(data);
    expect(result.f1.balance).toBe(50);
    expect(result.f2.balance).toBe(100);
  });

  it("does not go negative", () => {
    const data = {
      charges: [{ fractionId: "f1", amount: 50 }],
      payments: [{ fractionId: "f1", amount: 100 }],
    };
    const result = buildFractionBalances(data);
    expect(result.f1.balance).toBe(0);
  });
});

describe("buildFloorMatrix", () => {
  it("groups fractions by floor", () => {
    const fractions = [
      { floorNumber: 1, type: "habitacao" },
      { floorNumber: 1, type: "loja" },
      { floorNumber: 2, type: "habitacao" },
    ];
    const result = buildFloorMatrix(fractions);
    expect(result).toHaveLength(2);
    const floor1 = result.find((f) => f.floor === 1);
    expect(floor1.total).toBe(2);
    expect(floor1.residential).toBe(1);
    expect(floor1.nonResidential).toBe(1);
  });

  it("sorts by floor descending", () => {
    const fractions = [
      { floorNumber: 1, type: "habitacao" },
      { floorNumber: 3, type: "habitacao" },
      { floorNumber: 2, type: "habitacao" },
    ];
    const result = buildFloorMatrix(fractions);
    expect(result[0].floor).toBe(3);
    expect(result[1].floor).toBe(2);
    expect(result[2].floor).toBe(1);
  });
});
