import { Routes } from '@angular/router';
import { adminGuard } from './guards/admin.guard';
import { AccessPage } from './pages/access-page/access-page';
import { AdminPage } from './pages/admin-page/admin-page';
import { EventDetailPage } from './pages/event-detail-page/event-detail-page';
import { EventsPage } from './pages/events-page/events-page';

export const routes: Routes = [
  { path: 'events', component: EventsPage },
  { path: 'events/:id', component: EventDetailPage },
  { path: 'accesso', component: AccessPage },
  { path: 'admin', component: AdminPage, canActivate: [adminGuard] },
  { path: '', pathMatch: 'full', redirectTo: 'events' },
  { path: '**', redirectTo: 'events' },
];
