export interface BroteTicket {
  id: string;
  type: "ticket" | "donation";
  paymentId: string;
  buyerEmail: string;
  buyerName: string;
  status: "valid" | "used";
  createdAt: string;
  usedAt?: string;
}
