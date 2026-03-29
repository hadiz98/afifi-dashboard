"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { useRouter } from "@/i18n/navigation";
import { apiFetch, readApiData } from "@/lib/api";
import { toastApiError } from "@/lib/toast-api-error";
import { clearAuthSession } from "@/lib/auth-session";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function PasswordForm() {
  const t = useTranslations("PasswordPage");
  const router = useRouter();

  const schema = useMemo(
    () =>
      z
        .object({
          currentPassword: z.string().min(1, t("currentRequired")),
          newPassword: z.string().min(8, t("newMin")),
          confirm: z.string().min(1, t("confirmRequired")),
        })
        .refine((data) => data.newPassword === data.confirm, {
          message: t("mismatch"),
          path: ["confirm"],
        }),
    [t]
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirm: "",
    },
  });

  async function onSubmit(values: FormValues) {
    try {
      const res = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      await readApiData<unknown>(res);
      toast.success(t("success"));
      clearAuthSession();
      router.replace("/login");
      router.refresh();
    } catch (e) {
      toastApiError(e, t("error"));
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle>{t("title")}</CardTitle>
          <CardDescription>{t("description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-4"
            onSubmit={form.handleSubmit(onSubmit)}
            noValidate
          >
            <div className="grid gap-2">
              <Label htmlFor="current-password">{t("currentLabel")}</Label>
              <Input
                id="current-password"
                type="password"
                autoComplete="current-password"
                disabled={form.formState.isSubmitting}
                {...form.register("currentPassword")}
              />
              {form.formState.errors.currentPassword && (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.currentPassword.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-password">{t("newLabel")}</Label>
              <Input
                id="new-password"
                type="password"
                autoComplete="new-password"
                disabled={form.formState.isSubmitting}
                {...form.register("newPassword")}
              />
              {form.formState.errors.newPassword && (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.newPassword.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">{t("confirmLabel")}</Label>
              <Input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                disabled={form.formState.isSubmitting}
                {...form.register("confirm")}
              />
              {form.formState.errors.confirm && (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.confirm.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("submitting") : t("submit")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
