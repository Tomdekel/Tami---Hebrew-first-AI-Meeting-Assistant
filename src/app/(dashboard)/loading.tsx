import { Loader2 } from "lucide-react";

export default function DashboardLoading() {
  return (
    <div className="container mx-auto px-4 py-16 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
        <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
      </div>
    </div>
  );
}
