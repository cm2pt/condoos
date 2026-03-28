import express from "express";
import chargesRouter from "./charges.js";
import paymentsRouter from "./payments.js";
import reconciliationRouter from "./reconciliation.js";

const router = express.Router();

router.use(chargesRouter);
router.use(paymentsRouter);
router.use(reconciliationRouter);

export default router;
