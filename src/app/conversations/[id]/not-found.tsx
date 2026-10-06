import { ArrowLeft, MessageSquare } from "lucide-react";
import Link from "next/link";

export default function ConversationNotFound() {
  return (
    <div className="mx-auto max-w-md animate-fade-up py-24 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
        <MessageSquare className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="display mt-6 text-2xl font-semibold text-stone-900">Conversation not found</h1>
      <p className="mt-2 text-sm leading-relaxed text-stone-500">
        It may have been removed, or the in-memory store was reset when the server restarted.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex items-center gap-2 rounded-full bg-stone-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-stone-700"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> Back to inbox
      </Link>
    </div>
  );
}
