import { ButtonLink } from '../components/Button'

export default function NotFound() {
  return (
    <section className="container-x py-24">
      <p className="micro-cap text-ink-mute">404</p>
      <h1 className="display-md mt-3">We could not find that page</h1>
      <ButtonLink to="/" className="mt-6">
        Back to Sherlock
      </ButtonLink>
    </section>
  )
}
