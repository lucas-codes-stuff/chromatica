import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { Emotions } from '../../../../../supabase/functions/emotion-event-enum';
import { IonicModule } from '@ionic/angular';
import { FormService } from '../../../services/form.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-emotion-selection',
  templateUrl: './emotion-selection.component.html',
  imports: [IonicModule, CommonModule],
  styleUrls: ['./emotion-selection.component.scss'],
  standalone: true
})
export class EmotionSelectionComponent implements OnInit {
  @Input() emotions: number[] = [];
  @Input() selectedEmotion: number = Emotions.None;
  @Output() selectedEmotionChange = new EventEmitter<number>();
  Emotions = Emotions;
  firstColumn: Emotions[] = [];
  secondColumn: Emotions[] = []
  thirdColumn: Emotions[] = [];
  constructor(
    private formService: FormService,
  ) {}
  ngOnInit() {
    this.firstColumn = this.emotions.filter((_, index) => index % 3 === 0);
    this.secondColumn = this.emotions.filter((_, index) => index % 3 === 1);
    this.thirdColumn = this.emotions.filter((_, index) => index % 3 === 2)

  }
  getRandomSize():number{
    // 
    return 0;
  }

  toggleEmotions(emotion: number) {
    this.selectedEmotion = this.formService.toggleSelection(this.selectedEmotion, emotion, Emotions.None);
    console.log('Selected Emotion:', this.selectedEmotion);
  }

  proceedToEventSelection() {
    console.log(this.selectedEmotion);
    this.selectedEmotionChange.emit(this.selectedEmotion);
  }

  isSelected(emotion: number): boolean {
    return this.selectedEmotion === emotion;
  }


}