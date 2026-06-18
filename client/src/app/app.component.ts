import { Component, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from './shared/toast';
import { IdleTimeoutService } from './core/idle-timeout.service';
import { AuthStore } from './core/auth.store';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainer],
  template: `
    <router-outlet />
    <app-toast-container />

    @if (idle.warning()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div class="card max-w-sm p-6 text-center">
          <h3 class="text-lg font-semibold">Are you still there?</h3>
          <p class="mt-1 text-sm text-slate-500">You'll be logged out shortly due to inactivity.</p>
          <p class="mt-3 text-xs text-slate-400">Move the mouse or press a key to stay signed in.</p>
        </div>
      </div>
    }
  `,
})
export class AppComponent {
  idle = inject(IdleTimeoutService);
  private store = inject(AuthStore);

  constructor() {
    effect(() => {
      if (this.store.isAuthenticated()) this.idle.start();
      else this.idle.stop();
    });
  }
}
