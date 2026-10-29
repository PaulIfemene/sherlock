import { Eyebrow } from './Pill'

/** Temporary page body for routes built in a later milestone. */
export function Placeholder({ title, milestone }: { title: string; milestone: string }) {
  return (
    <section className="container-x py-20">
      <Eyebrow>{milestone}</Eyebrow>
      <h1 className="display-md mt-4">{title}</h1>
      <p className="mt-3 text-ink-mute">This page is built in {milestone}.</p>
    </section>
  )
}
