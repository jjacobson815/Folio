import { Workspace } from "@/components/workspace/workspace";

/**
 * Server component shell. Everything interactive lives in <Workspace />, a client boundary that owns
 * store hydration, the deferred parse pipeline and the dual-pane layout.
 */
export default function Home() {
  return <Workspace />;
}
