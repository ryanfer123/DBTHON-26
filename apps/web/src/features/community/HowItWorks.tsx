const steps = [
  ['List surplus', 'Share what you have and when it’s ready.'],
  ['Claim nearby', 'Find food within your local community.'],
  ['Deliver in time', 'Help food reach its next table.'],
]

export function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works" aria-labelledby="how-heading">
      <h2 id="how-heading">From surplus to someone’s table</h2>
      <ol className="steps">
        {steps.map(([title, description], index) => (
          <li key={title}>
            <span className="step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{title}</h3><p>{description}</p></div>
          </li>
        ))}
      </ol>
    </section>
  )
}
