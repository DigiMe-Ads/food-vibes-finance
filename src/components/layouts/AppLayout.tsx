import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from 'sonner';
import {
  LayoutDashboard, Receipt, TrendingUp, Tag, FileText, Settings,
  LogOut, Menu, TrendingDown, Users
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types/types';
import { canManageUsers } from '@/types/types';

type NavItem = { to: string; label: string; icon: React.ElementType; exact?: boolean };

const allNavItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/expenses', label: 'Expenses', icon: Receipt },
  { to: '/investments', label: 'Investments', icon: TrendingUp },
  { to: '/categories', label: 'Categories', icon: Tag },
  { to: '/reports', label: 'Reports', icon: FileText },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/users', label: 'Users', icon: Users },
];

// Items visible to each role
const VIEWER_PATHS = new Set(['/', '/expenses', '/investments']);

function getNavItems(role: UserRole | undefined): NavItem[] {
  if (role === 'viewer') return allNavItems.filter(i => VIEWER_PATHS.has(i.to));
  if (canManageUsers(role)) return allNavItems; // admin sees everything
  return allNavItems.filter(i => i.to !== '/users'); // accounts / user
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  accounts: 'Accounts',
  viewer: 'Viewer',
  user: 'User',
};

function NavItems({ onNavigate, role }: { onNavigate?: () => void; role: UserRole | undefined }) {
  const items = getNavItems(role);
  return (
    <nav className="flex-1 px-3 py-4 space-y-1">
      {items.map(item => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground'
            )
          }
        >
          <item.icon className="w-4 h-4 shrink-0" />
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { signOut, profile } = useAuth();
  const { project } = useProject();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    toast.success('Signed out successfully.');
    navigate('/login');
  };

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Logo / Brand */}
      <div className="px-4 py-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center shrink-0">
            <TrendingDown className="w-4 h-4 text-sidebar-primary-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">{"Food Vibes Finance"}</p>

          </div>
        </div>
      </div>
      {/* Nav */}
      <NavItems onNavigate={onNavigate} role={profile?.role} />
      {/* Project status badge */}
      {project && (
        <div className="px-4 pb-3">

        </div>
      )}
      {/* User + Logout */}
      <div className="px-3 py-3 border-t border-sidebar-border">
        {profile && (
          <p className="text-sidebar-foreground text-xs px-3 pb-2 truncate">
            {profile.email?.replace('@miaoda.com', '') ?? 'User'}
            {profile.role && (
              <span className="ml-1 text-primary font-medium">· {ROLE_LABELS[profile.role] ?? profile.role}</span>
            )}
          </p>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground transition-colors"
        >
          <LogOut className="w-4 h-4 shrink-0" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-64 shrink-0 border-r border-border sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-sidebar border-b border-sidebar-border sticky top-0 z-40">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="text-sidebar-foreground hover:text-white transition-colors">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border" aria-describedby={undefined}>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>
          <div className="flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-sidebar-primary" />
            <span className="text-white font-semibold text-sm">RestaurantFinance</span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 min-w-0 p-4 md:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
