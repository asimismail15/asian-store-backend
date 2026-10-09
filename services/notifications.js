// Replace this mock transport with Nodemailer by setting a real transport here.
// Keeping the handler dependency-free makes notifications observable in local development.
async function sendOrderNotification({ to, orderId, status, kind }) {
  if (!to) return { sent: false, reason: "missing-recipient" };
  console.info("[mock-email]", JSON.stringify({
    to,
    subject: kind === "confirmation" ? `ASIAN STORE order ${orderId} confirmed` : `ASIAN STORE order ${orderId} update`,
    message: kind === "confirmation" ? "Your order has been received." : `Your order status is now ${status}.`,
    kind,
    orderId: String(orderId),
    status
  }));
  return { sent: true, simulated: true };
}

module.exports = { sendOrderNotification };
