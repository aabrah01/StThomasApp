/**
 * Supabase Edge Function — QuickBooks Web Connector (QBWC) endpoint
 *
 * QBWC Setup (on the Windows machine running QuickBooks Desktop):
 *   1. Install QuickBooks Web Connector (free from Intuit).
 *   2. Create a .qwc file (see /supabase/qbwc-config.qwc) and open it in QBWC.
 *   3. Set the endpoint URL to this function's URL:
 *      https://<project-ref>.supabase.co/functions/v1/qbwc-sync
 *   4. Set QBWC_USERNAME and QBWC_PASSWORD in Supabase Edge Function secrets.
 *   5. Schedule the sync in QBWC (e.g. every night at midnight).
 *
 * How it works:
 *   1. QBWC calls authenticate()  → we validate credentials, issue a session ticket
 *   2. QBWC calls sendRequestXML() → we return a QB XML query for this year's Sales Receipts
 *   3. QBWC calls receiveResponseXML() → we parse the QB response and upsert to `contributions`
 *   4. QBWC calls closeConnection() → we clean up the session
 *
 * QB data mapping:
 *   QB Customer (FullName)  → matched to families.family_name
 *   QB TxnDate              → contributions.date
 *   QB line item Amount     → contributions.amount
 *   QB line item Item/Desc  → contributions.category  (imported as-is from QB)
 *   QB Memo                 → contributions.description
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const QBWC_USERNAME    = Deno.env.get('QBWC_USERNAME') ?? 'qbwc';
const QBWC_PASSWORD    = Deno.env.get('QBWC_PASSWORD') ?? '';
const SUPABASE_URL     = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SVC_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SVC_KEY);

// ── XML helpers ───────────────────────────────────────────────────────────────

/** Extract the first value of a tag (non-nested). */
const getTag = (xml: string, tag: string): string => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'));
  return m ? m[1].trim() : '';
};

/** Extract all occurrences of a tag block (may contain nested XML). */
const getAllBlocks = (xml: string, tag: string): string[] => {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
};

// ── SOAP builders ─────────────────────────────────────────────────────────────

const XML_HEADER = '<?xml version="1.0" encoding="utf-8"?>';
const NS = 'http://developer.intuit.com/qbwc/rdng';

const soapEnvelope = (action: string, inner: string) =>
  `${XML_HEADER}
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <${action}Response xmlns="${NS}">
      <${action}Result>${inner}</${action}Result>
    </${action}Response>
  </soap:Body>
</soap:Envelope>`;

const str  = (v: string) => `<string>${v}</string>`;
const int  = (v: number) => `<int>${v}</int>`;

// ── QB query XML ──────────────────────────────────────────────────────────────

/**
 * Request all Sales Receipts for the current fiscal year.
 * Most churches record contributions as Sales Receipts with the donor family
 * as the Customer and the donation type as the line-item Product/Service.
 *
 * If your church uses a different QB transaction type, change
 * SalesReceiptQueryRq → DepositQueryRq or ReceivePaymentQueryRq.
 */
const buildQBQuery = (): string => {
  const year = new Date().getFullYear();
  return `<?xml version="1.0" encoding="utf-8"?>
<?qbxml version="13.0"?>
<QBXML>
  <QBXMLMsgsRq onError="stopOnError">
    <SalesReceiptQueryRq requestID="1">
      <TxnDateRangeFilter>
        <FromTxnDate>${year}-01-01</FromTxnDate>
        <ToTxnDate>${year}-12-31</ToTxnDate>
      </TxnDateRangeFilter>
      <IncludeLineItems>true</IncludeLineItems>
    </SalesReceiptQueryRq>
  </QBXMLMsgsRq>
</QBXML>`;
};

// ── Response processor ────────────────────────────────────────────────────────

const processQBResponse = async (qbXml: string): Promise<void> => {
  const receipts = getAllBlocks(qbXml, 'SalesReceiptRet');
  console.log(`Processing ${receipts.length} QB Sales Receipt(s)`);

  for (const receipt of receipts) {
    const txnId       = getTag(receipt, 'TxnID');
    const txnDate     = getTag(receipt, 'TxnDate');       // YYYY-MM-DD
    const memo        = getTag(receipt, 'Memo');
    // CustomerRef/FullName is the QB customer = the donor family name
    const customerRef = getAllBlocks(receipt, 'CustomerRef')[0] ?? '';
    const customerName = getTag(customerRef, 'FullName') || getTag(customerRef, 'ListID');

    if (!customerName) {
      console.warn(`Skipping receipt ${txnId} — no customer name`);
      continue;
    }

    // Match QB customer name to a family in the directory
    const { data: family, error: familyErr } = await supabase
      .from('families')
      .select('id')
      .ilike('family_name', `%${customerName.replace(' Family', '')}%`)
      .limit(1)
      .single();

    if (familyErr || !family) {
      console.warn(`No family match for QB customer "${customerName}" — skipping`);
      continue;
    }

    const lineItems = getAllBlocks(receipt, 'SalesReceiptLineRet');

    if (lineItems.length > 0) {
      for (let i = 0; i < lineItems.length; i++) {
        const line   = lineItems[i];
        const amount = parseFloat(getTag(line, 'Amount') || '0');
        if (amount <= 0) continue;

        // Item name is used as the category — imported as-is from QB
        const itemRef  = getAllBlocks(line, 'ItemRef')[0] ?? '';
        const category = getTag(itemRef, 'FullName') || getTag(line, 'Desc') || 'General';
        const desc     = getTag(line, 'Desc') || memo;

        await supabase.from('contributions').upsert({
          id:          `${txnId}-${i}`,   // deterministic → safe to re-run
          family_id:   family.id,
          amount,
          date:        txnDate,
          category,
          description: desc,
        }, { onConflict: 'id' });
      }
    } else {
      // No line items — use the receipt total
      const amount = parseFloat(getTag(receipt, 'TotalAmount') || '0');
      if (amount <= 0) continue;

      await supabase.from('contributions').upsert({
        id:          txnId,
        family_id:   family.id,
        amount,
        date:        txnDate,
        category:    'General',
        description: memo,
      }, { onConflict: 'id' });
    }
  }
};

