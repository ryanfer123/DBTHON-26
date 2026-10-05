const guidance = [
  ['Start with verified roles', 'Your zone administrator reviews requested roles before food can be listed, claimed or delivered.'],
  ['Make the deadline clear', 'Donors provide preparation times and collection deadlines. Check storage and handling directly before accepting food.'],
  ['Keep the outcome visible', 'Follow an exchange through pickup and delivery, then leave a rating once it is complete.'],
]
const questions = [
  ['Can I have more than one role?', 'Yes. You can request donor, receiver and volunteer roles in one account. Each role needs approval before its tools appear.'],
  ['How close does food need to be?', 'Discovery and allocation stay within your community zone and a maximum of 5 km from your saved location. Receivers also see only whole quantities within their declared capacity. Update your location in your account when needed.'],
  ['Why is my account awaiting verification?', 'Your zone administrator needs to review your requested roles. You can update your details and refresh verification status from your account. Approval opens the corresponding food-sharing tools.'],
  ['What happens if a collection is missed?', 'A scheduled collection has a 15-minute grace period. After that, another volunteer can accept while the deadline is still open. At the donor’s deadline the exchange expires; food already picked up is never automatically relisted.'],
]
export function HomeGuidance() {
  return <div className="container home-guidance">
    <section aria-labelledby="handover-heading"><h2 id="handover-heading">A clear handover, every time.</h2><ol className="handover-list">{guidance.map(([title, text], index) => <li key={title}><span className="step-number" aria-hidden="true">{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}</ol></section>
    <section className="home-faq" aria-labelledby="faq-heading"><h2 id="faq-heading">Good questions, answered.</h2>{questions.map(([question, answer], index) => <details key={question} open={index === 0}>
      <summary>{question}<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14" /><path className="disclosure-vertical" d="M12 5v14" /></svg></summary><p>{answer}</p>
    </details>)}</section>
  </div>
}
