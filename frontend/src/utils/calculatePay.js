export const calculatePay = (order) => {
  const subtotal = order.items.reduce(
    (sum, i) => sum + Number(i.totalPrice || 0),
    0
  );

  let remainingDiscount = Number(order.discountAmount || 0);

  const items = order.items.map((item, index) => {
    const itemTotal = Number(item.totalPrice || 0);

    // If item has its own discount
    if (item.discountPct) {
      const discountAmount = (itemTotal * item.discountPct) / 100;

      return {
        ...item,
        discountAmount,
        finalPrice: itemTotal - discountAmount,
      };
    }

    // distribute order discount
    const ratio = subtotal > 0 ? itemTotal / subtotal : 0;

    let discountAmount = Number((ratio * remainingDiscount).toFixed(2));

    if (index === order.items.length - 1) {
      discountAmount = Number(remainingDiscount.toFixed(2));
    }

    remainingDiscount -= discountAmount;

    return {
      ...item,
      discountAmount,
      finalPrice: itemTotal - discountAmount,
    };
  });

  const discount = items.reduce((s, i) => s + i.discountAmount, 0);

  const taxable = subtotal - discount;

  const taxAmount = (taxable * Number(order.taxPct || 0)) / 100;

  const totalAmount = taxable + taxAmount;

  const balance =
    totalAmount - Number(order.advanceAmount || 0);

  return {
    items,
    subtotal,
    discount,
    taxAmount,
    totalAmount,
    balance,
  };
};