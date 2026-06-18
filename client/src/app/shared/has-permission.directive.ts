import { Directive, Input, TemplateRef, ViewContainerRef, inject, effect } from '@angular/core';
import { AuthStore } from '../core/auth.store';

/** Structural directive: *appHasPermission="'products.create'" — hides content if the role lacks it. */
@Directive({ selector: '[appHasPermission]', standalone: true })
export class HasPermissionDirective {
  private tpl = inject(TemplateRef<unknown>);
  private vcr = inject(ViewContainerRef);
  private store = inject(AuthStore);

  private required: string | string[] = [];
  private shown = false;

  constructor() {
    effect(() => {
      this.store.permissions(); // track changes
      this.render();
    });
  }

  @Input() set appHasPermission(value: string | string[]) {
    this.required = value;
    this.render();
  }

  private render(): void {
    const perms = Array.isArray(this.required) ? this.required : [this.required];
    const allowed = perms.length === 0 || this.store.canAny(...perms);
    if (allowed && !this.shown) {
      this.vcr.createEmbeddedView(this.tpl);
      this.shown = true;
    } else if (!allowed && this.shown) {
      this.vcr.clear();
      this.shown = false;
    }
  }
}
