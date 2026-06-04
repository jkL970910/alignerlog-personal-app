export function getPersonalUserId() {
  return process.env.ALIGNERLOG_USER_ID ?? "00000000-0000-0000-0000-000000000001";
}
