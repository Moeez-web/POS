import { Component, EventEmitter, Input, Output } from '@angular/core';

/** Prev · "x–y of total" · Next pager. Hidden when everything fits on one page. */
@Component({
  selector: 'app-paginator',
  standalone: true,
  template: `
    @if (total > pageSize) {
      <div class="flex items-center justify-between py-2 text-sm">
        <span class="text-xs text-slate-500">{{ startItem }}–{{ endItem }} of {{ total }}</span>
        <div class="flex items-center gap-2">
          <button class="btn-ghost px-3 py-1" [disabled]="page <= 1" (click)="go(page - 1)" data-testid="page-prev">‹ Prev</button>
          <span class="text-xs text-slate-500">Page {{ page }} / {{ totalPages }}</span>
          <button class="btn-ghost px-3 py-1" [disabled]="page >= totalPages" (click)="go(page + 1)" data-testid="page-next">Next ›</button>
        </div>
      </div>
    }
  `,
})
export class PaginatorComponent {
  @Input() total = 0;
  @Input() page = 1;
  @Input() pageSize = 20;
  @Output() pageChange = new EventEmitter<number>();

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }
  get startItem(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
  }
  get endItem(): number {
    return Math.min(this.page * this.pageSize, this.total);
  }
  go(p: number): void {
    if (p >= 1 && p <= this.totalPages) this.pageChange.emit(p);
  }
}
