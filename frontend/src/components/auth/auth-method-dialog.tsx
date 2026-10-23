import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/contexts/auth-context"
import type { UserRole } from "@/lib/types"

interface AuthMethodDialogProps {
  role: UserRole | null
  onClose: () => void
}

function roleLabel(role: UserRole) {
  return role === "professor" ? "professor" : "aluno"
}

export function AuthMethodDialog({ role, onClose }: AuthMethodDialogProps) {
  const navigate = useNavigate()
  const { signInWithGoogle, signInWithPassword, registerWithPassword } = useAuth()
  const [tab, setTab] = useState("login")
  const [googlePending, setGooglePending] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [login, setLogin] = useState("")
  const [password, setPassword] = useState("")

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [registerPassword, setRegisterPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const open = role !== null

  async function handleGoogle() {
    if (!role) return
    try {
      setGooglePending(true)
      await signInWithGoogle(role)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao iniciar login com Google")
      setGooglePending(false)
    }
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault()
    if (!role) return
    if (!login.trim() || !password) {
      toast.error("Informe e-mail ou usuário e a senha.")
      return
    }

    setSubmitting(true)
    try {
      const profile = await signInWithPassword(login.trim(), password)
      if (profile.role !== role) {
        toast.message(
          `Esta conta já é de ${roleLabel(profile.role)}. Não dá para entrar como ${roleLabel(role)} com o mesmo e-mail.`
        )
      }
      navigate(profile.role === "professor" ? "/professor" : "/aluno", { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar")
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault()
    if (!role) return

    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username.trim())) {
      toast.error("O nome de usuário deve ter 3 a 32 caracteres (letras, números ou _).")
      return
    }
    if (!email.trim()) {
      toast.error("Informe o e-mail.")
      return
    }
    if (registerPassword.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.")
      return
    }
    if (registerPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.")
      return
    }

    setSubmitting(true)
    try {
      const profile = await registerWithPassword({
        username: username.trim(),
        email: email.trim(),
        password: registerPassword,
        role,
      })
      toast.success("Conta criada. Bem-vindo ao Astro.")
      navigate(profile.role === "professor" ? "/professor" : "/aluno", { replace: true })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível criar a conta")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose() }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Entrar como {role ? roleLabel(role) : ""}</DialogTitle>
          <DialogDescription>
            Crie uma conta com e-mail e senha ou continue com o Google. O perfil escolhido fica
            fixo na primeira entrada.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            disabled={googlePending || submitting}
            onClick={() => void handleGoogle()}
          >
            {googlePending ? "Redirecionando..." : "Continuar com Google"}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">ou crie / entre com e-mail</span>
            </div>
          </div>

          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="register">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login">
              <form className="mt-4 grid gap-3" onSubmit={(event) => void handleLogin(event)}>
                <div className="grid gap-2">
                  <Label htmlFor="auth-login">E-mail ou nome de usuário</Label>
                  <Input
                    id="auth-login"
                    autoComplete="username"
                    value={login}
                    onChange={(event) => setLogin(event.target.value)}
                    placeholder="voce@email.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auth-password">Senha</Label>
                  <Input
                    id="auth-password"
                    type="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
                <Button type="submit" disabled={submitting || googlePending}>
                  {submitting ? "Entrando..." : "Entrar"}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="register">
              <form className="mt-4 grid gap-3" onSubmit={(event) => void handleRegister(event)}>
                <div className="grid gap-2">
                  <Label htmlFor="auth-username">Nome de usuário</Label>
                  <Input
                    id="auth-username"
                    autoComplete="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder={role === "professor" ? "astro_prof" : "astro_aluno"}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auth-email">E-mail</Label>
                  <Input
                    id="auth-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="voce@email.com"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auth-new-password">Senha</Label>
                  <Input
                    id="auth-new-password"
                    type="password"
                    autoComplete="new-password"
                    value={registerPassword}
                    onChange={(event) => setRegisterPassword(event.target.value)}
                    placeholder="Mínimo 8 caracteres"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="auth-confirm">Confirmar senha</Label>
                  <Input
                    id="auth-confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
                <Button type="submit" disabled={submitting || googlePending}>
                  {submitting ? "Criando..." : "Criar conta"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  )
}
