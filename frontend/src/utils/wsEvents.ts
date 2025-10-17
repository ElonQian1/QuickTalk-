export type NormalizedWSMessage = {
  type: string;
  sessionId?: number;
  shopId?: number;
  senderType?: 'customer' | 'staff' | string;
  content?: string;
  fileUrl?: string;
  fileName?: string;
  raw: any;
};

export function normalizeWSMessage(data: any): NormalizedWSMessage {
  const type = (data.messageType || data.type || '').toString();
  const sessionId = (data.sessionId ?? data.session_id) as number | undefined;
  const shopId = (data.shopId ?? data.shop_id) as number | undefined;
  const senderType = (data.senderType ?? data.sender_type) as string | undefined;
  const content = (data.content ?? data.text) as string | undefined;
  const fileUrl = (data.fileUrl ?? data.file_url) as string | undefined;
  const fileName = (data.fileName ?? data.file_name) as string | undefined;
  return { type, sessionId, shopId, senderType: senderType as any, content, fileUrl, fileName, raw: data };
}

export function makeDedupKey(msg: NormalizedWSMessage): string {
  const p = [
    msg.type,
    msg.sessionId ?? 'no-session',
    msg.senderType ?? 'unknown',
    msg.content ?? '',
    msg.fileUrl ?? '',
    msg.fileName ?? '',
  ];
  return p.join('|');
}
