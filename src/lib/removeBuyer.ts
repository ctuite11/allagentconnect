import { toast } from "sonner";
import { invokeEdgeFunction, resolveEdgeFunctionErrorMessage } from "@/lib/invokeEdgeFunction";

export const REMOVE_BUYER_BUTTON_LABEL = "Remove Buyer";

export const REMOVE_BUYER_DIALOG_TITLE = "Remove buyer?";

export const REMOVE_BUYER_DIALOG_BODY =
  "This will remove the buyer's AAC account access and end their relationship with you. This action cannot be undone.";

export type RemoveBuyerStatus = "removed" | "relationship_ended_only";

export type RemoveBuyerResponse = {
  success: true;
  status: RemoveBuyerStatus;
  auth_deleted?: boolean;
  reason?: string;
};

export type RemoveBuyerRequest =
  | { scope: "agent"; crmClientId: string }
  | { scope: "self" }
  | { scope: "admin"; userId: string };

export type RemoveBuyerOutcome =
  | { ok: true; response: RemoveBuyerResponse; showedSuccessToast: boolean }
  | { ok: false; message: string };

function buildRemoveBuyerBody(request: RemoveBuyerRequest): Record<string, string> {
  switch (request.scope) {
    case "agent":
      return { crm_client_id: request.crmClientId };
    case "admin":
      return { user_id: request.userId };
    case "self":
      return {};
  }
}

/** Maps edge-function status into the standardized success toasts. */
export function showRemoveBuyerSuccessToast(response: RemoveBuyerResponse): boolean {
  if (response.status === "removed" && response.auth_deleted === true) {
    toast.success("Buyer removed.");
    return true;
  }

  if (
    response.status === "relationship_ended_only" &&
    response.reason === "linked_to_other_agent"
  ) {
    toast.success(
      "Relationship ended, but buyer account could not be removed because the buyer is connected to another agent.",
    );
    return true;
  }

  return false;
}

/**
 * Single UI entry point for buyer removal. Calls the `remove-buyer` edge function
 * and surfaces standardized success toasts for recognized outcomes.
 */
export async function removeBuyer(request: RemoveBuyerRequest): Promise<RemoveBuyerOutcome> {
  try {
    const data = await invokeEdgeFunction<RemoveBuyerResponse>(
      "remove-buyer",
      buildRemoveBuyerBody(request),
    );

    const showedSuccessToast = showRemoveBuyerSuccessToast(data);
    return { ok: true, response: data, showedSuccessToast };
  } catch (error: unknown) {
    const message = await resolveEdgeFunctionErrorMessage(error);
    console.error("[removeBuyer] failed", { request, error });
    toast.error(message);
    return { ok: false, message };
  }
}
