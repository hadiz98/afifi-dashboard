"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { apiFetch, readApiData } from "@/lib/api";
import { ApiError } from "@/lib/api-error";
import {
  getAccessToken,
  getRefreshToken,
  setAuthSession,
} from "@/lib/auth-session";
import { normalizeAuthBundle } from "@/lib/auth-normalize";
import { toastApiError } from "@/lib/toast-api-error";
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
import { Skeleton } from "@/components/ui/skeleton";

type Profile = Record<string, unknown>;

function pickName(p: Profile): string {
  const n = p.name;
  return typeof n === "string" ? n : "";
}

function pickEmail(p: Profile): string {
  const e = p.email;
  return typeof e === "string" ? e : "";
}

export function ProfileForm() {
  const t = useTranslations("ProfilePage");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        name: z.string().min(1, t("nameRequired")),
        email: z.string().email(t("emailInvalid")),
      }),
    [t]
  );

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", email: "" },
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/users/profile", { method: "GET" });
      const data = await readApiData<unknown>(res);
      if (data && typeof data === "object") {
        const p = data as Profile;
        setProfile(p);
        form.reset({ name: pickName(p), email: pickEmail(p) });
      }
    } catch (e) {
      toastApiError(e, t("loadError"));
    } finally {
      setLoading(false);
    }
  }, [form, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function onSubmit(values: FormValues) {
    try {
      const res = await apiFetch("/api/users/profile", {
        method: "PATCH",
        body: JSON.stringify({ name: values.name, email: values.email }),
      });
      const dataM = await readApiData<unknown>(res);
      if (dataM && typeof dataM === "object") {
        const p = dataM as Profile;
        setProfile(p);
        form.reset({ name: pickName(p), email: pickEmail(p) });
      }
      const refresh = getRefreshToken();
      const access = getAccessToken();
      if (refresh && access) {
        const meRes = await apiFetch("/api/auth/me", { method: "GET" });
        const meRaw = await readApiData<unknown>(meRes);
        const bundle = normalizeAuthBundle({
          accessToken: access,
          refreshToken: refresh,
          user: meRaw,
        });
        if (bundle) {
          setAuthSession(
            {
              accessToken: bundle.accessToken,
              refreshToken: bundle.refreshToken,
              user: bundle.user,
              expiresIn: bundle.expiresIn,
              sessionId: bundle.sessionId,
            },
            { fromRefresh: true }
          );
        }
      }
      toast.success(t("saveSuccess"));
    } catch (e) {
      if (e instanceof ApiError) {
        toastApiError(e, t("saveError"));
      } else {
        toastApiError(e, t("saveError"));
      }
    }
  }

  if (loading && !profile) {
    return (
      <div className="mx-auto w-full max-w-lg space-y-4 p-4 md:p-8">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
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
              <Label htmlFor="profile-name">{t("nameLabel")}</Label>
              <Input
                id="profile-name"
                disabled={form.formState.isSubmitting}
                {...form.register("name")}
              />
              {form.formState.errors.name && (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.name.message}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="profile-email">{t("emailLabel")}</Label>
              <Input
                id="profile-email"
                type="email"
                disabled={form.formState.isSubmitting}
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting ? t("saving") : t("save")}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
