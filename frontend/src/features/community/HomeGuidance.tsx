import { questions } from "./helpContent";
const guidance = [
  [
    "Start with verified roles",
    "Your zone administrator reviews requested roles before food can be listed, claimed or delivered.",
  ],
  [
    "Make the deadline clear",
    "Donors provide preparation times and collection deadlines. Check storage and handling directly before accepting food.",
  ],
  [
    "Keep the outcome visible",
    "Follow an exchange through pickup and delivery, then leave a rating once it is complete.",
  ],
];
export function HomeGuidance() {
  return (
    <div className="container home-guidance">
      <section aria-labelledby="handover-heading">
        <h2 id="handover-heading">A clear handover, every time.</h2>
        <ol className="handover-list">
          {guidance.map(([title, text], index) => (
            <li key={title}>
              <span className="step-number" aria-hidden="true">
                {index + 1}
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="home-faq" aria-labelledby="faq-heading">
        <h2 id="faq-heading">Good questions, answered.</h2>
        {questions.map(([question, answer], index) => (
          <details key={question} open={index === 0}>
            <summary>
              {question}
              <svg
                aria-hidden="true"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M5 12h14" />
                <path className="disclosure-vertical" d="M12 5v14" />
              </svg>
            </summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
