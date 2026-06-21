"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createBuild, type CreateBuildState } from "@/app/builds/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ImportBuildDialog({ triggerLabel = "Import build" }: { triggerLabel?: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CreateBuildState, FormData>(
    createBuild,
    null,
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state?.ok) return;
    toast.success("Build imported.");
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sync action result to dialog
    setOpen(false);
    formRef.current?.reset();
  }, [state]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import a build</DialogTitle>
          <DialogDescription>
            Paste a Path of Building 2 export code. In PoB2: Import/Export Build → Generate,
            then copy the code.
          </DialogDescription>
        </DialogHeader>
        <form ref={formRef} action={formAction} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input id="name" name="name" placeholder="e.g. Lightning Witchhunter" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pob">Export code</Label>
            <Textarea
              id="pob"
              name="pob"
              required
              rows={6}
              placeholder="eAHt…"
              // field-sizing-fixed stops the box from auto-growing to fit a long
              // pasted code; it stays ~6 rows and scrolls internally instead.
              className="field-sizing-fixed max-h-48 resize-y font-mono text-xs"
            />
          </div>
          {state?.error && (
            <Alert variant="destructive">
              <AlertDescription>{state.error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Importing…" : "Import"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
