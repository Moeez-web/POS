import { Injectable } from '@angular/core';

/** Builds and prints a thermal-printer receipt from a sale + shop settings. */
@Injectable({ providedIn: 'root' })
export class ReceiptService {
  private esc = (t: unknown) => String(t ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
  private money = (m: unknown) => (Number(m || 0) / 100).toFixed(2);

  /** Returns the receipt HTML for a sale (also used for an on-screen view). */
  html(sale: any, s: Record<string, string>): string {
    const widthMm = s['receipt_paper_width'] === '58' ? 58 : 80;
    const cur = s['currency'] || '';
    const itemRows = (sale.items || [])
      .map(
        (it: any) =>
          `<tr><td>${this.esc(it.product_name)}</td><td class="c">${it.qty}</td><td class="r">${this.money(it.unit_price_minor)}</td><td class="r">${this.money(it.line_total_minor)}</td></tr>`,
      )
      .join('');
    const addr = this.esc(s['shop_address'] || '');
    const phone = this.esc(s['shop_phone'] || '');
    const header = this.esc(s['receipt_header'] || '');
    const when = sale.created_at ? new Date(sale.created_at).toLocaleString() : new Date().toLocaleString();

    return `<!doctype html><html><head><meta charset="utf-8"><title>${this.esc(sale.invoice_no)}</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 0; }
  body { width: ${widthMm}mm; margin: 0; padding: 6px 8px; font-family: 'Courier New', monospace; font-size: 12px; color:#000; }
  .center{text-align:center} .shop{font-size:15px;font-weight:bold} .muted{font-size:11px}
  .brand{font-size:13px;font-weight:bold;letter-spacing:.5px;margin-top:2px} .logo{display:block;margin:0 auto}
  hr{border:none;border-top:1px dashed #000;margin:6px 0}
  table{width:100%;border-collapse:collapse} td{padding:1px 0;vertical-align:top}
  .r{text-align:right} .c{text-align:center} .grand{font-size:14px;font-weight:bold}
  .promo{margin-top:8px;font-size:10px}
</style></head><body>
  <div class="center">
    <svg class="logo" width="40" height="40" viewBox="0 0 64 64" fill="none" stroke="#000" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 25 L18 15 H46 L50 25 Z"/>
      <path d="M14 25 q4.5 5 9 0 q4.5 5 9 0 q4.5 5 9 0 q4.5 5 9 0"/>
      <path d="M18 30 V49 H46 V30"/>
      <path d="M28 49 V38 H36 V49"/>
    </svg>
    <div class="brand">CounterPro</div>
    <div class="shop">${this.esc(s['shop_name'] || 'My Store')}</div>
    ${addr ? `<div class="muted">${addr}</div>` : ''}
    ${phone ? `<div class="muted">Tel: ${phone}</div>` : ''}
    ${header ? `<div class="muted">${header}</div>` : ''}
  </div>
  <hr>
  <div class="muted">Invoice: <b>${this.esc(sale.invoice_no)}</b></div>
  <div class="muted">Date: ${this.esc(when)}</div>
  <hr>
  <table>
    <tr><td><b>Item</b></td><td class="c"><b>Qty</b></td><td class="r"><b>Price</b></td><td class="r"><b>Amt</b></td></tr>
    ${itemRows}
  </table>
  <hr>
  <table>
    <tr><td>Subtotal</td><td class="r">${this.money(sale.subtotal_minor)}</td></tr>
    ${sale.discount_minor ? `<tr><td>Discount</td><td class="r">-${this.money(sale.discount_minor)}</td></tr>` : ''}
    <tr><td>Tax</td><td class="r">${this.money(sale.tax_minor)}</td></tr>
    <tr class="grand"><td>TOTAL</td><td class="r">${cur} ${this.money(sale.total_minor)}</td></tr>
    <tr><td>Paid</td><td class="r">${this.money(sale.paid_minor)}</td></tr>
    <tr><td>Change</td><td class="r">${this.money(sale.change_minor)}</td></tr>
  </table>
  <hr>
  <div class="center muted">${this.esc(s['receipt_footer'] || 'Thank you for shopping!')}</div>
  <div class="center promo">— — — — — — —<br>This product is built by <b>Moeez Haider</b>.<br>For inquiry contact moeezhaider12@gmail.com</div>
</body></html>`;
  }

  print(sale: any, s: Record<string, string>): void {
    const widthMm = s['receipt_paper_width'] === '58' ? 58 : 80;
    const html = this.html(sale, s);
    setTimeout(() => {
      const w = window.open('', 'receipt', `width=${widthMm * 4},height=640`);
      if (!w) return;
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    });
  }
}
