import { SupabaseClient } from "@supabase/supabase-js";

export type ProcessingStepStatus = "pending" | "active" | "completed" | "failed";

export interface ProcessingStep {
  step: string;
  status: ProcessingStepStatus;
  startedAt?: string | null;
  finishedAt?: string | null;
  error?: string | null;
}

const DEFAULT_STEPS: ProcessingStep[] = [
  { step: "source_received", status: "pending" },
  { step: "validation_cleanup", status: "pending" },
  { step: "summary_generation", status: "pending" },
  { step: "action_item_extraction", status: "pending" },
  { step: "entity_relationship_extraction", status: "pending" },
  { step: "saved_to_memory", status: "pending" },
];

export function getDefaultProcessingSteps(): ProcessingStep[] {
  return DEFAULT_STEPS.map((step) => ({ ...step }));
}

function updateStep(steps: ProcessingStep[], stepKey: string, status: ProcessingStepStatus, error?: string): ProcessingStep[] {
  const now = new Date().toISOString();
  return steps.map((step) => {
    if (step.step !== stepKey) return step;

    const next: ProcessingStep = { ...step, status };
    if (status === "active" && !step.startedAt) {
      next.startedAt = now;
    }
    if ((status === "completed" || status === "failed") && !step.finishedAt) {
      next.finishedAt = now;
    }
    if (status === "failed") {
      next.error = error || "Unknown error";
    }
    return next;
  });
}

function deriveProcessingState(stepKey: string, status: ProcessingStepStatus): "processing" | "completed" | "failed" {
  if (status === "failed") return "failed";
  if (stepKey === "saved_to_memory" && status === "completed") return "completed";
  return "processing";
}

export async function setProcessingStep(
  supabase: SupabaseClient,
  sessionId: string,
  stepKey: string,
  status: ProcessingStepStatus,
  error?: string
) {
  const { data: session } = await supabase
    .from("sessions")
    .select("processing_steps")
    .eq("id", sessionId)
    .single();

  const currentSteps = Array.isArray(session?.processing_steps)
    ? session.processing_steps
    : getDefaultProcessingSteps();

  const updatedSteps = updateStep(currentSteps, stepKey, status, error);
  const processingState = deriveProcessingState(stepKey, status);
  const currentStep = status === "active" ? stepKey : null;

  await supabase
    .from("sessions")
    .update({
      processing_steps: updatedSteps,
      processing_state: processingState,
      current_step: currentStep,
    })
    .eq("id", sessionId);
}

export async function initializeProcessingSteps(
  supabase: SupabaseClient,
  sessionId: string
) {
  await supabase
    .from("sessions")
    .update({
      processing_steps: getDefaultProcessingSteps(),
      processing_state: "processing",
      current_step: "source_received",
    })
    .eq("id", sessionId);
}
