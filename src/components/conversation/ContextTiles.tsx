"use client";

import clsx from "clsx";
import { Mail, Package, Phone, Quote, Truck } from "lucide-react";
import type { ConversationDetail, OrderStatus } from "@/lib/domain/types";
import { daysSince, formatDate, formatMoney, initials } from "@/lib/format";
import { Badge, BrandChip, Eyebrow, Tile, TileHeader } from "@/components/ui";

const ORDER_TONE: Record<OrderStatus, "neutral" | "info" | "success" | "warning" | "danger"> = {
  processing: "neutral",
  shipped: "info",
  delivered: "success",
  cancelled: "warning",
  refunded: "danger",
};

/** The three context tiles: who the customer is, what they bought, and which brand voice applies. */
export function ContextTiles({ conversation }: { conversation: ConversationDetail }) {
  const { brand, customer, order } = conversation;
  const delivered = order?.deliveredAt ? daysSince(order.deliveredAt) : null;

  return (
    <>
      <Tile className="p-5">
        <TileHeader title="Customer" />
        <div className="flex items-center gap-3">
          <span
            className="display flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-sm font-semibold text-white"
            style={{ backgroundColor: brand.accentColor }}
          >
            {initials(customer.name)}
          </span>
          <div className="min-w-0">
            <p className="display truncate text-lg font-semibold leading-tight text-stone-900">{customer.name}</p>
            <p className="truncate text-xs text-stone-500">{customer.email}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 text-stone-400">
              <Phone className="h-3 w-3" aria-hidden /> Phone
            </dt>
            <dd className="tabular text-stone-700">{customer.phone}</dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="inline-flex items-center gap-1.5 text-stone-400">
              <Mail className="h-3 w-3" aria-hidden /> Email
            </dt>
            <dd className="truncate text-stone-700">{customer.email}</dd>
          </div>
        </dl>
      </Tile>

      <Tile className="p-5">
        <TileHeader title="Order" icon={Package} right={order ? order.orderNumber : undefined} />
        {!order ? (
          <p className="text-sm text-stone-500">No order linked to this conversation.</p>
        ) : (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="display tabular text-3xl font-semibold leading-none text-stone-900">{formatMoney(order.total, order.currency)}</p>
                <p className="mt-1.5 text-xs text-stone-500">
                  {order.items.length} item{order.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <Badge tone={ORDER_TONE[order.status]}>{order.status}</Badge>
            </div>

            <ul className="space-y-1.5 text-xs">
              {order.items.map((item, i) => (
                <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-stone-50 px-3 py-2">
                  <span className="text-stone-700">
                    <span className="mr-1.5 rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] text-stone-500 ring-1 ring-inset ring-stone-200">
                      {item.quantity}
                    </span>
                    {item.name}
                  </span>
                  <span className="tabular shrink-0 text-stone-500">{formatMoney(item.unitPrice * item.quantity, order.currency)}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-hairline p-3">
              <Eyebrow className="mb-2">Timeline</Eyebrow>
              <ol className="space-y-2">
                <Stop label="Ordered" iso={order.orderedAt} />
                <Stop label="Shipped" iso={order.shippedAt} />
                <Stop label="Delivered" iso={order.deliveredAt} highlight />
              </ol>
              {delivered !== null && (
                <p className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                  <Truck className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>
                    Delivered <span className="font-semibold tabular">{delivered} day{delivered === 1 ? "" : "s"}</span> ago. Policy windows are checked against this.
                  </span>
                </p>
              )}
            </div>
          </div>
        )}
      </Tile>

      <Tile className="p-5">
        <TileHeader title="Brand voice" icon={Quote} />
        <BrandChip name={brand.name} color={brand.accentColor} size="md" />
        <p className="mt-3 text-sm leading-relaxed text-stone-600">{brand.description}</p>
        <p className="mt-3 border-l-2 pl-3 text-xs italic leading-relaxed text-stone-500" style={{ borderColor: brand.accentColor }}>
          {brand.tone}
        </p>
      </Tile>
    </>
  );
}

function Stop({ label, iso, highlight = false }: { label: string; iso: string | null; highlight?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-2 text-xs">
      <span className="inline-flex items-center gap-2 text-stone-600">
        <span className={clsx("h-2 w-2 rounded-full", iso ? (highlight ? "bg-emerald-500" : "bg-stone-400") : "border border-stone-300 bg-white")} />
        {label}
      </span>
      <span className="tabular text-stone-500" suppressHydrationWarning>
        {iso ? formatDate(iso) : "pending"}
      </span>
    </li>
  );
}
