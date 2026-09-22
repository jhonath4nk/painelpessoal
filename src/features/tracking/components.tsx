import { useEffect, useId, useRef, type ReactNode } from 'react'
import { percentLabel } from '../../domain/tracking'

export function Bar({ value, label }: { value: number | null; label: string }) {
  return <div className="progress-track" role="progressbar" aria-label={label} aria-valuenow={value === null ? undefined : Math.round(value)} aria-valuemin={0} aria-valuemax={100} aria-valuetext={value === null ? 'Sem atividades planejadas' : undefined}><span style={{ width: `${value || 0}%` }} /></div>
}
export function Metric({ label, value, detail }: { label: string; value: ReactNode; detail: string }) {
  return <section className="metric"><p>{label}</p><strong>{value}</strong><span>{detail}</span></section>
}
export function Modal({ title, close, children, busy = false }: { title: string; close: () => void; children: ReactNode; busy?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const heading = useId()
  useEffect(() => {
    const node = dialog.current!
    node.showModal()
    node.querySelector<HTMLElement>('input:not([type="checkbox"]),textarea,select')?.focus()
    return () => node.close()
  }, [])
  return <dialog className="dialog" ref={dialog} aria-labelledby={heading} onCancel={event => { event.preventDefault(); if (!busy) close() }}><header><h2 id={heading}>{title}</h2><button aria-label="Fechar" onClick={close} disabled={busy} className="close-button">×</button></header>{children}</dialog>
}
export function ExecutionRing({ value }: { value: number | null }) {
  return <div className="execution-ring" style={{ background: `conic-gradient(#347ce0 ${(value || 0) * 3.6}deg, #e8eff8 0)` }}><div><strong>{percentLabel(value)}</strong><span>execução hoje</span></div></div>
}
