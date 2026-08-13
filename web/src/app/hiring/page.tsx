import { loadHiringBoard } from "@/lib/hiring-board";
import { HiringBoardView } from "@/components/hiring/hiring-board";

export const dynamic = "force-dynamic";

export default function HiringPage() {
  const board = loadHiringBoard();
  return (
    <div className="mx-auto max-w-5xl px-6 py-8 max-sm:pb-24">
      <HiringBoardView board={board} />
    </div>
  );
}
