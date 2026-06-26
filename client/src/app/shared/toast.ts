import { Component, Injectable, signal } from '@angular/core';

export interface ToastMsg {
  id: number;
  text: string;
  type: 'info' | 'success' | 'error';
}

@Injectable({ providedIn: 'root' })
export class Toast {
  readonly messages = signal<ToastMsg[]>([]);
  private seq = 0;

  show(text: string, type: ToastMsg['type'] = 'info'): void {
    const id = ++this.seq;
    this.messages.update((m) => [...m, { id, text, type }]);
    setTimeout(() => this.dismiss(id), 4000);
  }

  dismiss(id: number): void {
    this.messages.update((m) => m.filter((t) => t.id !== id));
  }
}

@Component({
  selector: 'app-toast-container',
  standalone: true,
  template: `
    <div class="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      @for (t of toast.messages(); track t.id) {
        <div
          class="rounded-lg px-4 py-3 text-sm text-white shadow-lg"
          [class.bg-slate-800]="t.type === 'info'"
          [class.bg-green-600]="t.type === 'success'"
          [class.bg-red-600]="t.type === 'error'"
          (click)="toast.dismiss(t.id)"
          data-testid="toast"
        >
          {{ t.text }}
        </div>
      }
    </div>
  `,
})
export class ToastContainer {
  constructor(public toast: Toast) {}
}