// ── Detect SOAP action ────────────────────────────────────────────────────────

const detectAction = (soapHeader: string | null, body: string): string => {
  if (soapHeader) return soapHeader.replace(/"/g, '').split('/').pop() ?? '';
  const m = body.match(/<([a-zA-Z]+)\s[^>]*xmlns="[^"]*intuit[^"]*"/) ||
            body.match(/<soap:Body>\s*<([a-zA-Z]+)[\s>]/);
  return m?.[1] ?? '';
};

// ── Main handler ──────────────────────────────────────────────────────────────

const HEADERS = { 'Content-Type': 'text/xml; charset=utf-8' };

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const body   = await req.text();
  const action = detectAction(req.headers.get('SOAPAction'), body);

  console.log(`QBWC action: ${action}`);

  try {
    // ── serverVersion ──────────────────────────────────────────────────────
    if (action === 'serverVersion') {
      return new Response(soapEnvelope('serverVersion', str('1.0')), { headers: HEADERS });
    }

    // ── clientVersion ──────────────────────────────────────────────────────
    if (action === 'clientVersion') {
      return new Response(soapEnvelope('clientVersion', str('')), { headers: HEADERS });
    }

    // ── authenticate ───────────────────────────────────────────────────────
    if (action === 'authenticate') {
      const username = getTag(body, 'strUserName');
      const password = getTag(body, 'strPassword');

      if (username !== QBWC_USERNAME || password !== QBWC_PASSWORD) {
        console.warn(`QBWC auth failed for user "${username}"`);
        return new Response(
          soapEnvelope('authenticate', str('') + str('nvu')),
          { headers: HEADERS },
        );
      }

      const ticket = crypto.randomUUID();
      await supabase.from('qbwc_sessions').insert({ ticket, status: 'authenticated' });
      console.log(`QBWC session created: ${ticket}`);

      // Return [ticket, ""] — empty string = use currently open QB company file
      return new Response(
        soapEnvelope('authenticate', str(ticket) + str('')),
        { headers: HEADERS },
      );
    }

    // ── sendRequestXML ─────────────────────────────────────────────────────
    if (action === 'sendRequestXML') {
      const ticket = getTag(body, 'ticket');
      const { data: session } = await supabase
        .from('qbwc_sessions').select('status').eq('ticket', ticket).single();

      if (!session || session.status === 'done' || session.status === 'error') {
        return new Response(soapEnvelope('sendRequestXML', str('')), { headers: HEADERS });
      }

      await supabase.from('qbwc_sessions')
        .update({ status: 'pending_response' }).eq('ticket', ticket);

      return new Response(
        soapEnvelope('sendRequestXML', str(buildQBQuery())),
        { headers: HEADERS },
      );
    }

    // ── receiveResponseXML ─────────────────────────────────────────────────
    if (action === 'receiveResponseXML') {
      const ticket   = getTag(body, 'ticket');
      const qbXml    = getTag(body, 'response');
      const hresult  = getTag(body, 'hresult');

      if (hresult && hresult !== '0x00000000') {
        const msg = getTag(body, 'message');
        console.error(`QB returned error ${hresult}: ${msg}`);
        await supabase.from('qbwc_sessions').update({ status: 'error' }).eq('ticket', ticket);
        // Return -1 → QBWC will call getLastError
        return new Response(soapEnvelope('receiveResponseXML', int(-1)), { headers: HEADERS });
      }

      await processQBResponse(qbXml);
      await supabase.from('qbwc_sessions').update({ status: 'done' }).eq('ticket', ticket);

      // Return 100 → sync complete
      return new Response(soapEnvelope('receiveResponseXML', int(100)), { headers: HEADERS });
    }

    // ── getLastError ───────────────────────────────────────────────────────
    if (action === 'getLastError') {
      const ticket = getTag(body, 'ticket');
      const { data: session } = await supabase
        .from('qbwc_sessions').select('status').eq('ticket', ticket).single();
      const msg = session?.status === 'error' ? 'QB sync failed — check Edge Function logs' : '';
      return new Response(soapEnvelope('getLastError', str(msg)), { headers: HEADERS });
    }

    // ── closeConnection ────────────────────────────────────────────────────
    if (action === 'closeConnection') {
      const ticket = getTag(body, 'ticket');
      await supabase.from('qbwc_sessions').delete().eq('ticket', ticket);
      console.log(`QBWC session closed: ${ticket}`);
      return new Response(soapEnvelope('closeConnection', str('OK')), { headers: HEADERS });
    }

    console.warn(`Unknown QBWC action: "${action}"`);
    return new Response('Unknown SOAP action', { status: 400 });

  } catch (err) {
    console.error('QBWC handler error:', err);
    return new Response('Internal Server Error', { status: 500 });
  }
});
