/**
 * The topics and events conversations use on the socket.
 *
 * Exported rather than kept private because both ends have to agree on these
 * strings and neither end can check the other: the backend mints them in its
 * conversation topic handlers, and anything simulating or consuming them —
 * a playground, a test, an application adding its own conversation screen —
 * would otherwise re-type them. A publisher and a listener that disagree about
 * a name fail silently and permanently: the publish succeeds, nothing is
 * listening to the string it used, and the screen simply never updates.
 */

/** One conversation's channel: the messages in it and who is typing. */
export function conversationTopic(conversationId: number): string {
  return `conversation:${conversationId}`;
}

/** One account's own conversation activity — what the lister and badge watch. */
export function accountConversationsTopic(accountId: number): string {
  return `account:${accountId}:conversations`;
}

/** A message was posted, edited or removed. A signal: re-read the thread. */
export const CONVERSATION_EVENT_ITEM = 'conversation.item';

/** Somebody started or stopped typing. Carries who, and is not re-read. */
export const CONVERSATION_EVENT_TYPING = 'conversation.typing';

/** Something changed in this account's conversations. A signal: re-read the list. */
export const ACCOUNT_CONVERSATIONS_EVENT = 'account.conversations';
