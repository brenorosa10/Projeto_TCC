const BITS = [
  { angle: "0deg", color: "#9ff5ea", left: "22%" },
  { angle: "32deg", color: "#6d5ce7", left: "28%" },
  { angle: "64deg", color: "#d98324", left: "34%" },
  { angle: "96deg", color: "#14804a", left: "40%" },
  { angle: "128deg", color: "#6aa9c4", left: "48%" },
  { angle: "160deg", color: "#9ff5ea", left: "56%" },
  { angle: "192deg", color: "#6d5ce7", left: "62%" },
  { angle: "224deg", color: "#d98324", left: "70%" },
  { angle: "256deg", color: "#14804a", left: "76%" },
  { angle: "300deg", color: "#6aa9c4", left: "50%" },
] as const

/** Short confetti burst. Pure CSS; hidden from assistive tech. */
export function CelebrationBurst() {
  return (
    <span className="celebration-burst" aria-hidden>
      {BITS.map((bit, index) => (
        <span
          key={bit.angle}
          className="celebration-bit"
          style={{
            ["--angle" as string]: bit.angle,
            ["--bit" as string]: bit.color,
            left: bit.left,
            animationDelay: `${index * 18}ms`,
          }}
        />
      ))}
    </span>
  )
}
