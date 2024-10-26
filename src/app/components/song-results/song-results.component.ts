import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { GeneratedSong } from '../../models/database.types';
import { IonIcon, NavController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { pause, play, close } from 'ionicons/icons';
import { FormService } from '../../services/form.service';
import { CommonModule } from '@angular/common';
import { SpotifyService } from '../../services/spotify-service.service';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-song-results',
  templateUrl: './song-results.component.html',
  styleUrls: ['./song-results.component.css'],
  imports: [IonIcon, CommonModule],
  standalone: true,
})
export class SongResultsComponent implements OnInit {
  emotionName: number = 0;
  eventName: number = 0;
  genreName: number = 0;
  recommendations: GeneratedSong[] = [];
  errorMessage: string = '';
  isPlaying: boolean = false;
  audioElement: HTMLAudioElement | null = null;
  isAdded: boolean = false;

  constructor(
    private route: ActivatedRoute,
    private navCtrl: NavController,
    private formService: FormService,
    private spotifyService: SpotifyService,
    private http: HttpClient
  ) {
    addIcons({ play, pause, close });
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      this.emotionName = params['emotion'] || 'None'; //fallback to none if not provided
      this.eventName = params['event'] || 'None';
      this.genreName = params['genre'] || 'None';
      this.loadRecommendation();
    });
  }

  async loadRecommendation() {
    this.recommendations = this.formService.getRecommendation();
    console.log(this.recommendations);
    if (this.recommendations && this.recommendations.length > 0) {
      const firstRecommendation = this.recommendations[0];
      if (firstRecommendation.preview_url) {
        this.initAudioElement(firstRecommendation.preview_url);
      }
    }
  }

  initAudioElement(previewUrl: string) {
    this.audioElement = new Audio(previewUrl);
    this.audioElement.addEventListener('ended', () => {
      this.isPlaying = false;
    });
  }

  togglePlayPause() {
    if (this.audioElement) {
      if (this.isPlaying) {
        this.audioElement.pause();
      } else {
        this.audioElement
          .play()
          .catch((error) => console.error('Error playing audio:', error));
      }
      this.isPlaying = !this.isPlaying;
    }
  }

  navigateToHome() {
    this.isAdded = false;
    this.audioElement?.pause();
    this.navCtrl.navigateRoot('/tabs/home');
  }
  async addToLikedSongs(trackId: string, songId: string) {
    try {
      const success = await firstValueFrom(
        this.spotifyService.addToLikedSongs(trackId)
      );
      if (success) {
        // If successfully added to liked songs, update the song in the database
        await this.formService.updateIndividualSong(songId);

        console.log('Track added to liked songs and updated in the database.');
        this.isAdded = true;
      }
    } catch (error: any) {
      console.error(
        'Error in adding song to liked songs or updating the song:',
        error
      );
    }
  }
}
