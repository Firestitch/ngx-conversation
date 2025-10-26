import { Pipe, PipeTransform } from '@angular/core';



@Pipe({
    name: 'conversationName',
    standalone: true
})
export class ConversationNamePipe implements PipeTransform {
  public transform(conversation) {
    if(conversation.name) {
      return conversation.name;
    }
    
    const names = conversation.recentConversationParticipants
      .slice(0,3)      
      .map((recentConversationParticipant) => {
        return recentConversationParticipant.account.firstName
      });

    const others = conversation.conversationParticipantCount - names.length;
    if(others > 0) {
      names.push('others');
    }

    return names.join(', ');
  }
}
