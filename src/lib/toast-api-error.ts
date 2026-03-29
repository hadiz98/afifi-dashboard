"use client";

import { toast } from "sonner";
import { ApiError } from "@/lib/api-error";

export function toastApiError(
  error: unknown,
  fallbackMessage: string
): string {
  if (error instanceof ApiError) {
    toast.error(fallbackMessage, { description: error.message });
    return error.message;
  }
  if (error instanceof Error) {
    toast.error(fallbackMessage, { description: error.message });
    return error.message;
  }
  toast.error(fallbackMessage);
  return fallbackMessage;
}
