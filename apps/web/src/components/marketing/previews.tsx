import { Badge } from "../ui/feedback";
import { faNumber, type SampleSession } from "./sample-data";

export function CapacityBadge({ session }: { session: SampleSession }) {
  const available = session.capacity - session.booked;
  return <Badge tone={available ? "success" : "neutral"}>{available ? `${faNumber(available)} جای خالی` : "تکمیل ظرفیت"}</Badge>;
}
