import { formatCurrency, numberFormatter } from "./formatters.js";

export function buildPeopleById(people) {
  return Object.fromEntries(people.map((person) => [person.id, person]));
}

export function buildPrimaryOwnerByFraction(data, peopleById) {
  const ownerMap = {};

  data.fractionParties
    .filter((item) => item.relationship === "owner" && item.isPrimary)
    .forEach((item) => {
      ownerMap[item.fractionId] = peopleById[item.personId]?.fullName ?? "Sem titular";
    });

  return ownerMap;
}

export function buildFinanceBreakdown(data) {
  const chargeById = Object.fromEntries(data.charges.map((charge) => [charge.id, charge]));

  const summary = {
    emitted: data.charges.reduce((sum, charge) => sum + charge.amount, 0),
    collected: data.payments.reduce((sum, payment) => sum + payment.amount, 0),
    overdue: data.charges
      .filter((charge) => charge.status === "overdue")
      .reduce((sum, charge) => sum + charge.amount, 0),
    openBalance: 0,
    byMethod: {},
    monthly: {},
    openCharges: [],
  };

  for (const charge of data.charges) {
    const paidForCharge = data.payments
      .filter((payment) => payment.chargeId === charge.id)
      .reduce((sum, payment) => sum + payment.amount, 0);

    const missing = Math.max(charge.amount - paidForCharge, 0);
    summary.openBalance += missing;

    if (missing > 0.009) {
      summary.openCharges.push({
        ...charge,
        missing,
      });
    }

    const monthEntry = summary.monthly[charge.period] || { emitted: 0, collected: 0 };
    monthEntry.emitted += charge.amount;
    summary.monthly[charge.period] = monthEntry;
  }

  for (const payment of data.payments) {
    summary.byMethod[payment.method] = (summary.byMethod[payment.method] || 0) + payment.amount;

    const charge = chargeById[payment.chargeId];
    if (charge) {
      const monthEntry = summary.monthly[charge.period] || { emitted: 0, collected: 0 };
      monthEntry.collected += payment.amount;
      summary.monthly[charge.period] = monthEntry;
    }
  }

  summary.openCharges.sort((a, b) => {
    if (a.status === b.status) {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }

    if (a.status === "overdue") {
      return -1;
    }

    if (b.status === "overdue") {
      return 1;
    }

    return 0;
  });

  return summary;
}

export function buildFractionBalances(data) {
  const totals = {};

  for (const charge of data.charges) {
    totals[charge.fractionId] = totals[charge.fractionId] || { emitted: 0, paid: 0 };
    totals[charge.fractionId].emitted += charge.amount;
  }

  for (const payment of data.payments) {
    totals[payment.fractionId] = totals[payment.fractionId] || { emitted: 0, paid: 0 };
    totals[payment.fractionId].paid += payment.amount;
  }

  return Object.fromEntries(
    Object.entries(totals).map(([fractionId, values]) => [
      fractionId,
      {
        emitted: values.emitted,
        paid: values.paid,
        balance: Math.max(values.emitted - values.paid, 0),
      },
    ])
  );
}

export function buildFloorMatrix(fractions) {
  const byFloor = fractions.reduce((acc, fraction) => {
    if (!acc[fraction.floorNumber]) {
      acc[fraction.floorNumber] = {
        floor: fraction.floorNumber,
        total: 0,
        residential: 0,
        nonResidential: 0,
      };
    }

    acc[fraction.floorNumber].total += 1;
    if (fraction.type === "habitacao") {
      acc[fraction.floorNumber].residential += 1;
    } else {
      acc[fraction.floorNumber].nonResidential += 1;
    }

    return acc;
  }, {});

  return Object.values(byFloor).sort((a, b) => b.floor - a.floor);
}

export function metricCards(data, finance) {
  const collectionRate = finance.emitted > 0 ? (finance.collected / finance.emitted) * 100 : 0;

  return [
    {
      label: "Taxa de cobrança",
      value: `${collectionRate.toFixed(1)}%`,
      detail: `${formatCurrency(finance.collected)} recebidos`,
      tone: "accent",
    },
    {
      label: "Saldo em aberto",
      value: formatCurrency(finance.openBalance),
      detail: `${finance.openCharges.length} encargos pendentes`,
      tone: "warning",
    },
    {
      label: "Ocorrências abertas",
      value: numberFormatter.format(
        data.issues.filter((issue) => ["new", "triage", "in_progress", "waiting_supplier"].includes(issue.status)).length
      ),
      detail: `${data.issues.filter((issue) => issue.priority === "critical").length} críticas`,
      tone: "danger",
    },
    {
      label: "SLA médio",
      value: `${data.kpisSnapshot.avgResolutionHours}h`,
      detail: "Resolução média",
      tone: "neutral",
    },
  ];
}
