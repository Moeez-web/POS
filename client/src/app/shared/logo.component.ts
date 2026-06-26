import { Component, Input } from '@angular/core';

/** CounterPro storefront mark — rounded brand tile with a striped awning + shopfront. */
@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <svg [attr.width]="size" [attr.height]="size" viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" aria-label="CounterPro">
      <rect width="64" height="64" rx="16" fill="#2563eb" />
      <path d="M14 25 L18 15 H46 L50 25 Z" fill="#ffffff" />
      <g stroke="#2563eb" stroke-width="3">
        <line x1="25" y1="16" x2="23" y2="25" />
        <line x1="32" y1="16" x2="32" y2="25" />
        <line x1="39" y1="16" x2="41" y2="25" />
      </g>
      <path d="M14 25 q4.5 5 9 0 q4.5 5 9 0 q4.5 5 9 0 q4.5 5 9 0 Z" fill="#ffffff" />
      <g fill="none" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M18 30 V49 H46 V30" />
        <path d="M28 49 V38 H36 V49" />
      </g>
    </svg>
  `,
})
export class LogoComponent {
  @Input() size = 48;
}
