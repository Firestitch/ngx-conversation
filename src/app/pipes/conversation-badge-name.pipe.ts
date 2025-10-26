import { Pipe, PipeTransform } from '@angular/core';



@Pipe({
    name: 'conversationBadgeName',
    standalone: true
})
export class ConversationBadgeNamePipe implements PipeTransform {
  public transform(conversationParticipantCount, accountTop, accountBottom) {
    const otherParticipantCount = conversationParticipantCount - 2;
    let str = `${accountTop.account.firstName} ${(otherParticipantCount > 0 ? ', ' : ' and ')} ${accountBottom.account.firstName}`;
    
    if(otherParticipantCount > 0) {
      str += ` and ${otherParticipantCount} ${(otherParticipantCount === 1 ? ' other' : ' others')}`;
    } 

    return str;
  }
}
