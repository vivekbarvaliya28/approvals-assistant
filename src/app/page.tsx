import { ApprovalsAssistant } from "@/components/ApprovalsAssistant";
import { ApprovalsWorkspace } from "@/components/ApprovalsWorkspace";

// The main page: the approvals table, with the assistant widget floating on top.
export default function Home() {
  return (
    <main className="min-h-screen p-4 sm:p-8">
      <ApprovalsWorkspace />
      <ApprovalsAssistant />
    </main>
  );
}
