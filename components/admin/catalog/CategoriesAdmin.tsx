"use client";

/**
 * `/admin/kategorije` — tree editor (systems → categories → subcategories) with product
 * counts, reorder among siblings, new subcategories; the selected node's names, SEO texts,
 * thumbnail (built render or an uploaded image) and 3D mapping (the taxonomy part and its
 * clickable node ids from the 3D contract).
 */
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState } from "react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CubeIcon,
  PlusIcon,
  UploadSimpleIcon,
} from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { CATEGORIES, partNodeName } from "@/lib/catalog/taxonomy";
import { cn } from "@/lib/cn";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { IconButton } from "@/components/ui/IconButton";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { Textarea } from "@/components/ui/Textarea";
import { toast } from "@/components/ui/Toast";

import { PageHeader, SaveBar, Section } from "../ui";

type Node = FunctionReturnType<typeof api.catalog.categoriesAdmin.tree>[number];

const MESH_CATEGORIES = CATEGORIES.filter((c) => c.instances.length > 0);

export function CategoriesAdmin() {
  const tree = useQuery(api.catalog.categoriesAdmin.tree, {});
  const move = useMutation(api.catalog.categoriesAdmin.move);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState<Node | null>(null);
  const selected =
    tree?.find((n) => n._id === selectedId) ?? tree?.find((n) => n.kind === "category") ?? null;

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Kategorije"
        description="Stablo kataloga, tekstovi za pretraživače, sličice i veza sa delovima 3D automobila."
      />
      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <Section title="Stablo" panel>
          {!tree ? (
            <Skeleton className="h-96 w-full" />
          ) : (
            <ul
              className="-mx-4 -my-2 max-h-[calc(100dvh-14rem)] overflow-y-auto"
              aria-label="Kategorije"
            >
              {tree.map((n) => {
                const siblings = tree.filter((s) => s.parentId === n.parentId && s.kind === n.kind);
                const pos = siblings.findIndex((s) => s._id === n._id);
                const isSelected = selected?._id === n._id;
                return (
                  <li
                    key={n._id}
                    className={cn(
                      "group flex items-center gap-2 border-b border-line-faint pr-2",
                      n.kind === "system"
                        ? "bg-surface-2 pl-4"
                        : n.kind === "category"
                          ? "pl-7"
                          : "pl-11",
                      isSelected && "bg-selected",
                    )}
                  >
                    {n.kind === "system" ? (
                      <span className="flex h-9 flex-1 items-center type-label uppercase text-ink-3">
                        {n.name}
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSelectedId(n._id)}
                        aria-current={isSelected ? "true" : undefined}
                        className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 text-left type-body-s focus-ring-inset"
                      >
                        <span
                          className={cn(
                            "truncate",
                            n.active ? "text-ink-1" : "text-ink-3 line-through",
                          )}
                        >
                          {n.name}
                        </span>
                        {n.partKey ? (
                          <CubeIcon
                            size={14}
                            className="shrink-0 text-ink-3"
                            aria-label="povezano sa 3D delom"
                          />
                        ) : null}
                        <span className="ml-auto shrink-0 type-caption tabular-nums text-ink-3">
                          {n.productCount}
                        </span>
                      </button>
                    )}
                    <span className="flex opacity-0 transition-control group-focus-within:opacity-100 group-hover:opacity-100">
                      <IconButton
                        label={`Pomeri „${n.name}“ gore`}
                        icon={<ArrowUpIcon size={14} />}
                        size="sm"
                        disabled={pos <= 0}
                        onClick={() => void move({ categoryId: n._id, direction: "up" })}
                      />
                      <IconButton
                        label={`Pomeri „${n.name}“ dole`}
                        icon={<ArrowDownIcon size={14} />}
                        size="sm"
                        disabled={pos === siblings.length - 1}
                        onClick={() => void move({ categoryId: n._id, direction: "down" })}
                      />
                      {n.kind !== "subcategory" ? (
                        <IconButton
                          label={`Nova kategorija u „${n.name}“`}
                          icon={<PlusIcon size={14} />}
                          size="sm"
                          onClick={() => setCreating(n)}
                        />
                      ) : null}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>
        {selected ? (
          <CategoryForm key={`${selected._id}:${selected.updatedAt}`} node={selected} />
        ) : null}
      </div>
      {creating ? (
        <CreateDialog
          parent={creating}
          onClose={(id) => (setCreating(null), id && setSelectedId(id))}
        />
      ) : null}
    </div>
  );
}

function CreateDialog({ parent, onClose }: { parent: Node; onClose: (id?: string) => void }) {
  const create = useMutation(api.catalog.categoriesAdmin.create);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      title={`Nova kategorija u „${parent.name}“`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onClose()}>
            Odustani
          </Button>
          <Button
            loading={busy}
            disabled={name.trim().length < 2}
            onClick={async () => {
              setBusy(true);
              try {
                const id = await create({ parentId: parent._id, name });
                toast.success("Kategorija je napravljena (neaktivna dok je ne uključite).");
                onClose(id);
              } catch (err) {
                toast.error(convexErrorMessage(err, "Kategorija nije napravljena."));
                setBusy(false);
              }
            }}
          >
            Napravi
          </Button>
        </>
      }
    >
      <Field label="Naziv" help="Adresa (slug) se pravi iz naziva i posle se ne menja.">
        <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
      </Field>
    </Dialog>
  );
}

function CategoryForm({ node }: { node: Node }) {
  const update = useMutation(api.catalog.categoriesAdmin.update);
  const uploadUrl = useMutation(api.catalog.categoriesAdmin.generateThumbnailUploadUrl);
  const setThumbnail = useMutation(api.catalog.categoriesAdmin.setThumbnail);
  const initial = {
    name: node.name,
    active: node.active,
    intro: node.intro ?? "",
    seoTitle: node.seoTitle ?? "",
    seoDescription: node.seoDescription ?? "",
    partKey: node.partKey ?? "",
  };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const taxonomy = MESH_CATEGORIES.find((c) => c.slug === form.partKey);
  const thumb = node.thumbnailUrl ?? node.thumbnailPath;

  const save = async () => {
    setSaving(true);
    try {
      await update({
        categoryId: node._id,
        name: form.name,
        active: form.active,
        intro: form.intro,
        seoTitle: form.seoTitle,
        seoDescription: form.seoDescription,
        partKey: form.partKey,
      });
      toast.success("Sačuvano.");
    } catch (err) {
      toast.error(convexErrorMessage(err, "Kategorija nije sačuvana."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Section
        title={node.name}
        actions={
          <span className="flex items-center gap-2 type-caption text-ink-3">
            <span className="type-code-s">/{node.slug}</span>
            <Badge tone="neutral">
              {node.productCount} art. · {node.inStockCount} na stanju
            </Badge>
          </span>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Naziv">
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              maxLength={80}
            />
          </Field>
          <div className="flex items-end">
            <Switch
              label="Vidljiva na sajtu"
              checked={form.active}
              onCheckedChange={(v) => setForm({ ...form, active: v })}
              className="w-full"
            />
          </div>
          <Field
            label="Uvodni tekst"
            optional
            help="80–180 reči: šta deo radi, kada se menja, savet iz radionice."
            className="md:col-span-2"
          >
            <Textarea
              rows={6}
              maxLength={3000}
              value={form.intro}
              onChange={(e) => setForm({ ...form, intro: e.target.value })}
            />
          </Field>
          <Field label="Naslov za pretraživače" optional help={`${form.seoTitle.length}/60`}>
            <Input
              value={form.seoTitle}
              onChange={(e) => setForm({ ...form, seoTitle: e.target.value })}
              maxLength={70}
            />
          </Field>
          <Field label="Opis za pretraživače" optional help={`${form.seoDescription.length}/155`}>
            <Textarea
              rows={2}
              maxLength={170}
              value={form.seoDescription}
              onChange={(e) => setForm({ ...form, seoDescription: e.target.value })}
            />
          </Field>
        </div>
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Sličica">
          <div className="flex items-start gap-4">
            <span className="flex size-28 shrink-0 items-center justify-center overflow-hidden rounded-sm border border-line bg-bg">
              {thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- category render or uploaded image, admin preview
                <img src={thumb} alt="" className="size-full object-contain" />
              ) : (
                <span className="type-caption text-ink-3">nema</span>
              )}
            </span>
            <div className="flex flex-col gap-2 type-body-s text-ink-2">
              <p>
                {node.thumbnailUrl
                  ? "Otpremljena slika."
                  : node.thumbnailPath
                    ? "Render iz 3D modela."
                    : "Bez sličice."}
              </p>
              <label className="inline-flex">
                <span className="sr-only">Otpremi sličicu</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    try {
                      const url = await uploadUrl({});
                      const res = await fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": file.type },
                        body: file,
                      });
                      const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
                      await setThumbnail({ categoryId: node._id, storageId });
                      toast.success("Sličica je otpremljena.");
                    } catch (err) {
                      toast.error(convexErrorMessage(err, "Sličica nije otpremljena."));
                    }
                  }}
                />
                <span
                  aria-hidden="true"
                  className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-xs border border-control px-3 type-button-s text-ink-1 hover:bg-surface-2"
                >
                  <UploadSimpleIcon size={16} /> Otpremi sliku
                </span>
              </label>
              {node.thumbnailUrl ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="self-start"
                  onClick={() => void setThumbnail({ categoryId: node._id, storageId: null })}
                >
                  Vrati render
                </Button>
              ) : null}
            </div>
          </div>
        </Section>

        <Section title="3D automobil">
          <div className="flex flex-col gap-3">
            <Field
              label="Deo u 3D modelu"
              help="Klik na ovaj deo automobila otvara ovu kategoriju. Jedan deo ide jednoj kategoriji."
            >
              <Select
                size="sm"
                placeholder="Bez veze sa 3D modelom"
                value={form.partKey}
                onChange={(e) => setForm({ ...form, partKey: e.target.value })}
                options={MESH_CATEGORIES.map((c) => ({
                  value: c.slug,
                  label: `${c.labelSr} (${c.slug})`,
                }))}
              />
            </Field>
            {taxonomy ? (
              <div>
                <p className="mb-1 type-caption text-ink-3">
                  Čvorovi u modelu ({taxonomy.instances.length}):
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {taxonomy.instances.map((i) => (
                    <li
                      key={i.instance}
                      title={i.labelSr}
                      className="rounded-xs border border-line bg-surface-2 px-1.5 py-0.5 type-code-s text-ink-2"
                    >
                      {partNodeName(taxonomy.slug, i.instance)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className="type-body-s text-ink-3">
                Kategorija se vidi u katalogu i pretrazi, ali ne i na 3D automobilu.
              </p>
            )}
          </div>
        </Section>
      </div>
      <SaveBar
        dirty={dirty}
        saving={saving}
        onSave={() => void save()}
        onDiscard={() => setForm(initial)}
      />
    </div>
  );
}
