import { Component, computed, inject, signal } from '@angular/core';
import { UpdateService } from '../core/update.service';

/**
 * Non-blocking app-update banner shown in the shell header. When an update is downloaded,
 * offers Install now / Later — the customer chooses; nothing installs without consent.
 * Dismissing only hides it for this session; it re-offers on the next launch.
 */
@Component({
  selector: 'app-update-banner',
  standalone: true,
  template: `
    @if (ready()) {
      <div class="flex items-center justify-between gap-4 border-b border-emerald-200 bg-emerald-50 px-6 py-2 text-sm text-emerald-900" data-testid="update-banner">
        <span>Update <strong>v{{ update.version() }}</strong> is ready.</span>
        <div class="flex items-center gap-2">
          <button class="rounded bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700" (click)="update.install()" data-testid="update-install">Install now</button>
          <button class="rounded px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100" (click)="dismiss()" data-testid="update-later">Later</button>
        </div>
      </div>
    } @else if (downloading()) {
      <div class="flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-6 py-1.5 text-xs text-slate-500" data-testid="update-downloading">
        <span>Downloading update… {{ update.percent() }}%</span>
      </div>
    }
  `,
})
export class UpdateBannerComponent {
  update = inject(UpdateService);
  private dismissed = signal(false);

  ready = computed(() => this.update.status() === 'downloaded' && !this.dismissed());
  downloading = computed(() => this.update.status() === 'downloading');

  dismiss(): void {
    this.dismissed.set(true);
  }
}
