const roundMoney = value => Math.round((Number(value) || 0) * 100) / 100;

const itemNetTotal = item => Number(item.totalPrice || 0);

const calculateOrder = order => {
  const subtotal = order.items.reduce((sum, item) => sum + itemNetTotal(item), 0);
  const finalBillDiscount = Math.min(
    Math.max(roundMoney(order.discountAmount || 0), 0),
    subtotal
  );
  const taxable = subtotal - finalBillDiscount;
  const taxAmount = roundMoney((taxable * Number(order.taxPct || 0)) / 100);
  const totalAmount = roundMoney(taxable + taxAmount - Number(order.redeemPoints || 0));
  const balance = roundMoney(totalAmount - Number(order.advanceAmount || 0));

  return {
    items: order.items,
    subtotal,
    discount: finalBillDiscount,
    taxAmount,
    totalAmount,
    balance,
  };
};

module.exports = {
  calculateOrder,
};
