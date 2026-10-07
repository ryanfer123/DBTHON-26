export function formatRemaining(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (!total) return "Deadline reached";
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (total < 300) return `${minutes} min ${total % 60} s left`;
  if (!hours) return `${Math.max(1, minutes)} min left`;
  return minutes ? `${hours} h ${minutes} min left` : `${hours} h left`;
}
