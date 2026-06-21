"use client";

import { MoreVertical } from "lucide-react";
import { useState } from "react";
import { deleteBuild, renameBuild } from "@/app/builds/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface BuildSummary {
  id: string;
  name: string;
  class: string | null;
  ascendancy: string | null;
  level: number | null;
  createdAt: string;
}

export function BuildCard({ build }: { build: BuildSummary }) {
  const [renameOpen, setRenameOpen] = useState(false);

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{build.name}</CardTitle>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8">
                <MoreVertical className="h-4 w-4" />
                <span className="sr-only">Build actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setRenameOpen(true)}>
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onSelect={(e) => {
                  e.preventDefault();
                  if (!confirm(`Delete "${build.name}"?`)) return;
                  const fd = new FormData();
                  fd.set("id", build.id);
                  void deleteBuild(fd);
                }}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2 text-sm">
        {build.ascendancy && <Badge variant="secondary">{build.ascendancy}</Badge>}
        {build.class && <Badge variant="outline">{build.class}</Badge>}
        {build.level != null && (
          <span className="text-muted-foreground">Level {build.level}</span>
        )}
      </CardContent>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename build</DialogTitle>
          </DialogHeader>
          <form action={renameBuild} onSubmit={() => setRenameOpen(false)} className="space-y-4">
            <input type="hidden" name="id" value={build.id} />
            <div className="space-y-2">
              <Label htmlFor={`name-${build.id}`}>Name</Label>
              <Input id={`name-${build.id}`} name="name" defaultValue={build.name} required />
            </div>
            <DialogFooter>
              <Button type="submit">Save</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
