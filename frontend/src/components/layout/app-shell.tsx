import type { ReactNode } from "react"
import { Link, useLocation } from "react-router-dom"
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

export function AppShell({
  children,
  title,
}: {
  children: ReactNode
  title?: string
}) {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()
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

  return (
    <div className="min-h-screen bg-hero-atmosphere">
      <header className="border-b border-border/70 bg-background/70 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 sm:gap-6">
            {backTo ? (
              <Button asChild variant="ghost" size="icon" className="-ml-2" aria-label="Voltar">
                <Link to={backTo}>
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
            ) : null}
            <Link to={home} className="font-display text-xl font-semibold tracking-tight text-primary">
              Astro
            </Link>
            {title ? (
              <span className="hidden text-sm text-muted-foreground sm:inline">{title}</span>
            ) : null}
          </div>

          {profile ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-auto gap-3 px-2 py-1.5">
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
                <DropdownMenuItem onClick={() => void signOut()}>
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
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  )
}

function parentRoute(pathname: string) {
  const segments = pathname.replace(/\/+$/, "").split("/").filter(Boolean)
  if (segments.length <= 1) return null
  return `/${segments.slice(0, -1).join("/")}`
}
