import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { HasPermissionDirective } from '../../shared/has-permission.directive';
import type { Permission, Role } from '../../core/models';

@Component({
  selector: 'app-roles',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective],
  templateUrl: './roles.component.html',
})
export class RolesComponent {
  private api = inject(Api);
  private toast = inject(Toast);

  roles = signal<Role[]>([]);
  permissions = signal<Permission[]>([]);
  selected = signal<Role | null>(null);
  granted = signal<Set<string>>(new Set());
  newRoleName = signal('');

  /** Permissions grouped by module for the checkbox matrix. */
  grouped = computed(() => {
    const map = new Map<string, Permission[]>();
    for (const p of this.permissions()) {
      if (!map.has(p.module)) map.set(p.module, []);
      map.get(p.module)!.push(p);
    }
    return [...map.entries()].map(([module, perms]) => ({ module, perms }));
  });

  constructor() {
    this.api.get<Permission[]>('/roles/permissions').subscribe((p) => this.permissions.set(p));
    this.loadRoles();
  }

  loadRoles(): void {
    this.api.get<Role[]>('/roles').subscribe((r) => this.roles.set(r));
  }

  select(role: Role): void {
    this.selected.set(role);
    this.granted.set(new Set(role.permissions));
  }

  toggle(key: string): void {
    const g = new Set(this.granted());
    g.has(key) ? g.delete(key) : g.add(key);
    this.granted.set(g);
  }

  createRole(): void {
    const name = this.newRoleName().trim();
    if (!name) return;
    this.api.post<Role>('/roles', { name, permission_keys: [] }).subscribe({
      next: (r) => {
        this.toast.show('Role created', 'success');
        this.newRoleName.set('');
        this.loadRoles();
        this.select(r);
      },
    });
  }

  saveGrants(): void {
    const role = this.selected();
    if (!role) return;
    this.api.patch<Role>(`/roles/${role.id}`, { permission_keys: [...this.granted()] }).subscribe({
      next: (updated) => {
        this.toast.show('Permissions updated', 'success');
        this.roles.update((rs) => rs.map((r) => (r.id === updated.id ? updated : r)));
        this.select(updated);
      },
    });
  }
}
