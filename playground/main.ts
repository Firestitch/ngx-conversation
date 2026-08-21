import { enableProdMode, importProvidersFrom } from '@angular/core';
import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';


import { environment } from './environments/environment';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { BrowserModule, bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { FormsModule } from '@angular/forms';
import { FsLabelModule } from '@firestitch/label';
import { FsStoreModule } from '@firestitch/store';
import { FsExampleModule } from '@firestitch/example';
import { FsFormModule } from '@firestitch/form';
import { FsApiModule } from '@firestitch/api';
import { FsTabsModule } from '@firestitch/tabs';
import { FsPopoverModule } from '@firestitch/popover';
import { FsFileModule } from '@firestitch/file';
import { FsMessageModule } from '@firestitch/message';
import { FsGalleryModule } from '@firestitch/gallery';
import { provideRouter, Routes } from '@angular/router';
import { FsWebSocket } from '@firestitch/web-socket';
import { PlaygroundWebSocket } from './app/services';
import { ExamplesComponent } from './app/components';
import { FsFilterModule } from '@firestitch/filter';
import { AppComponent } from './app/app.component';

const routes: Routes = [
  { path: '', component: ExamplesComponent },
];



if (environment.production) {
  enableProdMode();
}

bootstrapApplication(AppComponent, {
    providers: [
        importProvidersFrom(BrowserModule, FormsModule, FsLabelModule, FsStoreModule, FsExampleModule.forRoot(), FsFormModule.forRoot(), FsApiModule.forRoot(), FsTabsModule.forRoot(), FsPopoverModule, FsFileModule.forRoot(), FsMessageModule.forRoot(), FsGalleryModule.forRoot(), FsFilterModule.forRoot({
            case: 'camel',
            queryParam: true,
            chips: true,
        })),
        {
            provide: MAT_FORM_FIELD_DEFAULT_OPTIONS,
            useValue: { appearance: 'outline', floatLabel: 'auto' },
        },
        provideAnimations(),
        provideRouter(routes),
        // The demo has no socket server, so it substitutes the transport. Both tokens
        // resolve to one instance: the components inject FsWebSocket, the store needs
        // the playground subclass to raise server-side events.
        PlaygroundWebSocket,
        { provide: FsWebSocket, useExisting: PlaygroundWebSocket },
    ]
})
  .catch(err => console.error(err));

