export function activityEditorNav(role?: string | null) {
  const student = role === "aluno"

  return {
    student,
    home: student ? "/aluno/estudar" : "/professor/atividades",
    homeLabel: student ? "Estudar" : "Atividades",
    afterSave: (id: string, type: "quiz" | "flashcards") => {
      if (!student) return `/professor/atividades/${id}`
      return type === "flashcards" ? `/aluno/estudar/flashcards/${id}` : `/aluno/estudar/${id}`
    },
    fallback: (activity?: { id: string; type: string }) => {
      if (!student) {
        return activity ? `/professor/atividades/${activity.id}` : "/professor/atividades"
      }
      if (!activity) return "/aluno/estudar"
      return activity.type === "flashcards"
        ? `/aluno/estudar/flashcards/${activity.id}`
        : `/aluno/estudar/${activity.id}`
    },
    detail: (id: string) => (student ? "/aluno/estudar" : `/professor/atividades/${id}`),
  }
}
