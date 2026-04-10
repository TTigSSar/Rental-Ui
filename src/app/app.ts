import { Component } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterOutlet, TranslatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {}
