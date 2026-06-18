import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-placeholder',
  standalone: true,
  template: `
    <div class="space-y-3">
      <h1 class="text-2xl font-semibold">{{ title }}</h1>
      <div class="card p-8 text-center text-slate-500">
        <p class="text-lg">{{ title }} screen</p>
        <p class="mt-1 text-sm">Backend API is live and tested — this UI screen is scaffolded and wires to it next.</p>
      </div>
    </div>
  `,
})
export class PlaceholderComponent {
  title = inject(ActivatedRoute).snapshot.data['title'] ?? 'Coming soon';
}
