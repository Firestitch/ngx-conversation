import { Component, inject } from '@angular/core';

import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';


@Component({
  templateUrl: './object-attach.component.html',
})
export class ObjectAttachComponent {
  data = inject(MAT_DIALOG_DATA);
  private _dialogRef = inject<MatDialogRef<ObjectAttachComponent>>(MatDialogRef);


  public objectSelected(object): void {
    this._dialogRef.close(object);
  }

  public close(): void {
    this._dialogRef.close(null);
  }
}
