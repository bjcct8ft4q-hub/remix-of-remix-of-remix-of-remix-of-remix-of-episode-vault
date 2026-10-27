import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Search, LogOut, Shield, UserRound, Menu, Home, Library, ChevronDown, X, type LucideIcon } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Logo } from "./Logo";
import { useAuth } from "@/lib/auth";
import { useTheme } from "@/lib/theme";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { QuickSearch } from "./QuickSearch";

function MenuLabel({ children }: { children: ReactNode }) {
  return <div className="flex items-center gap-2 px-3 pb-2 pt-3 text-xs font-bold uppercase tracking-wider text-muted-foreground"><span className="h-3 w-0.5 bg-primary" />{children}<span className="flex-1 border-t border-dashed border-border" /></div>;
}

function MenuLink({ to, icon: Icon, active, onClick, children }: { to: "/" | "/browse" | "/admin"; icon: LucideIcon; active: boolean; onClick: () => void; children: ReactNode }) {
  return <Button asChild variant="ghost" className={`h-11 w-full justify-start gap-3 ${active ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}><Link to={to} onClick={onClick} aria-current={active ? "page" : undefined}><span className="flex h-6 w-6 items-center justify-center border border-border bg-muted/40"><Icon className="h-4 w-4" /></span>{children}</Link></Button>;
}

export function Header() {
  const { user, username, isAdmin, openAuth } = useAuth();
  const { halloween } = useTheme();
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const home = pathname === "/";

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header className={`absolute inset-x-0 top-0 z-30 flex flex-wrap items-center gap-x-3 gap-y-3 px-4 py-4 sm:px-6 ${home ? "bg-gradient-to-b from-background/70 to-transparent" : "border-b border-border/40 bg-background/90 backdrop-blur-md"}`}>
      {halloween && <div className="halloween-web pointer-events-none absolute left-0 top-0 h-24 w-24" />}
      <div className="relative shrink-0">
        <Button variant="ghost" size="icon" aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} onClick={() => setMenuOpen((o) => !o)} className="text-muted-foreground hover:text-foreground">
          {menuOpen ? <X /> : <Menu />}
        </Button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <nav aria-label="Main navigation" className="panel-pattern absolute left-0 top-12 z-50 w-56 overflow-hidden rounded-sm border border-border bg-background/95 p-2 shadow-2xl backdrop-blur-md">
              <MenuLabel>Browse</MenuLabel>
              <MenuLink to="/" icon={Home} active={home} onClick={() => setMenuOpen(false)}>Home</MenuLink>
              <MenuLink to="/browse" icon={Search} active={pathname === "/browse"} onClick={() => setMenuOpen(false)}>Search</MenuLink>
              <MenuLink to="/browse" icon={Library} active={pathname === "/browse"} onClick={() => setMenuOpen(false)}>All series</MenuLink>
              {isAdmin && (
                <>
                  <MenuLabel>Admin</MenuLabel>
                  <MenuLink to="/admin" icon={Shield} active={pathname === "/admin"} onClick={() => setMenuOpen(false)}>Dashboard</MenuLink>
                </>
              )}
            </nav>
          </>
        )}
      </div>
      <Logo />
      <Button variant="outline" aria-label="Search series" aria-haspopup="dialog" aria-expanded={searchOpen} onClick={() => { setMenuOpen(false); setSearchOpen(true); }} className="order-3 h-10 w-full justify-start bg-overlay/60 px-3 text-sm text-muted-foreground backdrop-blur md:order-none md:w-64 md:flex-none lg:w-72"><Search />Search series...</Button>
      <QuickSearch open={searchOpen} onOpenChange={setSearchOpen} />
      <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-3">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="max-w-48 gap-2 text-sm text-muted-foreground hover:text-foreground" aria-label="Account menu">
                <UserRound className="h-4 w-4 shrink-0" />
                <span className="hidden truncate sm:inline">{username}</span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="truncate">{username}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {isAdmin && (
                <DropdownMenuItem asChild><Link to="/admin"><Shield /> Admin dashboard</Link></DropdownMenuItem>
              )}
              <DropdownMenuItem asChild><Link to="/browse"><Library /> Browse series</Link></DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={async () => {
                  await qc.cancelQueries();
                  await supabase.auth.signOut();
                  navigate({ to: "/", replace: true });
                }}
              >
                <LogOut /> Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            onClick={() => openAuth("signin")}
            className="clip-slant rounded-none px-6 text-xs font-extrabold uppercase tracking-wider"
          >
            Sign in
          </Button>
        )}
      </div>
    </header>
  );
}
