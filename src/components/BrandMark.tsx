import { useId } from "react";

/**
 * Brand mark: a reply bubble carrying an approval check.
 * The bubble is the conversation, the check is the human approving the
 * assisted reply, and the indigo-to-violet gradient signals the AI layer.
 * Designed on a 32-unit grid so it stays crisp at 16, 24 and 32 px.
 */
export function BrandMark({ size = 32, className, title = "CX Reply Assistant" }: { size?: number; className?: string; title?: string }) {
  const id = useId();
  const gradientId = `cx-mark-${id.replace(/:/g, "")}`;
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label={title} className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={gradientId} x1="4" y1="3" x2="29" y2="30" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#4f46e5" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      <path d="M10 3H22A8 8 0 0 1 30 11V18A8 8 0 0 1 22 26H16L9 31L10 26A8 8 0 0 1 2 18V11A8 8 0 0 1 10 3Z" fill={`url(#${gradientId})`} />
      <path d="M10 14.5L14.5 19L22.5 10.5" stroke="#ffffff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
