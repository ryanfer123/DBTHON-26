type Props = {
  deliveredKg: string;
  days: string;
  includesDemoData: boolean;
};

export function ImpactScore({ deliveredKg, days, includesDemoData }: Props) {
  const points = Math.round(Number(deliveredKg) * 10);
  const milestone = (Math.floor(points / 100) + 1) * 100;
  return (
    <section className="impact-score" aria-labelledby="impact-score-heading">
      <div className="impact-score-heading">
        <h2 id="impact-score-heading">Impact score</h2>
        <span className="badge">Last {days} days</span>
      </div>
      <p className="impact-score-value">
        {points.toLocaleString()} <span>points</span>
      </p>
      <p>
        10 points per kilogram successfully delivered, rounded to the nearest
        whole point. Each listing counts once across your roles.
      </p>
      <label htmlFor="impact-score-progress">
        {(milestone - points).toLocaleString()} points to your next milestone of{" "}
        {milestone.toLocaleString()}
      </label>
      <progress id="impact-score-progress" value={points} max={milestone} />
      {points === 0 && (
        <p className="field-help">
          Your score grows when a food exchange you participate in is delivered.
        </p>
      )}
      {includesDemoData && (
        <p className="field-help">
          Includes demo activity, not pilot evidence.
        </p>
      )}
    </section>
  );
}
