import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="flex flex-col items-center justify-center py-20 text-center">
      <div class="text-5xl">🔒</div>
      <h1 class="mt-4 text-xl font-semibold">Access denied</h1>
      <p class="mt-1 text-sm text-slate-500">You don't have permission to view this page.</p>
      <a routerLink="/app/dashboard" class="btn-primary mt-5">Back to dashboard</a>
    </div>
  `,
})
export class ForbiddenComponent {}
