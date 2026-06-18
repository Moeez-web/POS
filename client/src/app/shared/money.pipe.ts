import { Pipe, PipeTransform } from '@angular/core';

/** Formats integer minor units (e.g. 12345 → "123.45"). */
@Pipe({ name: 'money', standalone: true })
export class MoneyPipe implements PipeTransform {
  transform(minor: number | null | undefined, symbol = ''): string {
    if (minor === null || minor === undefined) return '—';
    const v = (minor / 100).toFixed(2);
    return symbol ? `${symbol} ${v}` : v;
  }
}
