export interface BroteTicket {
  id: string;
  type: "ticket";
  paymentId: string;
  buyerEmail: string;
  buyerName: string;
  status: "valid" | "used";
  createdAt: string;
  usedAt?: string;
  emailSent?: boolean;
  coffeeRedeemed?: boolean;
  coffeeRedeemedAt?: string;
}
