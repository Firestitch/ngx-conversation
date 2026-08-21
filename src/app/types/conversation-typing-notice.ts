/**
 * Somebody started or stopped typing in a conversation.
 *
 * Every field is stamped by the server from the session that published it, so
 * the account named here is the one that actually typed — a browser cannot
 * announce that somebody else is at the keyboard.
 *
 * Delivered to every subscriber of the topic including the sender, which is why
 * consumers drop their own account rather than the server trying to work out
 * which connection to skip: the other subscribers are on other nodes.
 *
 * Purely the application payload — the topic it arrived on is routing and stays
 * at the root of the frame, where the socket handles it.
 */
export interface ConversationTypingNotice {
  accountId: number;
  accountName: string;
  typing: boolean;

  /**
   * The typing account's avatar, for the indicator to show a face alongside the
   * name. Carried for the same reason the name is: the indicator is worth
   * nothing a second later, so there is nothing to re-read it from. Optional —
   * a deployment that does not stamp it still gets the name, and the indicator
   * shows a plain circle in place of the face.
   */
  accountAvatar?: string;
}
