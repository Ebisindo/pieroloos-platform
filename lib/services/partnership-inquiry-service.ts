import { partnershipInquiryRepository } from "@/lib/db/partnership-inquiry-repository";
import { sendNotificationEmail } from "@/lib/services/notification-email";
import {
  PARTNERSHIP_INQUIRY_TYPE_LABELS,
  type PartnershipInquiryInput,
} from "@/lib/validation/partnership-inquiry";

export type SubmitPartnershipInquiryResult = { id: string; notified: boolean };

// Persistence is the source of truth; the email is a best-effort alert and never carries inquiry content.
async function notifyReviewer(inquiry: { id: string; partnerType: keyof typeof PARTNERSHIP_INQUIRY_TYPE_LABELS; organisationName: string }) {
  const recipientEmail = process.env.PARTNERSHIP_INQUIRY_NOTIFY_EMAIL?.trim();
  if (!recipientEmail) return false;
  try {
    await sendNotificationEmail({
      id: `partnership-inquiry:${inquiry.id}`,
      templateKey: "partnership-inquiry",
      templateVersion: 1,
      subject: "New PieroloOS partnership inquiry",
      body: `A new ${PARTNERSHIP_INQUIRY_TYPE_LABELS[inquiry.partnerType]} inquiry was received. Sign in as a platform administrator to review it. Reference: ${inquiry.id}`,
      recipientEmail,
    });
    return true;
  } catch {
    console.error("Partnership inquiry notification email failed.", { inquiryId: inquiry.id });
    return false;
  }
}

export async function submitPartnershipInquiry(
  input: PartnershipInquiryInput,
): Promise<SubmitPartnershipInquiryResult> {
  const { consent: _consent, hp: _hp, ...data } = input;
  void _consent;
  void _hp;
  const inquiry = await partnershipInquiryRepository.create(data);
  const notified = await notifyReviewer(inquiry);
  return { id: inquiry.id, notified };
}

export function listPartnershipInquiries() {
  return partnershipInquiryRepository.listRecent();
}
