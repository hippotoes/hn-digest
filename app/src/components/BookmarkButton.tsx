"use client"
import { useOptimistic, useTransition } from "react";
import { bookmarkAction } from "@/app/actions";

interface Props {
  storyId: string;
  initialIsActive: boolean;
}

export default function BookmarkButton({ storyId, initialIsActive }: Props) {
  const [isPending, startTransition] = useTransition();
  const [optimisticActive, addOptimisticActive] = useOptimistic(
    initialIsActive,
    (state, newState: boolean) => newState
  );

  return (
    <button
      onClick={() => {
        startTransition(async () => {
          addOptimisticActive(!optimisticActive);
          await bookmarkAction(storyId);
        });
      }}
      disabled={isPending}
      className={`transition-colors p-1 text-xl ${
        optimisticActive ? "text-[#d4a017]" : "text-[#332f28] hover:text-[#9c9285]"
      }`}
      title={optimisticActive ? "Un-bookmark" : "Bookmark"}
    >
      {optimisticActive ? "🔖" : "🏷️"}
    </button>
  );
}
