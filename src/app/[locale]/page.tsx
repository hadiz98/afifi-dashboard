import { getTranslations } from "next-intl/server";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const t = await getTranslations("HomePage");

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between gap-4 border-b px-4 py-3">
        <span className="text-sm text-muted-foreground">{t("title")}</span>
        <div className="flex items-center gap-2">
          <SignOutButton />
          <LocaleSwitcher />
        </div>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-16">
        <div className="flex max-w-lg flex-col gap-3 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            {t("title")}
          </h1>
          <p className="text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button type="button">{t("cta")}</Button>
      </main>
    </div>
  );
}
