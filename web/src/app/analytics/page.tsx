import { pipelineSummary } from "@/lib/career-ops";
import { AnalyticsView } from "@/components/analytics-view";

export const dynamic = "force-dynamic";

export default function Analytics() {
  const { applications } = pipelineSummary();
  return <AnalyticsView applications={applications} />;
}
