import { Link } from "react-router";
import { useSearchParams } from "react-router";
import { questions } from "../community/helpContent";
import { useAuth } from "../identity/AuthContext";
import { Workspace } from "./Workspace";
const guides = [
  {
    role: "Donor",
    title: "Share surplus food",
    text: "Publish the whole quantity and an accurate collection deadline. Follow reservations in your exchanges.",
    to: "/donations",
    label: "Open my donations",
  },
  {
    role: "Receiver",
    title: "Find and claim nearby food",
    text: "Search within your receiving capacity and community zone. Claiming reserves the whole listing.",
    to: "/food",
    label: "Find nearby food",
  },
  {
    role: "Volunteer",
    title: "Arrange collection and delivery",
    text: "Choose an available task, record pickup, and confirm delivery before the deadline.",
    to: "/deliveries",
    label: "Open deliveries",
  },
  {
    role: "Admin",
    title: "Keep your community moving",
    text: "Review requested member roles, inspect exchanges, and download your zone’s impact report.",
    to: "/admin",
    label: "Review community members",
  },
];
export function HelpPage() {
  const [search, setSearch] = useSearchParams();
  const { session } = useAuth();
  const q = search.get("q") ?? "";
  const matches = questions.filter(([question, answer]) =>
    `${question} ${answer}`.toLowerCase().includes(q.trim().toLowerCase()),
  );
  return (
    <Workspace title="A little help" intro="Find an answer or your next step.">
      <form
        className="help-search"
        onSubmit={(event) => {
          event.preventDefault();
          const value = String(
            new FormData(event.currentTarget).get("q"),
          ).trim();
          setSearch(value ? { q: value } : {});
        }}
      >
        <div className="field">
          <label htmlFor="help-search">Search help</label>
          <input
            key={q}
            id="help-search"
            name="q"
            type="search"
            maxLength={80}
            defaultValue={q}
          />
        </div>
        <button className="button button-small" type="submit">
          Search answers
        </button>
        {q && (
          <button
            className="text-button"
            type="button"
            onClick={() => setSearch({})}
          >
            Clear search
          </button>
        )}
      </form>
      <section className="home-faq help-faq">
        <h2>Good questions, answered.</h2>
        <p className="field-help">
          {matches.length} answers{q ? ` matching “${q}”` : ""}
        </p>
        {matches.map(([question, answer]) => (
          <details key={question}>
            <summary>{question}</summary>
            <p>{answer}</p>
          </details>
        ))}
        {!matches.length && (
          <p className="list-message">
            No answers match that search. Try “verification”, “capacity”, or
            “collection”.
          </p>
        )}
      </section>
      <p className="notice">
        Updates appear in your inbox. Manage SMS and push preferences in{" "}
        <Link className="text-link" to="/settings">
          Settings
        </Link>
        . External delivery is not configured in this build. WhatsApp links open
        a draft you choose to send.
      </p>
      <section className="dashboard-section">
        <h2>Your role guides</h2>
        <ul className="help-guides">
          {guides
            .filter((guide) =>
              session?.user.capabilities.includes(
                guide.role as "Donor" | "Receiver" | "Volunteer" | "Admin",
              ),
            )
            .map((guide) => (
              <li key={guide.role}>
                <h3>{guide.title}</h3>
                <p>{guide.text}</p>
                <Link className="text-link" to={guide.to}>
                  {guide.label}
                </Link>
              </li>
            ))}
        </ul>
        <p>
          Keep your location and contact details up to date.{" "}
          <Link className="text-link" to="/account">
            Open your account
          </Link>
        </p>
      </section>
    </Workspace>
  );
}
