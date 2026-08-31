import { CreateWorkspaceFlow } from "@/components/workspace/create-workspace-flow";

export const dynamic = "force-dynamic";

export default function CreateWorkspacePage() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <CreateWorkspaceFlow />
    </div>
  );
}