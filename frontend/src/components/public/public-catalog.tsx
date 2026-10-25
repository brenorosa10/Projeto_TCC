import { useEffect, useState, type ReactNode } from "react"
import { Link } from "react-router-dom"
import { Play, Search, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { EmptyState } from "@/components/ui/page-loader"
import { getApiBaseUrl, api } from "@/lib/api"
import { QUESTION_DIFFICULTIES } from "@/lib/content-blocks"
import { UNCATEGORIZED_THEME } from "@/lib/themes"
import { activityCountLabel, cn, plural } from "@/lib/utils"
import type { PublicActivitySummary, PublicCatalog, PublicCatalogQuery } from "@/lib/types"

type Audience = "guest" | "aluno" | "professor"
type SortKey = NonNullable<PublicCatalogQuery["sort"]>
type SizeId = "any" | "short" | "medium" | "long"

const sorts: Array<{ id: SortKey; label: string }> = [
  { id: "recent", label: "Mais recentes" },
  { id: "popular", label: "Mais jogados" },
  { id: "alpha", label: "A–Z" },
]

const sizes: Array<{ id: SizeId; label: string; min?: number; max?: number }> = [
  { id: "any", label: "Qualquer tamanho" },
  { id: "short", label: "Até 5", max: 5 },
  { id: "medium", label: "6 a 10", min: 6, max: 10 },
  { id: "long", label: "11 ou mais", min: 11 },
]

export function PublicCatalog({
  heading = "Estudo público",
  lead = "Quizzes e flashcards abertos pela comunidade. Não precisa de conta para estudar.",
  audience = "guest",
}: {
  heading?: string
  lead?: string
  audience?: Audience
}) {
  const [type, setType] = useState<"quiz" | "flashcards">("quiz")
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  const [selectedThemes, setSelectedThemes] = useState<string[]>([])
  const [drillTheme, setDrillTheme] = useState<string | null>(null)
  const [sort, setSort] = useState<SortKey>("recent")
  const [sizeId, setSizeId] = useState<SizeId>("any")
  const [difficulty, setDifficulty] = useState("")
  const [page, setPage] = useState(1)
  const [catalog, setCatalog] = useState<PublicCatalog | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [brokenCovers, setBrokenCovers] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  const size = sizes.find((item) => item.id === sizeId) ?? sizes[0]
  const view = drillTheme ? "list" : "grouped"

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebounced(query.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(handle)
  }, [query])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)
    api
      .listPublicActivities({
        q: debounced || undefined,
        type,
        themes: drillTheme ? [drillTheme] : selectedThemes,
        sort,
        minItems: size.min,
        maxItems: size.max,
        difficulty: type === "quiz" && difficulty ? difficulty : undefined,
        page: view === "list" ? page : 1,
        pageSize: 12,
        view,
      })
      .then((data) => {
        if (!cancelled) setCatalog(data)
      })
      .catch(() => {
        if (!cancelled) {
          setCatalog(null)
          setError(true)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [debounced, type, selectedThemes, drillTheme, sort, size.min, size.max, difficulty, page, view, reloadKey])

  const noun = type === "quiz" ? "quiz" : "deck"
  const untouched =
    !debounced &&
    selectedThemes.length === 0 &&
    !drillTheme &&
    !difficulty &&
    sizeId === "any" &&
    sort === "recent"
  const filtering = Boolean(debounced || selectedThemes.length || drillTheme || difficulty || sizeId !== "any")
  const total = catalog?.total ?? 0
  const pageCount = Math.max(1, Math.ceil(total / (catalog?.pageSize || 12)))

  function changeType(next: "quiz" | "flashcards") {
    setType(next)
    setPage(1)
    setDrillTheme(null)
    setDifficulty("")
  }

  function toggleTheme(name: string) {
    setDrillTheme(null)
    setPage(1)
    setSelectedThemes((current) =>
      current.includes(name) ? current.filter((item) => item !== name) : [...current, name]
    )
  }

  function clearFilters() {
    setQuery("")
    setDebounced("")
    setSelectedThemes([])
    setDrillTheme(null)
    setSort("recent")
    setSizeId("any")
    setDifficulty("")
    setPage(1)
  }

  return (
    <section id={audience === "guest" ? "explorar" : undefined} className="space-y-5" aria-busy={loading}>
      <div>
        <h2 className="font-display text-2xl font-semibold">{heading}</h2>
        <p className="mt-2 max-w-2xl text-muted-foreground text-pretty">{lead}</p>
      </div>

      <div className="space-y-3">
        <div className="grid gap-1.5">
          <label htmlFor="public-catalog-search" className="text-sm font-medium">
            Buscar
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="public-catalog-search"
              type="search"
              value={query}
              placeholder="Título, descrição, tema ou autor"
              className="h-12 pl-10"
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div role="tablist" aria-label="Tipo de conteúdo" className="inline-flex rounded-xl bg-card p-1">
            {(
              [
                ["quiz", "Quizzes"],
                ["flashcards", "Flashcards"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={type === value}
                className={cn(
                  "rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                  type === value
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => changeType(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-1.5 sm:min-w-48">
            <label htmlFor="public-catalog-sort" className="text-sm font-medium">
              Ordenar
            </label>
            <select
              id="public-catalog-sort"
              value={sort}
              className="h-10 rounded-lg border border-input bg-card px-3 text-sm"
              onChange={(event) => {
                setSort(event.target.value as SortKey)
                setPage(1)
              }}
            >
              {sorts.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {catalog && catalog.themes.length > 0 ? (
          <ChipRow label="Temas">
            {catalog.themes.map((theme) => {
              const selected = drillTheme === theme.name || selectedThemes.includes(theme.name)
              return (
                <Chip
                  key={theme.name}
                  pressed={selected}
                  onClick={() => toggleTheme(theme.name)}
                >
                  {theme.name}
                  <span className="text-xs opacity-80">{theme.count}</span>
                </Chip>
              )
            })}
          </ChipRow>
        ) : null}

        <ChipRow label={type === "quiz" ? "Questões" : "Cartões"}>
          {sizes.map((item) => (
            <Chip
              key={item.id}
              pressed={sizeId === item.id}
              onClick={() => {
                setSizeId(item.id)
                setPage(1)
              }}
            >
              {item.label}
            </Chip>
          ))}
        </ChipRow>

        {type === "quiz" ? (
          <ChipRow label="Dificuldade">
            <Chip
              pressed={difficulty === ""}
              onClick={() => {
                setDifficulty("")
                setPage(1)
              }}
            >
              Todas
            </Chip>
            {QUESTION_DIFFICULTIES.map((item) => (
              <Chip
                key={item.value}
                pressed={difficulty === item.value}
                onClick={() => {
                  setDifficulty(item.value)
                  setPage(1)
                }}
              >
                {item.label}
              </Chip>
            ))}
          </ChipRow>
        ) : null}

        {filtering || sort !== "recent" ? (
          <Button type="button" variant="ghost" size="sm" className="h-9 px-2" onClick={clearFilters}>
            <X className="h-4 w-4" />
            Limpar filtros
          </Button>
        ) : null}
      </div>

      <p className="sr-only" aria-live="polite">
        {loading
          ? "Carregando conteúdos públicos"
          : total === 0
            ? `Nenhum ${noun} público encontrado`
            : `${total} ${
                type === "quiz"
                  ? total === 1
                    ? "quiz público"
                    : "quizzes públicos"
                  : total === 1
                    ? "deck público"
                    : "decks públicos"
              }`}
      </p>

      {loading && !catalog ? (
        <CatalogSkeleton rows={view === "grouped"} />
      ) : error ? (
        <EmptyState
          icon={Search}
          title="Não foi possível carregar a vitrine"
          description="Verifique a conexão e tente de novo."
        >
          <Button type="button" variant="outline" onClick={() => setReloadKey((current) => current + 1)}>
            Tentar de novo
          </Button>
        </EmptyState>
      ) : total === 0 ? (
        <EmptyState
          icon={Search}
          title={untouched ? `Nenhum ${noun} público no momento` : "Nenhum resultado"}
          description={
            untouched
              ? type === "quiz"
                ? "Quando um professor marcar um quiz como público, ele aparece aqui, agrupado por tema."
                : "Quando um professor marcar um deck como público, ele aparece aqui, agrupado por tema."
              : "Tente outro termo, tema ou limpe os filtros."
          }
        />
      ) : (
        <div className={cn("space-y-8", loading && "opacity-70")}>
          {view === "list" ? (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-muted-foreground">
                  {drillTheme ? drillTheme : "Resultados"} · {plural(total, noun, type === "quiz" ? "quizzes" : "decks")}
                </p>
                {drillTheme ? (
                  <Button type="button" variant="outline" size="sm" onClick={() => setDrillTheme(null)}>
                    Voltar aos temas
                  </Button>
                ) : null}
              </div>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {(catalog?.items ?? []).map((item) => (
                  <li key={item.id}>
                    <CatalogCard
                      item={item}
                      audience={audience}
                      coverBroken={brokenCovers.includes(item.id)}
                      onCoverError={() => setBrokenCovers((current) => [...current, item.id])}
                    />
                  </li>
                ))}
              </ul>
              {pageCount > 1 ? (
                <div className="flex items-center justify-between gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((current) => Math.max(1, current - 1))}
                  >
                    Anterior
                  </Button>
                  <p className="text-sm text-muted-foreground">
                    Página {page} de {pageCount}
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={page >= pageCount || loading}
                    onClick={() => setPage((current) => current + 1)}
                  >
                    Próxima
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-8">
              <p className="text-sm text-muted-foreground">
                {sort === "popular"
                  ? "Os mais jogados de cada tema."
                  : sort === "alpha"
                    ? "Em ordem alfabética, dentro de cada tema."
                    : "Os mais recentes de cada tema."}
              </p>
              {(catalog?.groups ?? []).map((group) => (
                <section key={group.theme} aria-labelledby={`tema-${slug(group.theme)}`}>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <h3 id={`tema-${slug(group.theme)}`} className="font-display text-xl font-semibold">
                      {group.theme}
                    </h3>
                    {group.total > group.items.length ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 shrink-0"
                        onClick={() => {
                          setDrillTheme(group.theme)
                          setSelectedThemes([group.theme])
                          setPage(1)
                        }}
                      >
                        Ver todos ({group.total})
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {plural(group.total, noun, type === "quiz" ? "quizzes" : "decks")}
                      </span>
                    )}
                  </div>
                  <ul className="flex snap-x gap-3 overflow-x-auto pb-3">
                    {group.items.map((item) => (
                      <li key={item.id} className="w-[17.5rem] shrink-0 snap-start">
                        <CatalogCard
                          item={item}
                          audience={audience}
                          coverBroken={brokenCovers.includes(item.id)}
                          onCoverError={() => setBrokenCovers((current) => [...current, item.id])}
                        />
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function CatalogCard({
  item,
  audience,
  coverBroken,
  onCoverError,
}: {
  item: PublicActivitySummary
  audience: Audience
  coverBroken: boolean
  onCoverError: () => void
}) {
  const theme = item.theme || UNCATEGORIZED_THEME
  const showCover = Boolean(item.hasCover) && !coverBroken
  const difficulty = QUESTION_DIFFICULTIES.find((entry) => entry.value === item.difficulty)?.label
  const href =
    audience === "aluno"
      ? item.type === "flashcards"
        ? `/aluno/estudar/flashcards/${item.id}`
        : `/aluno/estudar/${item.id}`
      : item.type === "flashcards"
        ? `/explorar/flashcards/${item.id}`
        : `/explorar/quiz/${item.id}`

  return (
    <article className="surface-card flex h-full flex-col overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-lift)]">
      {showCover ? (
        <img
          src={coverUrl(item.id)}
          alt=""
          className="h-32 w-full object-cover"
          loading="lazy"
          onError={onCoverError}
        />
      ) : (
        <div
          aria-hidden
          className="relative flex h-24 items-end overflow-hidden bg-gradient-to-br from-primary/20 via-astro-sky/30 to-astro-mint/40 p-3"
        >
          <span className="absolute -right-1 -top-5 font-display text-7xl font-semibold text-primary/15">
            {item.title.trim().slice(0, 1).toUpperCase()}
          </span>
        </div>
      )}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{theme}</Badge>
          {difficulty ? <Badge variant="outline">{difficulty}</Badge> : null}
        </div>
        <h3 className="font-display text-lg font-semibold leading-snug text-balance">{item.title}</h3>
        {item.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground text-pretty">{item.description}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {activityCountLabel(item.itemCount, item.type)}
          {item.professorName ? ` · ${item.professorName}` : ""}
          {item.playCount ? ` · ${plural(item.playCount, "jogada", "jogadas")}` : ""}
        </p>
        <Button asChild className="mt-auto w-full">
          <Link to={href}>
            <Play className="h-4 w-4" aria-hidden />
            {item.type === "flashcards" ? "Estudar" : "Jogar"}
          </Link>
        </Button>
      </div>
    </article>
  )
}

function ChipRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-sm font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}

function Chip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
        pressed
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-foreground hover:border-primary/40"
      )}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function CatalogSkeleton({ rows }: { rows: boolean }) {
  if (!rows) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="status" aria-label="Carregando">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="skeleton h-72 rounded-xl" />
        ))}
        <span className="sr-only">Carregando conteúdos públicos...</span>
      </div>
    )
  }

  return (
    <div className="space-y-8" role="status" aria-label="Carregando">
      {Array.from({ length: 3 }).map((_, row) => (
        <div key={row} className="space-y-3">
          <div className="skeleton h-6 w-40 rounded-md" />
          <div className="flex gap-3 overflow-hidden">
            {Array.from({ length: 3 }).map((_, card) => (
              <div key={card} className="skeleton h-72 w-[17.5rem] shrink-0 rounded-xl" />
            ))}
          </div>
        </div>
      ))}
      <span className="sr-only">Carregando conteúdos públicos...</span>
    </div>
  )
}

function coverUrl(id: string) {
  return `${getApiBaseUrl().replace(/\/$/, "")}/api/public/activities/${id}/cover`
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}
