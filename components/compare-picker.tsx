"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface PickerBuild {
  id: string;
  name: string;
  ascendancy: string | null;
  level: number | null;
}

function BuildSelect({
  label,
  builds,
  value,
  onChange,
}: {
  label: string;
  builds: PickerBuild[];
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex-1 space-y-2">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder="Choose a build…" />
        </SelectTrigger>
        <SelectContent>
          {builds.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name}
              {b.ascendancy ? ` — ${b.ascendancy}` : ""}
              {b.level != null ? ` (lvl ${b.level})` : ""}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ComparePicker({ builds }: { builds: PickerBuild[] }) {
  const router = useRouter();
  const [sourceId, setSourceId] = useState<string>();
  const [targetId, setTargetId] = useState<string>();

  const source = builds.find((b) => b.id === sourceId);
  const target = builds.find((b) => b.id === targetId);
  const sameBuild = !!source && sourceId === targetId;
  const mismatch =
    !!source && !!target && !sameBuild && source.ascendancy !== target.ascendancy;
  const canCompare = !!source && !!target && !sameBuild && !mismatch;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-stretch gap-4 sm:flex-row sm:items-end">
        <BuildSelect
          label="Your build (source)"
          builds={builds}
          value={sourceId}
          onChange={setSourceId}
        />
        <ArrowRight className="mx-auto hidden h-5 w-5 shrink-0 text-muted-foreground sm:mb-2.5 sm:block" />
        <BuildSelect
          label="Target build"
          builds={builds}
          value={targetId}
          onChange={setTargetId}
        />
      </div>

      {sameBuild && (
        <Alert variant="destructive">
          <AlertDescription>Pick two different builds.</AlertDescription>
        </Alert>
      )}
      {mismatch && (
        <Alert variant="destructive">
          <AlertDescription>
            These builds are different ascendancies ({source?.ascendancy} vs.{" "}
            {target?.ascendancy}). Comparison requires the same ascendancy.
          </AlertDescription>
        </Alert>
      )}

      <Button
        disabled={!canCompare}
        onClick={() => router.push(`/compare/${sourceId}/${targetId}`)}
      >
        Compare
        <ArrowRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
