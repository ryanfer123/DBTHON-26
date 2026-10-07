/** A shared table and growing leaves, framed by a plate. */
export function BrandMark() {
  return (
    <svg
      className="brand-mark"
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="24" cy="24" r="21" stroke="currentColor" strokeWidth="2.5" />
      <path
        d="M24 24C16 24 12 19 13 12C20 12 25 16 24 24ZM24 24C24 16 29 12 36 13C36 20 32 25 24 24Z"
        fill="currentColor"
      />
      <path
        d="M24 23V30M12 31H36M17 31V37M31 31V37"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
