"use client";

import { CheckCircle2, Network, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";

import {
  searchHorsesByName,
  type HorseCategory,
  type HorseDetails,
  type HorsePedigreeUpdatePayload,
} from "@/lib/horses-api";

export type PedigreeRelKey = "father" | "mother";
export type PedigreeInputMode = "select" | "manual";

export type PedigreeHorseOption = {
  id: string;
  name: string;
  slug: string;
  category: HorseCategory;
};

export type PedigreeSlot = {
  mode: PedigreeInputMode;

  query: string;
  selected: PedigreeHorseOption | null;

  options: PedigreeHorseOption[];
  isSearching: boolean;

  name: string;
  birthDate: string;
  color: string;
};

type Props = {
  open: boolean;
  item: HorseDetails | null;
  submitting: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: HorsePedigreeUpdatePayload) => void | Promise<void>;
  t: (key: string) => string;
};

const PEDIGREE_KEYS: readonly PedigreeRelKey[] = ["father", "mother"];

function emptySlot(mode: PedigreeInputMode = "select"): PedigreeSlot {
  return {
    mode,
    query: "",
    selected: null,
    options: [],
    isSearching: false,
    name: "",
    birthDate: "",
    color: "",
  };
}

function formatOptionDisplay(opt: PedigreeHorseOption): string {
  return `${opt.name} (${opt.slug})`;
}

/* -------------------- Debounce Hook -------------------- */
function useDebounce<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return debounced;
}

/* ====================================================== */

export function HorsePedigreeDialog({
  open,
  item,
  submitting,
  onOpenChange,
  onSubmit,
  t,
}: Props) {
  const [slots, setSlots] = useState<Record<PedigreeRelKey, PedigreeSlot>>({
    father: emptySlot(),
    mother: emptySlot(),
  });

  /* -------------------- Helpers -------------------- */
  const updateSlot = useCallback(
    (key: PedigreeRelKey, patch: Partial<PedigreeSlot>) => {
      setSlots((prev) => ({
        ...prev,
        [key]: { ...prev[key], ...patch },
      }));
    },
    []
  );

  const switchMode = (key: PedigreeRelKey, mode: PedigreeInputMode) => {
    updateSlot(key, {
      mode,
      selected: null,
      query: "",
      options: [],
    });
  };

  /* -------------------- Debounced Queries -------------------- */
  const debouncedFather = useDebounce(slots.father.query);
  const debouncedMother = useDebounce(slots.mother.query);

  /* -------------------- Search Effect -------------------- */
  useEffect(() => {
    const runSearch = async (key: PedigreeRelKey, query: string) => {
      if (!query.trim()) {
        updateSlot(key, { options: [], isSearching: false });
        return;
      }

      updateSlot(key, { isSearching: true });

      try {
        const res = await searchHorsesByName({ q: query, limit: 20 });

        const options = res.rows.map((row) => {
          const tr =
            row.translations.find((x) => x.locale === "en") ??
            row.translations[0];

          return {
            id: row.id,
            name: tr?.name || row.slug,
            slug: row.slug,
            category: row.category,
          };
        });

        updateSlot(key, { options, isSearching: false });
      } catch {
        updateSlot(key, { options: [], isSearching: false });
      }
    };

    runSearch("father", debouncedFather);
    runSearch("mother", debouncedMother);
  }, [debouncedFather, debouncedMother, updateSlot]);

  /* -------------------- Save -------------------- */
  const handleSave = async () => {
    const payload: HorsePedigreeUpdatePayload = {};
    const manual: any = {};

    for (const key of PEDIGREE_KEYS) {
      const slot = slots[key];
      const isFather = key === "father";

      if (slot.mode === "select") {
        const id = slot.selected?.id ?? null;
        if (isFather) payload.sireId = id;
        else payload.damId = id;
      } else {
        if (isFather) payload.sireId = null;
        else payload.damId = null;

        manual[key] =
          slot.name || slot.birthDate || slot.color
            ? {
              name: slot.name || null,
              birthDate: slot.birthDate || null,
              color: slot.color || null,
            }
            : null;
      }
    }

    if (
      payload.sireId &&
      payload.damId &&
      payload.sireId === payload.damId
    ) {
      toast.error(t("pedigreeDistinctParentsValidation"));
      return;
    }

    if (Object.keys(manual).length) payload.manual = manual;

    await onSubmit(payload);
  };

  /* ====================================================== */

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px]">
        <DialogHeader>
          <DialogTitle>{t("dialogEditPedigreeTitle")}</DialogTitle>
          <DialogDescription>
            {t("dialogEditPedigreeDescription")}
          </DialogDescription>
        </DialogHeader>

        <Separator />

        <div className="space-y-4">
          {PEDIGREE_KEYS.map((key) => {
            const slot = slots[key];

            return (
              <div key={key} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <p className="text-sm font-medium">
                    {key === "father"
                      ? t("pedigreeFather")
                      : t("pedigreeMother")}
                  </p>

                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant={slot.mode === "select" ? "default" : "ghost"}
                      onClick={() => switchMode(key, "select")}
                    >
                      Select
                    </Button>
                    <Button
                      size="sm"
                      variant={slot.mode === "manual" ? "default" : "ghost"}
                      onClick={() => switchMode(key, "manual")}
                    >
                      Manual
                    </Button>
                  </div>
                </div>

                {slot.mode === "select" ? (
                  <>
                    <Combobox
                      value={slot.selected?.id ?? ""}
                      onValueChange={(value) => {
                        const picked =
                          slot.options.find((o) => o.id === value) || null;

                        updateSlot(key, {
                          selected: picked,
                          query: picked
                            ? formatOptionDisplay(picked)
                            : "",
                          options: [],
                        });
                      }}
                    >
                      <ComboboxInput
                        value={slot.query}
                        onChange={(e) =>
                          updateSlot(key, {
                            query: e.target.value,
                            selected: null,
                          })
                        }
                        placeholder={t("pedigreeTypeToSearch")}
                      />

                      <ComboboxContent>
                        <ComboboxEmpty>
                          {slot.isSearching
                            ? "Loading..."
                            : "No results"}
                        </ComboboxEmpty>

                        <ComboboxList>
                          {slot.options.map((opt) => (
                            <ComboboxItem key={opt.id} value={opt.id}>
                              {opt.name} ({opt.slug})
                            </ComboboxItem>
                          ))}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>

                    {slot.selected && (
                      <p className="text-xs text-green-600 flex gap-1">
                        <CheckCircle2 size={14} />
                        {formatOptionDisplay(slot.selected)}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="grid grid-cols-3 gap-2">
                    <Input
                      placeholder="Name"
                      value={slot.name}
                      onChange={(e) =>
                        updateSlot(key, { name: e.target.value })
                      }
                    />
                    <Input
                      type="date"
                      value={slot.birthDate}
                      onChange={(e) =>
                        updateSlot(key, { birthDate: e.target.value })
                      }
                    />
                    <Input
                      placeholder="Color"
                      value={slot.color}
                      onChange={(e) =>
                        updateSlot(key, { color: e.target.value })
                      }
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>

          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? (
              <RefreshCw className="animate-spin" />
            ) : (
              <Network />
            )}
            {t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}