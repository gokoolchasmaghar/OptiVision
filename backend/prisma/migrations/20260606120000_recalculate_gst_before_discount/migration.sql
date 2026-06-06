UPDATE "order_items"
SET
  "totalPrice" = ROUND((
    ("quantity" * "unitPrice") - "discountAmount"
  )::numeric, 2)::double precision,
  "taxableValue" = ROUND((
    CASE
      WHEN "rateInclusiveOfGst" AND "gstRate" > 0
        THEN ("quantity" * "unitPrice") / (1 + ("gstRate" / 100.0))
      ELSE ("quantity" * "unitPrice")
    END
  )::numeric, 2)::double precision,
  "gstAmount" = ROUND((
    CASE
      WHEN "gstRate" <= 0 THEN 0
      WHEN "rateInclusiveOfGst"
        THEN ("quantity" * "unitPrice")
          - (("quantity" * "unitPrice") / (1 + ("gstRate" / 100.0)))
      ELSE ("quantity" * "unitPrice") * ("gstRate" / 100.0)
    END
  )::numeric, 2)::double precision;

WITH order_totals AS (
  SELECT
    "orderId",
    ROUND(SUM("totalPrice")::numeric, 2)::double precision AS subtotal,
    ROUND(SUM("gstAmount")::numeric, 2)::double precision AS tax_amount,
    ROUND(SUM(
      "totalPrice"
      + CASE WHEN "rateInclusiveOfGst" THEN 0 ELSE "gstAmount" END
    )::numeric, 2)::double precision AS items_payable
  FROM "order_items"
  GROUP BY "orderId"
)
UPDATE "orders" AS orders
SET
  "subtotal" = totals.subtotal,
  "taxAmount" = totals.tax_amount,
  "taxPct" = CASE
    WHEN totals.subtotal > 0
      THEN ROUND(((totals.tax_amount / totals.subtotal) * 100)::numeric, 2)::double precision
    ELSE 0
  END,
  "totalAmount" = GREATEST(
    0,
    ROUND((
      totals.items_payable
      - orders."discountAmount"
      - orders."redeemPoints"
    )::numeric, 2)::double precision
  ),
  "balanceAmount" = GREATEST(
    0,
    ROUND((
      totals.items_payable
      - orders."discountAmount"
      - orders."redeemPoints"
      - orders."advanceAmount"
    )::numeric, 2)::double precision
  ),
  "paymentStatus" = CASE
    WHEN orders."advanceAmount" >= GREATEST(
      0,
      totals.items_payable - orders."discountAmount" - orders."redeemPoints"
    ) THEN 'PAID'::"PaymentStatus"
    WHEN orders."advanceAmount" > 0 THEN 'PARTIAL'::"PaymentStatus"
    ELSE 'PENDING'::"PaymentStatus"
  END
FROM order_totals AS totals
WHERE orders.id = totals."orderId";
