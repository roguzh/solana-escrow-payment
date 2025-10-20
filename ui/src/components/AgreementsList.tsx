"use client";

import { useState } from "react";
import { AgreementCard } from "@/components/AgreementCard";
import { Badge } from "@/components/ui/badge";

export type AgreementStatus =
  | "pending"
  | "completed"
  | "cancelled"
  | "completed_by_referee"
  | "cancelled_by_referee";

export interface Agreement {
  id: string;
  payer: string;
  receiver: string;
  referee?: string;
  amount: number;
  expiration?: number;
  status: AgreementStatus;
  payerApproved: boolean;
  receiverApproved: boolean;
  payerCancelled: boolean;
  receiverCancelled: boolean;
  createdAt: number;
}

interface AgreementsListProps {
  walletAddress: string;
}

export function AgreementsList({ walletAddress }: AgreementsListProps) {
  // Mock data for demonstration
  const [agreements] = useState<Agreement[]>([
    {
      id: "1",
      payer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      receiver: "9yKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgBvW",
      referee: "5xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgCxY",
      amount: 5.5,
      expiration: Date.now() + 86400000 * 7,
      status: "pending",
      payerApproved: false,
      receiverApproved: false,
      payerCancelled: false,
      receiverCancelled: false,
      createdAt: Date.now() - 86400000 * 2,
    },
    {
      id: "2",
      payer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      receiver: "8yKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgDwX",
      amount: 10.0,
      status: "completed",
      payerApproved: true,
      receiverApproved: true,
      payerCancelled: false,
      receiverCancelled: false,
      createdAt: Date.now() - 86400000 * 5,
    },
    {
      id: "3",
      payer: "6xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgEzZ",
      receiver: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      amount: 2.5,
      status: "cancelled",
      payerApproved: false,
      receiverApproved: false,
      payerCancelled: true,
      receiverCancelled: true,
      createdAt: Date.now() - 86400000 * 10,
    },
    {
      id: "4",
      payer: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      receiver: "4xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgFaA",
      referee: "3xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgGbB",
      amount: 15.0,
      status: "completed_by_referee",
      payerApproved: false,
      receiverApproved: false,
      payerCancelled: false,
      receiverCancelled: false,
      createdAt: Date.now() - 86400000 * 15,
    },
  ]);

  const [filter, setFilter] = useState<"all" | AgreementStatus>("all");

  const filteredAgreements =
    filter === "all"
      ? agreements
      : agreements.filter((a) => a.status === filter);

  const statusCounts = {
    all: agreements.length,
    pending: agreements.filter((a) => a.status === "pending").length,
    completed: agreements.filter((a) => a.status === "completed").length,
    cancelled: agreements.filter((a) => a.status === "cancelled").length,
    completed_by_referee: agreements.filter(
      (a) => a.status === "completed_by_referee"
    ).length,
    cancelled_by_referee: agreements.filter(
      (a) => a.status === "cancelled_by_referee"
    ).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-foreground">
          {"Payment Agreements"}
        </h1>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge
          variant={filter === "all" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("all")}
        >
          {"All"} ({statusCounts.all})
        </Badge>
        <Badge
          variant={filter === "pending" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("pending")}
        >
          {"Pending"} ({statusCounts.pending})
        </Badge>
        <Badge
          variant={filter === "completed" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("completed")}
        >
          {"Completed"} ({statusCounts.completed})
        </Badge>
        <Badge
          variant={filter === "cancelled" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("cancelled")}
        >
          {"Cancelled"} ({statusCounts.cancelled})
        </Badge>
        <Badge
          variant={filter === "completed_by_referee" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("completed_by_referee")}
        >
          {"Completed by Referee"} ({statusCounts.completed_by_referee})
        </Badge>
        <Badge
          variant={filter === "cancelled_by_referee" ? "default" : "outline"}
          className="cursor-pointer"
          onClick={() => setFilter("cancelled_by_referee")}
        >
          {"Cancelled by Referee"} ({statusCounts.cancelled_by_referee})
        </Badge>
      </div>

      {filteredAgreements.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted-foreground">{"No agreements found"}</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAgreements.map((agreement) => (
            <AgreementCard
              key={agreement.id}
              agreement={agreement}
              walletAddress={walletAddress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
