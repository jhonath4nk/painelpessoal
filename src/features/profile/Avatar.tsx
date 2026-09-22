type AvatarProps = { name: string; src?: string | null; className?: string }

export function Avatar({ name, src, className = '' }: AvatarProps) {
  const initial = name.trim().slice(0, 1).toLocaleUpperCase('pt-BR') || 'E'
  return <span className={`avatar ${className}`.trim()} aria-hidden="true">{src ? <img src={src} alt="" /> : initial}</span>
}
