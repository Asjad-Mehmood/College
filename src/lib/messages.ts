import { ordinal } from "@/lib/strikes";

/** Local mobile numbers (03xx…) to international digits (923xx…) for wa.me links. */
export function toInternational(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) return digits.slice(2);
  if (digits.startsWith("0") && digits.length === 11) return `92${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("3")) return `92${digits}`;
  return digits;
}

export function whatsAppLink(phone: string, text?: string) {
  const base = `https://wa.me/${toInternational(phone)}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export function smsLink(phone: string, text: string) {
  return `sms:${phone.replace(/[^\d+]/g, "")}?body=${encodeURIComponent(text)}`;
}

export function telLink(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export function parentLateMessage(args: {
  studentName: string;
  rollNo: string;
  className: string;
  time: string;
  monthCount: number;
  collegeName: string;
}) {
  return (
    `Respected Parent, your ward ${args.studentName} (Roll No: ${args.rollNo}, ${args.className}) ` +
    `arrived late to college today at ${args.time}. ` +
    `This is the ${ordinal(args.monthCount)} late arrival this month. ` +
    `– Discipline In-Charge, ${args.collegeName}`
  );
}
