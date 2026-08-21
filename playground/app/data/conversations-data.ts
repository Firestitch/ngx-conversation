import {
  ConversationItemState, ConversationItemType,
  ConversationParticipantType, ConversationState,
} from 'src/app/enums';

import {
  ConversationItemRecord, ConversationParticipantRecord, ConversationRecord,
} from './conversation-records';


const NOW = Date.now();

function minutesAgo(minutes: number): string {
  return new Date(NOW - (minutes * 60 * 1000)).toISOString();
}

function hoursAgo(hours: number): string {
  return minutesAgo(hours * 60);
}

function daysAgo(days: number): string {
  return hoursAgo(days * 24);
}

export const conversationsData: ConversationRecord[] = [
  {
    id: 1,
    state: ConversationState.Open,
    name: 'Design review — onboarding flow',
    guid: 'conversation-1',
    createDate: daysAgo(3),
    activityDate: hoursAgo(26),
    creatorConversationParticipantId: 1,
  },
  {
    id: 2,
    state: ConversationState.Open,
    name: 'Sprint 42 planning',
    guid: 'conversation-2',
    createDate: daysAgo(5),
    activityDate: minutesAgo(20),
    creatorConversationParticipantId: 4,
  },
  {
    id: 3,
    state: ConversationState.Open,
    name: 'Q3 budget approvals',
    guid: 'conversation-3',
    createDate: daysAgo(2),
    activityDate: minutesAgo(10),
    creatorConversationParticipantId: 8,
  },
  {
    // Left unnamed on purpose — the name falls back to the participant names
    id: 4,
    state: ConversationState.Open,
    name: null,
    guid: 'conversation-4',
    createDate: daysAgo(1),
    activityDate: hoursAgo(3),
    creatorConversationParticipantId: 10,
  },
  {
    // The session account is not a participant — demonstrates "Join Conversation"
    id: 5,
    state: ConversationState.Open,
    name: 'Website launch checklist',
    guid: 'conversation-5',
    createDate: daysAgo(4),
    activityDate: hoursAgo(8),
    creatorConversationParticipantId: 12,
  },
  {
    id: 6,
    state: ConversationState.Closed,
    name: 'Legacy API deprecation',
    guid: 'conversation-6',
    createDate: daysAgo(12),
    activityDate: daysAgo(9),
    creatorConversationParticipantId: 15,
  },
];

function participant(
  id: number,
  conversationId: number,
  accountId: number,
  admin: boolean,
  readConversationItemId: number,
  createDate: string,
): ConversationParticipantRecord {
  return {
    id,
    conversationId,
    accountId,
    admin,
    readConversationItemId,
    createDate,
    activityDate: createDate,
    state: 'active',
    type: ConversationParticipantType.Account,
    guid: `conversation-participant-${id}`,
  };
}

export const conversationParticipantsData: ConversationParticipantRecord[] = [
  // Conversation 1
  participant(1, 1, 1, true, 5, daysAgo(3)),
  participant(2, 1, 2, false, 5, daysAgo(3)),
  participant(3, 1, 3, false, 4, daysAgo(3)),

  // Conversation 2 — session account has 2 unread
  participant(4, 2, 3, true, 10, daysAgo(5)),
  participant(5, 2, 1, false, 8, daysAgo(5)),
  participant(6, 2, 4, false, 10, daysAgo(5)),
  participant(7, 2, 5, false, 9, daysAgo(5)),

  // Conversation 3 — session account has 1 unread
  participant(8, 3, 6, true, 14, daysAgo(2)),
  participant(9, 3, 1, false, 13, daysAgo(2)),

  // Conversation 4
  participant(10, 4, 1, true, 17, daysAgo(1)),
  participant(11, 4, 2, false, 17, daysAgo(1)),

  // Conversation 5 — no session account
  participant(12, 5, 2, true, 20, daysAgo(4)),
  participant(13, 5, 4, false, 20, daysAgo(4)),
  participant(14, 5, 7, false, 19, daysAgo(4)),

  // Conversation 6 — closed
  participant(15, 6, 1, true, 24, daysAgo(12)),
  participant(16, 6, 3, false, 24, daysAgo(12)),
  participant(17, 6, 8, false, 24, daysAgo(12)),
];

