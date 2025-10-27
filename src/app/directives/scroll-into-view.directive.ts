import { Directive, ElementRef, AfterViewInit, Input, inject } from '@angular/core';


@Directive({
    selector: '[scrollIntoView]',
    standalone: true,
})
export class ScrollIntoViewDirective implements AfterViewInit {
  private _el = inject(ElementRef);


  @Input() public autoFocus = true;

  public ngAfterViewInit(): void {
    setTimeout(() => {
      this._el.nativeElement.scrollIntoView();
    }, 100);
  }

}
