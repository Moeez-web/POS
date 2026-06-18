import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from './core/guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'change-password',
    canActivate: [authGuard],
    loadComponent: () => import('./features/auth/change-password.component').then((m) => m.ChangePasswordComponent),
  },
  {
    // POS register — its own full-screen layout.
    path: 'pos',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/pos-layout.component').then((m) => m.PosLayoutComponent),
    children: [
      {
        path: '',
        canActivate: [permissionGuard],
        data: { permission: 'sales.create' },
        loadComponent: () => import('./features/pos/register.component').then((m) => m.RegisterComponent),
      },
    ],
  },
  {
    // Management area — sidebar layout.
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/dashboard-layout.component').then((m) => m.DashboardLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      { path: 'dashboard', loadComponent: () => import('./features/dashboard/overview.component').then((m) => m.OverviewComponent) },
      {
        path: 'products',
        canActivate: [permissionGuard],
        data: { permission: 'products.read' },
        loadComponent: () => import('./features/products/products.component').then((m) => m.ProductsComponent),
      },
      { path: 'purchases', canActivate: [permissionGuard], data: { permission: 'purchases.create' }, loadComponent: () => import('./features/purchases/purchases.component').then((m) => m.PurchasesComponent) },
      { path: 'suppliers', canActivate: [permissionGuard], data: { permission: 'suppliers.read' }, loadComponent: () => import('./features/suppliers/suppliers.component').then((m) => m.SuppliersComponent) },
      { path: 'inventory', canActivate: [permissionGuard], data: { permission: 'inventory.read' }, loadComponent: () => import('./features/inventory/inventory.component').then((m) => m.InventoryComponent) },
      { path: 'invoices', canActivate: [permissionGuard], data: { permission: ['sales.read', 'sales.read.own'] }, loadComponent: () => import('./features/invoices/invoices.component').then((m) => m.InvoicesComponent) },
      { path: 'returns', canActivate: [permissionGuard], data: { permission: 'returns.read' }, loadComponent: () => import('./features/returns/returns.component').then((m) => m.ReturnsComponent) },
      { path: 'expenses', canActivate: [permissionGuard], data: { permission: 'expenses.read' }, loadComponent: () => import('./features/expenses/expenses.component').then((m) => m.ExpensesComponent) },
      { path: 'reports', canActivate: [permissionGuard], data: { permission: 'reports.daily.view' }, loadComponent: () => import('./features/reports/reports.component').then((m) => m.ReportsComponent) },
      { path: 'customers', canActivate: [permissionGuard], data: { permission: 'customers.read' }, loadComponent: () => import('./features/customers/customers.component').then((m) => m.CustomersComponent) },
      { path: 'users', canActivate: [permissionGuard], data: { permission: 'users.read' }, loadComponent: () => import('./features/users/users.component').then((m) => m.UsersComponent) },
      { path: 'roles', canActivate: [permissionGuard], data: { permission: 'roles.read' }, loadComponent: () => import('./features/roles/roles.component').then((m) => m.RolesComponent) },
      { path: 'settings', canActivate: [permissionGuard], data: { permission: 'settings.read' }, loadComponent: () => import('./features/settings/settings.component').then((m) => m.SettingsComponent) },
      { path: 'forbidden', loadComponent: () => import('./features/forbidden.component').then((m) => m.ForbiddenComponent) },
    ],
  },
  { path: '**', redirectTo: 'login' },
];

function ph() {
  return () => import('./features/placeholder.component').then((m) => m.PlaceholderComponent);
}
