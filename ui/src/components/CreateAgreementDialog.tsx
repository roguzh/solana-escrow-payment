"use client";

import type React from "react";

import { useState } from "react";
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
import { Plus } from "lucide-react";

export function CreateAgreementDialog() {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    receiver: "",
    referee: "",
    amount: "",
    expiration: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Handle agreement creation
    console.log("Creating agreement:", formData);
    setOpen(false);
    setFormData({ receiver: "", referee: "", amount: "", expiration: "" });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          {"Create Agreement"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{"Create Payment Agreement"}</DialogTitle>
            <DialogDescription>
              {"Create a new payment agreement between two Solana addresses"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="receiver">{"Receiver Address"}</Label>
              <Input
                id="receiver"
                placeholder="Enter Solana address"
                value={formData.receiver}
                onChange={(e) =>
                  setFormData({ ...formData, receiver: e.target.value })
                }
                required
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">{"Amount (SOL)"}</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={formData.amount}
                onChange={(e) =>
                  setFormData({ ...formData, amount: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="referee">{"Referee Address (Optional)"}</Label>
              <Input
                id="referee"
                placeholder="Enter Solana address"
                value={formData.referee}
                onChange={(e) =>
                  setFormData({ ...formData, referee: e.target.value })
                }
                className="font-mono text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiration">{"Expiration Date (Optional)"}</Label>
              <Input
                id="expiration"
                type="date"
                value={formData.expiration}
                onChange={(e) =>
                  setFormData({ ...formData, expiration: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              {"Cancel"}
            </Button>
            <Button type="submit">{"Create Agreement"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
