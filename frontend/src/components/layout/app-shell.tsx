import type { ReactNode } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { ArrowLeft, LogOut } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

export function AppShell({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const home = !profile ? "/" : profile.role === "professor" ? "/professor" : "/aluno"
  const backTo = pathname.startsWith("/explorar") ? "/" : parentRoute(pathname)
  const displayName = profile?.username ?? profile?.fullName ?? profile?.email
  const initials =
    displayName
      ?.split(/[\s_]+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "A"

  const navLinks = !profile
    ? []
    : profile.role === "professor"
      ? [
          { to: "/professor", label: "Início", exact: true },
          { to: "/professor/turmas", label: "Turmas" },
          { to: "/professor/atividades", label: "Atividades" },
          { to: "/professor/ao-vivo", label: "Ao vivo" },
          { to: "/professor/analytics", label: "Analytics" },
        ]
      : [
          { to: "/aluno", label: "Início", exact: true },
          { to: "/aluno/turmas", label: "Turmas" },
          { to: "/aluno/estudar", label: "Estudar" },
          { to: "/aluno/sessao", label: "Ao vivo" },
        ]

  return (
    <div className="min-h-screen bg-hero-atmosphere">
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-4">
            {backTo ? (
              <Button asChild variant="ghost" size="icon" className="-ml-2 shrink-0" aria-label="Voltar">
                <Link to={backTo}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
            ) : null}
            <Link
              to={home}
              className="flex shrink-0 items-center gap-2 font-display text-xl font-semibold tracking-tight text-primary transition-opacity hover:opacity-80"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm text-primary-foreground">
                A
              </span>
              Astro
            </Link>
            {title ? (
              <span className="hidden truncate border-l border-border pl-4 text-sm text-muted-foreground lg:inline">
                {title}
              </span>
            ) : null}
          </div>

          {navLinks.length > 0 ? (
            <nav className="hidden items-center gap-1 md:flex">
              {navLinks.map((link) => {
                const active = isNavActive(pathname, link.to, "exact" in link && link.exact)
                return (
                  <Link
                    key={link.to}
                    to={link.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-secondary text-primary"
                        : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                    )}
                  >
                    {link.label}
                  </Link>
                )
              })}
            </nav>
          ) : null}

          {profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto shrink-0 gap-3 px-2 py-1.5">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={profile.avatarUrl ?? undefined} alt={displayName ?? ""} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <div className="hidden text-left sm:block">
                    <p className="text-sm font-medium leading-none">
                      {displayName}
                    </p>
                    <Badge
                      variant={profile.role === "professor" ? "professor" : "aluno"}
                      className="mt-1"
                    >
                      {profile.role === "professor" ? "Professor" : "Aluno"}
                    </Badge>
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>{profile.email}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => {
                    void signOut().then(() => navigate("/", { replace: true }))
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Sair
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button asChild variant="outline" size="sm">
              <Link to="/">Entrar</Link>
            </Button>
          )}
        </div>
      </header>
      {navLinks.length > 0 ? (
        <nav className="scrollbar-none flex gap-1 overflow-x-auto border-b border-border/60 bg-background/60 px-4 py-2 backdrop-blur md:hidden">
          {navLinks.map((link) => {
            const active = isNavActive(pathname, link.to, "exact" in link && link.exact)
            return (
              <Link
                key={link.to}
                to={link.to}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "bg-secondary/70 text-muted-foreground"
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">{children}</main>
    </div>
  )
}

function isNavActive(pathname: string, to: string, exact?: boolean) {
  if (exact) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

function parentRoute(pathname: string) {
  const segments = pathname.replace(/\/+$/, "").split("/").filter(Boolean)
  if (segments.length <= 1) return null
  return `/${segments.slice(0, -1).join("/")}`
}
