import { Resend } from "resend";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function getWebhookSecret() {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RESEND_WEBHOOK_SECRET is not set");
  }

  return secret;
}

function getWebhookHeaders(request: Request) {
  const id = request.headers.get("resend-id");
  const timestamp = request.headers.get("resend-timestamp");
  const signature = request.headers.get("resend-signature");

  if (!id || !timestamp || !signature) {
    throw new Error("Missing Resend webhook signature headers");
  }

  return { id, timestamp, signature };
}

function buildEventPatch(event: any) {
  const occurredAt = new Date(event.created_at);

  switch (event.type) {
    case "email.sent":
      return {
        deliveryStatus: "SENT" as const,
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
    case "email.delivered":
      return {
        deliveryStatus: "DELIVERED" as const,
        deliveredAt: occurredAt,
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
    case "email.delivery_delayed":
      return {
        deliveryStatus: "DELIVERY_DELAYED" as const,
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
    case "email.opened":
      return {
        deliveryStatus: "OPENED" as const,
        openedAt: occurredAt,
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
    case "email.clicked":
      return {
        deliveryStatus: "CLICKED" as const,
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
    case "email.bounced":
      return {
        deliveryStatus: "BOUNCED" as const,
        failedAt: occurredAt,
        failReason: event.data?.bounce?.message || "Email bounced",
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
    case "email.complained":
      return {
        deliveryStatus: "COMPLAINED" as const,
        failedAt: occurredAt,
        failReason: "Recipient marked this message as spam",
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
    case "email.failed":
      return {
        deliveryStatus: "FAILED" as const,
        failedAt: occurredAt,
        failReason: event.data?.failed?.reason || "Email failed",
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
    case "email.suppressed":
      return {
        deliveryStatus: "SUPPRESSED" as const,
        failedAt: occurredAt,
        failReason: event.data?.suppressed?.message || "Email suppressed",
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
    default:
      return {
        lastEventType: event.type,
        lastEventAt: occurredAt,
      };
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.text();
    const resend = new Resend(process.env.RESEND_API_KEY);
    const event = resend.webhooks.verify({
      payload,
      headers: getWebhookHeaders(request),
      webhookSecret: getWebhookSecret(),
    });

    if (!event.type.startsWith("email.")) {
      return Response.json({ ok: true, ignored: true });
    }

    const emailId = (event as any).data?.email_id as string | undefined;
    if (!emailId) {
      return Response.json({ ok: true, ignored: true });
    }

    const patch = buildEventPatch(event);
    const directMessageModel = (prisma as any).directMessage;

    const directMessage = await directMessageModel.findUnique({
      where: { resendEmailId: emailId },
      select: { id: true },
    });

    if (directMessage) {
      await directMessageModel.update({
        where: { id: directMessage.id },
        data: patch,
      });

      return Response.json({ ok: true, target: "direct" });
    }

    const recipient = await prisma.broadcastRecipient.findUnique({
      where: { resendEmailId: emailId },
      select: { id: true, broadcastId: true, openedAt: true },
    });

    if (recipient) {
      await prisma.broadcastRecipient.update({
        where: { id: recipient.id },
        data: patch,
      });

      if (event.type === "email.opened" && !recipient.openedAt) {
        await prisma.broadcast.update({
          where: { id: recipient.broadcastId },
          data: { opened: { increment: 1 } },
        });
      }

      return Response.json({ ok: true, target: "broadcast" });
    }

    return Response.json({ ok: true, ignored: true, reason: "message_not_found" });
  } catch (error) {
    console.error("[Resend webhook] Failed to process event:", error);
    return Response.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 400 },
    );
  }
}
