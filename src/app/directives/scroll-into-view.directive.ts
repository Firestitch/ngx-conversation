import { Directive, ElementRef, AfterViewInit, Input } from '@angular/core';


@Directive({
    selector: '[scrollIntoView]',
    standalone: true,
})
export class ScrollIntoViewDirective implements AfterViewInit {

  @Input() public autoFocus = true;

  constructor(
    private _el: ElementRef,
  ) {}

  public ngAfterViewInit(): void {
    setTimeout(() => {
      this._el.nativeElement.scrollIntoView();
    }, 100);
  }

}
