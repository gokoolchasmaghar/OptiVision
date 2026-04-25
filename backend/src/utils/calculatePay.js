export const applyDiscount = (order) => {
  const subtotal = Number(order.subtotal || 0);
  const totalDiscount = Number(order.discountAmount || 0);

  let remainingDiscount = totalDiscount;

  return order.items.map((item, index) => {
    const itemTotal = Number(item.totalPrice || 0);

    // ✅ Case 1: item has its own discount
    if (item.discountPct) {
      const discountAmount = Number(
        ((itemTotal * item.discountPct) / 100).toFixed(2)
      );

      return {
        ...item,
        appliedDiscountPct: item.discountPct,
        discountAmount,
        finalPrice: itemTotal - discountAmount,
      };
    }

    // ✅ Case 2: distribute remaining discount
    const ratio = subtotal > 0 ? itemTotal / subtotal : 0;

    let discountAmount = Number((ratio * remainingDiscount).toFixed(2));

    if (index === order.items.length - 1) {
      discountAmount = Number(remainingDiscount.toFixed(2));
    }

    remainingDiscount -= discountAmount;

    const discountPct =
      itemTotal > 0 ? (discountAmount / itemTotal) * 100 : 0;

    return {
      ...item,
      appliedDiscountPct: discountPct,
      discountAmount,
      finalPrice: itemTotal - discountAmount,
    };
  });
};

export const calculateOrder = (order) => {
  const subtotal = order.items.reduce(
    (sum, i) => sum + Number(i.totalPrice || 0),
    0
  );

  const discountedItems = applyDiscount({
    ...order,
    subtotal,
  });

  const totalDiscount = discountedItems.reduce(
    (sum, i) => sum + i.discountAmount,
    0
  );

  const taxable = subtotal - totalDiscount;

  const taxAmount =
    (taxable * Number(order.taxPct || 0)) / 100;

  const totalAmount = taxable + taxAmount;

  const balance =
    totalAmount - Number(order.advanceAmount || 0);

  return {
    items: discountedItems,
    subtotal,
    discount: totalDiscount,
    taxAmount,
    totalAmount,
    balance,
  };
};