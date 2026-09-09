import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-hero-atmosphere px-6 text-center">
      <p className="font-display text-7xl font-semibold text-primary">404</p>
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold">Página não encontrada</h1>
        <p className="max-w-md text-muted-foreground">
          Esse endereço não existe no Astro. Volte ao início para entrar ou continuar estudando.
        </p>
      </div>
      <Button asChild>
        <Link to="/">Ir para o início</Link>
      </Button>
    </div>
  )
}
