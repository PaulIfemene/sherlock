import type { ReactNode } from 'react'

function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <article className="container-x max-w-3xl py-14 md:py-20">
      <div className="rounded-[12px] border border-gold bg-gold-cream px-4 py-3 text-[14px] font-semibold">Draft, legal review pending. Plain-language placeholder for the hackathon build.</div>
      <h1 className="display-lg mt-8">{title}</h1>
      <p className="mt-2 text-[14px] text-ink-mute">Last updated {updated}</p>
      <div className="mt-10 space-y-10 [&_h2]:text-[22px] [&_h2]:font-bold [&_h2]:tracking-[-0.01em] [&_li]:mt-2 [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5">{children}</div>
    </article>
  )
}

export function Terms() {
  return (
    <LegalPage title="Terms of use" updated="29 October 2026">
      <section>
        <h2>What Sherlock is</h2>
        <p>Sherlock helps you check claims you receive. It gives a suggested assessment based on the evidence it finds. A suggestion is not a final verdict. Only a verdict published by a journalist is final.</p>
      </section>
      <section>
        <h2>Using the service</h2>
        <ul>
          <li>Send only messages and images you are allowed to share.</li>
          <li>Do not send other people’s private information, such as phone numbers or ID numbers.</li>
          <li>Do not use Sherlock to harass anyone or to flood it with messages.</li>
        </ul>
      </section>
      <section>
        <h2>No guarantee</h2>
        <p>We work carefully, but evidence can be incomplete or change. Use Sherlock as one input, alongside your own judgement and official sources.</p>
      </section>
      <section>
        <h2>Newsrooms and data licensees</h2>
        <p>Newsroom subscriptions and data licences have their own agreements. Data licences cover aggregated, anonymised trends only, never individual messages or identities.</p>
      </section>
      <section>
        <h2>Changes</h2>
        <p>We may update these terms. We will show the date of the latest version on this page.</p>
      </section>
    </LegalPage>
  )
}

export function Privacy() {
  return (
    <LegalPage title="Privacy notice" updated="29 October 2026">
      <section>
        <h2>The short version</h2>
        <ul>
          <li>We do not store your phone number in plain form, and journalists never see it.</li>
          <li>Images are deleted within 24 hours.</li>
          <li>You can stop messages, export your data or erase it with one word.</li>
        </ul>
        <p>This notice is written with Uganda’s Data Protection and Privacy Act 2019 in mind.</p>
      </section>
      <section>
        <h2>What we collect</h2>
        <ul>
          <li>The message or screenshot you send, and the language you use.</li>
          <li>A scrambled ID made from your number (see below).</li>
          <li>Your number, encrypted, only so we can send you the verdict later.</li>
        </ul>
      </section>
      <section>
        <h2>How we protect your number</h2>
        <p>
          Your number is turned into an ID with a keyed hash (HMAC-SHA256). Unlike a plain hash, it cannot be reversed by trying every possible phone number, because that needs a secret key only our servers hold. Journalists and analytics only ever see this ID, and the dashboard shows just its first eight characters.
        </p>
        <p>To reply to you, we keep your number encrypted with AES-256-GCM in a separate table that only our server can read. It is decrypted only at the moment a reply is sent, and never written to logs.</p>
      </section>
      <section>
        <h2>What we share with other services</h2>
        <p>To check a claim we send its text to translation (Sunbird AI), an AI model, text recognition for images (Google Cloud Vision), and search services (Google Fact Check Tools, Brave Search). Before anything leaves our servers we remove phone numbers, email addresses, ID numbers and names we can detect.</p>
      </section>
      <section>
        <h2>How long we keep it</h2>
        <ul>
          <li>Images: deleted within 24 hours. We keep the text read from them and a fingerprint (a perceptual hash) to spot the same image again.</li>
          <li>Claims and your scrambled ID: kept while the service runs, or until you send DELETE.</li>
          <li>Researchers and platforms only ever receive aggregated, anonymised counts.</li>
        </ul>
      </section>
      <section>
        <h2>Your controls on WhatsApp</h2>
        <ul>
          <li>
            <b>STOP</b>: we stop messaging you. Send START to resume.
          </li>
          <li>
            <b>MYDATA</b>: we send you a summary of what we hold about you.
          </li>
          <li>
            <b>DELETE</b>: we erase your claims, your scrambled ID and your encrypted number.
          </li>
        </ul>
        <p>On the web checker you are identified only by a random ID stored in your browser. Clearing your browser data removes the link to it.</p>
      </section>
      <section>
        <h2>Contact</h2>
        <p>Questions about your data: contact Team Sherlock. A data protection contact will be named before public launch.</p>
      </section>
    </LegalPage>
  )
}