function item(
  id: number,
  conversationId: number,
  conversationParticipantId: number,
  type: ConversationItemType,
  message: string,
  createDate: string,
  addRemoveAccountIds: number[] = [],
): ConversationItemRecord {
  return {
    id,
    conversationId,
    conversationParticipantId,
    type,
    message,
    createDate,
    addRemoveAccountIds,
    state: ConversationItemState.Active,
    guid: `conversation-item-${id}`,
    conversationItemFiles: [],
  };
}

export const conversationItemsData: ConversationItemRecord[] = [
  // Conversation 1
  item(1, 1, 1, ConversationItemType.Start, null, daysAgo(3)),
  item(2, 1, 1, ConversationItemType.ParticipantAdd, null, daysAgo(3), [2, 3]),
  item(3, 1, 2, ConversationItemType.Message, 'Pushed the new onboarding wireframes. The third step is still doing too much — I split the address capture out into its own screen.', daysAgo(2)),
  item(4, 1, 1, ConversationItemType.Message, 'Much better. Can we drop the progress bar entirely on mobile? It eats a third of the viewport.', hoursAgo(30)),
  item(5, 1, 3, ConversationItemType.Message, 'Agreed on mobile. I will have the updated prototype ready before standup.', hoursAgo(26)),

  // Conversation 2
  item(6, 2, 4, ConversationItemType.Start, null, daysAgo(5)),
  item(7, 2, 4, ConversationItemType.ParticipantAdd, null, daysAgo(5), [1, 4, 5]),
  item(8, 2, 4, ConversationItemType.Message, 'Capacity for sprint 42 is 34 points. Two people are out Thursday and Friday.', daysAgo(1)),
  item(9, 2, 6, ConversationItemType.Message, 'I can pick up the export refactor if nobody has started it.', hoursAgo(2)),
  item(10, 2, 7, ConversationItemType.Message, 'It is unclaimed — go ahead. I will take the migration ticket instead.', minutesAgo(20)),

  // Conversation 3
  item(11, 3, 8, ConversationItemType.Start, null, daysAgo(2)),
  item(12, 3, 8, ConversationItemType.Message, 'Budget sheet is in the shared drive. I need sign-off by end of week.', daysAgo(2)),
  item(13, 3, 9, ConversationItemType.Message, 'Reviewed. The infrastructure line looks light given the new region.', hoursAgo(20)),
  item(14, 3, 8, ConversationItemType.Message, 'Good catch — I bumped it by 18% and resubmitted.', minutesAgo(10)),

  // Conversation 4
  item(15, 4, 10, ConversationItemType.Start, null, daysAgo(1)),
  item(16, 4, 11, ConversationItemType.Message, 'Do you have five minutes to look at the contract redlines?', hoursAgo(4)),
  item(17, 4, 10, ConversationItemType.Message, 'Sure, send them over.', hoursAgo(3)),

  // Conversation 5
  item(18, 5, 12, ConversationItemType.Start, null, daysAgo(4)),
  item(19, 5, 13, ConversationItemType.Message, 'Analytics and the cookie banner are the last two blockers.', daysAgo(1)),
  item(20, 5, 14, ConversationItemType.Message, 'Cookie banner shipped this morning. Analytics is waiting on the property id.', hoursAgo(8)),

  // Conversation 6
  item(21, 6, 15, ConversationItemType.Start, null, daysAgo(12)),
  item(22, 6, 16, ConversationItemType.Message, 'Three integrations are still calling v1. I gave them until the end of the quarter.', daysAgo(11)),
  item(23, 6, 15, ConversationItemType.Notice, 'The <b>v1 API</b> was retired. See the <i>migration guide</i> for replacement endpoints.', daysAgo(10)),
  item(24, 6, 15, ConversationItemType.Message, 'All traffic is off v1. Closing this out.', daysAgo(9)),
];
