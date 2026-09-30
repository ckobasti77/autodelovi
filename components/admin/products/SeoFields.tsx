"use client";

/**
 * SEO title and description with counters and a search-result preview (DESIGN-SYSTEM
 * §10.12). Empty fields fall back to the generated title (name + maker + suffix) and the
 * first sentence of the description — the preview shows exactly that.
 */
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { site } from "@/config/site";

import { CharCount } from "../ui";

export function SeoFields({
  title,
  description,
  onTitle,
  onDescription,
  fallbackTitle,
  fallbackDescription,
  slug,
  titleSuffix,
}: {
  title: string;
  description: string;
  onTitle: (v: string) => void;
  onDescription: (v: string) => void;
  fallbackTitle: string;
  fallbackDescription: string;
  slug: string;
  titleSuffix: string;
}) {
  const shownTitle = `${title.trim() || fallbackTitle}${titleSuffix}`;
  const shownDescription = description.trim() || fallbackDescription;
  const host = site.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="flex flex-col gap-4">
        <Field
          label="Naslov za pretraživače"
          help={`Prazno: „${fallbackTitle}“. Do 60 znakova se vidi ceo.`}
        >
          <Input
            value={title}
            onChange={(e) => onTitle(e.target.value)}
            maxLength={70}
            suffix={<CharCount value={title} max={60} />}
          />
        </Field>
        <Field
          label="Opis za pretraživače"
          help={
            <>
              Do 155 znakova: šta je deo, za koja vozila, cena i stanje.{" "}
              <CharCount value={description} max={155} />
            </>
          }
        >
          <Textarea
            rows={3}
            maxLength={170}
            value={description}
            onChange={(e) => onDescription(e.target.value)}
          />
        </Field>
      </div>
      <div
        aria-label="Pregled u rezultatima pretrage"
        role="figure"
        className="rounded-sm border border-line bg-surface-1 p-4"
      >
        <p className="mb-2 type-label uppercase text-ink-3">Pregled u pretrazi</p>
        <p className="truncate text-[0.875rem] text-[#4d5156]">
          {host} › deo › {slug || "novi-artikal"}
        </p>
        <p className="line-clamp-1 text-[1.25rem] leading-snug text-[#1a0dab]">
          {shownTitle.length > 62 ? `${shownTitle.slice(0, 60)}…` : shownTitle}
        </p>
        <p className="line-clamp-2 text-[0.875rem] leading-normal text-[#4d5156]">
          {shownDescription.length > 158 ? `${shownDescription.slice(0, 155)}…` : shownDescription}
        </p>
      </div>
    </div>
  );
}
