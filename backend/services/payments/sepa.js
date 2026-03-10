/**
 * SEPA Direct Debit XML generation (ISO 20022 pain.008.001.02).
 * Generates a pain.008 XML file for batch direct debit collection.
 */

/**
 * Generate a SEPA Direct Debit XML document.
 * @param {{ creditorName: string, creditorIBAN: string, creditorBIC: string, creditorId: string, payments: Array<{ mandateId: string, debtorName: string, debtorIBAN: string, debtorBIC: string, amount: number, reference: string, dueDate: string }> }} params
 * @returns {string} ISO 20022 pain.008.001.02 XML
 */
export function generateSepaDirectDebitXml({
  creditorName,
  creditorIBAN,
  creditorBIC,
  creditorId,
  payments,
  msgId,
}) {
  const messageId = msgId || `CONDOOS-${Date.now()}`;
  const creationDate = new Date().toISOString().slice(0, 19);
  const totalAmount = payments.reduce((sum, p) => sum + Number(p.amount), 0).toFixed(2);
  const numberOfTransactions = payments.length;

  const txElements = payments.map((p) => `
    <DrctDbtTxInf>
      <PmtId>
        <EndToEndId>${escapeXml(p.reference)}</EndToEndId>
      </PmtId>
      <InstdAmt Ccy="EUR">${Number(p.amount).toFixed(2)}</InstdAmt>
      <DrctDbtTx>
        <MndtRltdInf>
          <MndtId>${escapeXml(p.mandateId)}</MndtId>
          <DtOfSgntr>${escapeXml(p.dueDate)}</DtOfSgntr>
        </MndtRltdInf>
      </DrctDbtTx>
      <DbtrAgt>
        <FinInstnId>
          <BIC>${escapeXml(p.debtorBIC || "NOTPROVIDED")}</BIC>
        </FinInstnId>
      </DbtrAgt>
      <Dbtr>
        <Nm>${escapeXml(p.debtorName)}</Nm>
      </Dbtr>
      <DbtrAcct>
        <Id>
          <IBAN>${escapeXml(p.debtorIBAN)}</IBAN>
        </Id>
      </DbtrAcct>
      <RmtInf>
        <Ustrd>${escapeXml(p.reference)}</Ustrd>
      </RmtInf>
    </DrctDbtTxInf>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.008.001.02">
  <CstmrDrctDbtInitn>
    <GrpHdr>
      <MsgId>${escapeXml(messageId)}</MsgId>
      <CreDtTm>${creationDate}</CreDtTm>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${totalAmount}</CtrlSum>
      <InitgPty>
        <Nm>${escapeXml(creditorName)}</Nm>
      </InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>${escapeXml(messageId)}-PMT</PmtInfId>
      <PmtMtd>DD</PmtMtd>
      <NbOfTxs>${numberOfTransactions}</NbOfTxs>
      <CtrlSum>${totalAmount}</CtrlSum>
      <PmtTpInf>
        <SvcLvl>
          <Cd>SEPA</Cd>
        </SvcLvl>
        <LclInstrm>
          <Cd>CORE</Cd>
        </LclInstrm>
        <SeqTp>RCUR</SeqTp>
      </PmtTpInf>
      <ReqdColltnDt>${payments[0]?.dueDate || new Date().toISOString().slice(0, 10)}</ReqdColltnDt>
      <Cdtr>
        <Nm>${escapeXml(creditorName)}</Nm>
      </Cdtr>
      <CdtrAcct>
        <Id>
          <IBAN>${escapeXml(creditorIBAN)}</IBAN>
        </Id>
      </CdtrAcct>
      <CdtrAgt>
        <FinInstnId>
          <BIC>${escapeXml(creditorBIC)}</BIC>
        </FinInstnId>
      </CdtrAgt>
      <CdtrSchmeId>
        <Id>
          <PrvtId>
            <Othr>
              <Id>${escapeXml(creditorId)}</Id>
              <SchmeNm>
                <Prtry>SEPA</Prtry>
              </SchmeNm>
            </Othr>
          </PrvtId>
        </Id>
      </CdtrSchmeId>${txElements}
    </PmtInf>
  </CstmrDrctDbtInitn>
</Document>`;
}

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
