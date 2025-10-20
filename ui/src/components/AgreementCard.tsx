import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { Agreement } from "./AgreementsList";

interface AgreementCardProps {
  agreement: Agreement;
  walletAddress: string;
}

export function AgreementCard({
  agreement,
  walletAddress,
}: AgreementCardProps) {
  const truncateAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getStatusBadge = () => {
    switch (agreement.status) {
      case "pending":
        return (
          <Badge variant="outline" className="bg-muted">
            {"Pending"}
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-chart-3 text-background">{"Completed"}</Badge>
        );
      case "cancelled":
        return <Badge variant="destructive">{"Cancelled"}</Badge>;
      case "completed_by_referee":
        return (
          <Badge className="bg-chart-2 text-background">
            {"Completed by Referee"}
          </Badge>
        );
      case "cancelled_by_referee":
        return (
          <Badge className="bg-destructive/80 text-destructive-foreground">
            {"Cancelled by Referee"}
          </Badge>
        );
    }
  };

  const isPayer = agreement.payer === walletAddress;
  const isReceiver = agreement.receiver === walletAddress;
  const canApprove =
    agreement.status === "pending" &&
    ((isPayer && !agreement.payerApproved) ||
      (isReceiver && !agreement.receiverApproved));
  const canCancel =
    agreement.status === "pending" &&
    ((isPayer && !agreement.payerCancelled) ||
      (isReceiver && !agreement.receiverCancelled));

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  return (
    <Card className="flex flex-col">
      <CardHeader className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-muted-foreground">
            #{agreement.id}
          </span>
          {getStatusBadge()}
        </div>
        <div className="text-3xl font-bold text-foreground">
          {agreement.amount}{" "}
          <span className="text-xl text-muted-foreground">{"SOL"}</span>
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-3">
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground min-w-[70px]">
              {"Payer:"}
            </span>
            <span className="font-mono text-foreground break-all">
              {truncateAddress(agreement.payer)}
            </span>
            {isPayer && (
              <Badge variant="secondary" className="text-xs">
                {"You"}
              </Badge>
            )}
          </div>
          <div className="flex items-start gap-2">
            <span className="text-muted-foreground min-w-[70px]">
              {"Receiver:"}
            </span>
            <span className="font-mono text-foreground break-all">
              {truncateAddress(agreement.receiver)}
            </span>
            {isReceiver && (
              <Badge variant="secondary" className="text-xs">
                {"You"}
              </Badge>
            )}
          </div>
          {agreement.referee && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground min-w-[70px]">
                {"Referee:"}
              </span>
              <span className="font-mono text-foreground break-all">
                {truncateAddress(agreement.referee)}
              </span>
            </div>
          )}
          {agreement.expiration && (
            <div className="flex items-start gap-2">
              <span className="text-muted-foreground min-w-[70px]">
                {"Expires:"}
              </span>
              <span className="text-foreground">
                {formatDate(agreement.expiration)}
              </span>
            </div>
          )}
        </div>

        {agreement.status === "pending" && (
          <div className="pt-2 space-y-1 text-xs">
            <div className="flex items-center gap-2">
              {agreement.payerApproved ? (
                <CheckCircle2 className="h-4 w-4 text-chart-3" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">{"Payer approval"}</span>
            </div>
            <div className="flex items-center gap-2">
              {agreement.receiverApproved ? (
                <CheckCircle2 className="h-4 w-4 text-chart-3" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
              <span className="text-muted-foreground">
                {"Receiver approval"}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      {(canApprove || canCancel) && (
        <CardFooter className="flex gap-2">
          {canApprove && (
            <Button size="sm" className="flex-1">
              <CheckCircle2 className="h-4 w-4 mr-1" />
              {"Approve"}
            </Button>
          )}
          {canCancel && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 bg-transparent"
            >
              <XCircle className="h-4 w-4 mr-1" />
              {"Cancel"}
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
}
