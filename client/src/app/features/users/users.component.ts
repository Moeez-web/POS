import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Api } from '../../core/api';
import { Toast } from '../../shared/toast';
import { HasPermissionDirective } from '../../shared/has-permission.directive';
import { PaginatorComponent } from '../../shared/paginator.component';
import type { Page, Role } from '../../core/models';

interface UserRow {
  id: number;
  username: string;
  full_name: string | null;
  role_id: number;
  role_name: string;
  is_active: number;
}

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [FormsModule, HasPermissionDirective, PaginatorComponent],
  templateUrl: './users.component.html',
})
export class UsersComponent {
  private api = inject(Api);
  private toast = inject(Toast);

  page = signal<Page<UserRow> | null>(null);
  pageNum = 1;
  roles = signal<Role[]>([]);
  creating = signal(false);
  form = { username: '', full_name: '', role_id: 0, password: '' };

  // Reset-password dialog (window.prompt is disabled in Electron, so we use a modal).
  resetting = signal<UserRow | null>(null);
  newPassword = '';

  constructor() {
    this.load();
    this.api.get<Role[]>('/roles').subscribe((r) => {
      this.roles.set(r);
      if (r.length) this.form.role_id = r.find((x) => x.name === 'cashier')?.id ?? r[0].id;
    });
  }

  load(): void {
    this.api.getPage<UserRow>('/users', { page: this.pageNum, pageSize: 20 }).subscribe((p) => this.page.set(p));
  }
  goPage(p: number): void { this.pageNum = p; this.load(); }

  save(): void {
    if (!this.form.username || !this.form.password || !this.form.role_id) {
      this.toast.show('Username, password and role are required', 'error');
      return;
    }
    this.api.post('/users', { ...this.form, role_id: Number(this.form.role_id) }).subscribe({
      next: () => {
        this.toast.show('User created', 'success');
        this.creating.set(false);
        this.form = { username: '', full_name: '', role_id: this.roles()[0]?.id ?? 0, password: '' };
        this.load();
      },
    });
  }

  toggleActive(u: UserRow): void {
    this.api.patch(`/users/${u.id}`, { is_active: !u.is_active }).subscribe({
      next: () => this.load(),
    });
  }

  openReset(u: UserRow): void {
    this.resetting.set(u);
    this.newPassword = '';
  }

  confirmReset(): void {
    const u = this.resetting();
    if (!u) return;
    if (this.newPassword.trim().length < 6) {
      this.toast.show('Password must be at least 6 characters', 'error');
      return;
    }
    this.api.post(`/users/${u.id}/reset-password`, { new_password: this.newPassword.trim() }).subscribe({
      next: () => {
        this.toast.show(`Password reset for ${u.username}`, 'success');
        this.resetting.set(null);
      },
    });
  }
}
