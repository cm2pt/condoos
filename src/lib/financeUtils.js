/**
 * Re-exportação utilitária de funções financeiras.
 * computeFinanceSummary é um alias semântico para buildFinanceBreakdown.
 */
export {
  buildFinanceBreakdown as computeFinanceSummary,
  buildFinanceBreakdown,
  buildFractionBalances,
  buildFloorMatrix,
  buildPeopleById,
  buildPrimaryOwnerByFraction,
  metricCards,
} from "./finance.js";
