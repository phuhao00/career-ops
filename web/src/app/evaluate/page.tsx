import { EvaluateView } from "@/components/evaluate/evaluate-view";
import { pipelineSummary } from "@/lib/career-ops";

export const dynamic = "force-dynamic";

export default function EvaluatePage() {
  const { applications } = pipelineSummary();
  return <EvaluateView applications={applications} />;
}
