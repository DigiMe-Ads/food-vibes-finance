import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { toast } from 'sonner';
import {
  LayoutDashboard, Receipt, TrendingUp, Tag, FileText, Settings,
  LogOut, Menu, Users, KeyRound, ChevronsUpDown,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { BrandMark } from '@/components/common/BrandMark';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { cn, displayName } from '@/lib/utils';
import type { UserRole } from '@/types/types';
import { canManageUsers } from '@/types/types';

type NavItem = { to: string; label: string; icon: React.ElementType; exact?: boolean };

const NAV_SECTIONS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
      { to: '/reports', label: 'Reports', icon: FileText },
    ],
  },
  {
    title: 'Records',
    items: [
      { to: '/expenses', label: 'Expenses', icon: Receipt },
      { to: '/investments', label: 'Investments', icon: TrendingUp },
      { to: '/categories', label: 'Categories', icon: Tag },
    ],
  },
  {
    title: 'Manage',
    items: [
      { to: '/users', label: 'Users', icon: Users },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

// Items visible to each role (unchanged from the original app)
const VIEWER_PATHS = new Set(['/', '/expenses', '/investments']);

function isVisible(item: NavItem, role: UserRole | undefined): boolean {
  if (role === 'viewer') return VIEWER_PATHS.has(item.to);
  if (canManageUsers(role)) return true; // admin sees everything
  return item.to !== '/users'; // accounts / user
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  accounts: 'Accounts',
  viewer: 'Viewer',
  user: 'User',
};

function initials(name: string): string {
  return name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).map(p => p[0]).join('').slice(0, 2).toUpperCase() || 'U';
}

function useSignOut() {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  return async () => {
    await signOut();
    toast.success('Signed out successfully.');
    navigate('/login');
  };
}

function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-primary text-[11px] font-bold text-white', className)}>
      {initials(name)}
    </span>
  );
}

function AccountMenu({ trigger, align = 'end' }: { trigger: React.ReactNode; align?: 'start' | 'end' }) {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const handleSignOut = useSignOut();
  const name = displayName(profile?.email ?? user?.email, profile?.username);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-60">
        <DropdownMenuLabel className="font-normal">
          <p className="text-sm font-semibold text-foreground truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{profile?.email ?? user?.email}</p>
          {profile?.role && (
            <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </span>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/account/password')} className="gap-2 cursor-pointer">
          <KeyRound className="h-4 w-4" /> Change password
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={handleSignOut} className="gap-2 cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { profile, user } = useAuth();
  const name = displayName(profile?.email ?? user?.email, profile?.username);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex justify-center px-5 pt-7 pb-6">
        <BrandMark />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-6">
        {NAV_SECTIONS.map(section => {
          const items = section.items.filter(i => isVisible(i, profile?.role));
          if (items.length === 0) return null;
          return (
            <div key={section.title}>
              <p className="px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/50">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.exact}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                        isActive
                          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                          : 'text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-sidebar-primary" />}
                        <item.icon className={cn('h-[18px] w-[18px] shrink-0', isActive ? 'text-sidebar-primary' : 'opacity-80')} />
                        <span>{item.label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <AccountMenu
          align="start"
          trigger={
            <button className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-sidebar-accent/60">
              <Avatar name={name} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-sidebar-accent-foreground">{name}</p>
                <p className="truncate text-xs text-sidebar-foreground">{ROLE_LABELS[profile?.role ?? ''] ?? '—'}</p>
              </div>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-sidebar-foreground/60" />
            </button>
          }
        />
      </div>
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { project } = useProject();
  const { profile, user } = useAuth();
  const name = displayName(profile?.email ?? user?.email, profile?.username);

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col sticky top-0 h-screen no-print">
        <SidebarContent />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-40 flex h-16 items-center gap-3 border-b border-border/70 bg-background/80 px-4 backdrop-blur-md md:px-8 no-print">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <button className="icon-btn md:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground" aria-describedby={undefined}>
              <SidebarContent onNavigate={() => setMobileOpen(false)} />
            </SheetContent>
          </Sheet>

          <div className="md:hidden"><BrandMark size="sm" compact /></div>

          {project && (
            <div className="hidden min-w-0 items-center gap-2.5 md:flex">
              <p className="truncate text-sm font-semibold text-foreground">{project.name}</p>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                {project.status}
              </span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AccountMenu
              trigger={
                <button className="ml-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Account menu">
                  <Avatar name={name} className="h-9 w-9" />
                </button>
              }
            />
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto w-full max-w-[1400px] animate-fade-in">{children}</div>
        </main>
      </div>
    </div>
  );
}
