import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

/** Provides the shared header and routed screen. */
@Component({
  imports: [RouterLink, RouterOutlet],
  selector: 'app-root',
  styleUrl: './app.css',
  templateUrl: './app.html',
})
export class App {}
