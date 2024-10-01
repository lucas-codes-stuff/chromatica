import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { environment } from '../environments/environment';
import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs';
import {
  Emotions,
  Genres,
  Events,
  combineEncodings,
} from '../../supabase/functions/emotion-event-enum';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit {
  title = 'chromatica';

  spotifyAccessToken = '';

  supabase = createClient(environment.DB_URL, environment.DB_ANON_KEY, {
    global: {
      headers: { Authorization: `Bearer ${environment.DB_SERVICE_KEY}` },
    },
  });

  ngOnInit() {
    //get the spotify access token (post)
    fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `grant_type=client_credentials&client_id=${environment.SPOTIFY_CLIENT_ID}&client_secret=${environment.SPOTIFY_CLIENT_SECRET}`,
    })
      .then((response) => response.json())
      .then((data) => {
        //console.log(data);
        this.spotifyAccessToken = data.access_token;
      });
  }

  // Function to update the HTML "console"
  updateConsole(message: string) {
    const consoleOutput = document.getElementById('console-output');
    if (consoleOutput) {
      // Append new message to the div
      const newMessage = document.createElement('div');
      newMessage.textContent = message;
      consoleOutput.appendChild(newMessage);
      // Scroll to the bottom to show the latest log
      consoleOutput.scrollTop = consoleOutput.scrollHeight;
    }
  }

  async train() {
    this.updateConsole('Starting training...');

    const { data, error } = await this.supabase.storage
      .from('train')
      .download('100_items.csv');

    const contents = await data!.text();

    const allAudioFeatures = this.getAllAudioFeatures(contents);

    let model;
    const modelData = localStorage.getItem('tensorflowjs_models/model/info');

    if (modelData === null) {
      this.updateConsole('Building model');
      // Define the model
      model = tf.sequential();

      // Input layer
      model.add(
        tf.layers.dense({
          inputShape: [101],
          units: 101,
          activation: 'relu',
        })
      );

      // Hidden layer
      model.add(
        tf.layers.dense({
          units: 128,
          activation: 'relu',
        })
      );

      // Hidden layer
      model.add(
        tf.layers.dense({
          units: 64,
          activation: 'relu',
        })
      );

      // Hidden layer
      model.add(
        tf.layers.dense({
          units: 32,
          activation: 'relu',
        })
      );

      // Output layer (continuous features like music features)
      model.add(
        tf.layers.dense({
          units: 12, // 12 output features
          activation: 'linear', // Use linear activation for regression tasks
        })
      );

      // Compile the model
      model.compile({
        loss: tf.losses.huberLoss,
        optimizer: tf.train.adam(0.01),
        metrics: ['mae'],
      });
    } else {
      this.updateConsole('Loading model');
      model = await tf.loadLayersModel('localstorage://model');
      model.compile({
        loss: tf.losses.huberLoss,
        optimizer: tf.train.adam(0.01),
        metrics: ['mae'],
      });
    }

    const oneHotInputsArray = [];
    const numCat = 101;
    for (let i = 0; i < numCat; i++) {
      const oneHotArray = new Array(numCat).fill(0);
      oneHotArray[i] = 1;

      //put the array into the oneHotInputsArray 10 times
      for (let j = 0; j < 100; j++) {
        oneHotInputsArray.push(oneHotArray);
      }
    }

    // create an array to store the combination one hots
    const combinedOneHotArray = [];
    //happy vacation
    combinedOneHotArray.push(
      combineEncodings(Emotions.Happy, Events.Vacation, Genres.None)
    );
    //sad relaxation day
    combinedOneHotArray.push(
      combineEncodings(Emotions.Sad, Events.Relaxation, Genres.None)
    );
    //angry workout
    combinedOneHotArray.push(
      combineEncodings(Emotions.Angry, Events.Workout, Genres.None)
    );
    //calm meditation
    combinedOneHotArray.push(
      combineEncodings(Emotions.Calm, Events.Meditation, Genres.None)
    );
    //excited party
    combinedOneHotArray.push(
      combineEncodings(Emotions.Excited, Events.Party, Genres.None)
    );
    //chill beach day
    combinedOneHotArray.push(
      combineEncodings(Emotions.Calm, Events.BeachDay, Genres.None)
    );
    //romanctic date
    combinedOneHotArray.push(
      combineEncodings(Emotions.Love, Events.Date, Genres.None)
    );
    //energetic workout
    combinedOneHotArray.push(
      combineEncodings(Emotions.Excited, Events.Running, Genres.None)
    );
    //focused study
    combinedOneHotArray.push(
      combineEncodings(Emotions.Calm, Events.Study, Genres.None)
    );
    //nostalgic roadtrip
    combinedOneHotArray.push(
      combineEncodings(Emotions.Nostalgic, Events.Roadtrip, Genres.None)
    );

    //loop over the array and add 10 of each into the oneHotInputsArray
    combinedOneHotArray.forEach((oneHotArray) => {
      for (let i = 0; i < 100; i++) {
        oneHotInputsArray.push(oneHotArray);
      }
    });

    const onHotInputs = tf.tensor2d(oneHotInputsArray);
    const audioFeatureOutputs = tf.tensor2d(allAudioFeatures);

    await model
      .fit(onHotInputs, audioFeatureOutputs, {
        epochs: 10,
        callbacks: {
          onEpochEnd: async (epoch, logs) => {
            const mae = logs!['mae'].toFixed(2); // Format MAE to 2 decimal places
            this.updateConsole(
              `Epoch: ${epoch} Loss: ${logs!['loss']} Accuracy (MAE): ${mae}`
            );
          },
        },

        batchSize: 32,
        validationSplit: 0.1,
      })
      .then(() => {
        this.updateConsole('Training complete');
      });

    await model.save('localstorage://model');
  }

  test() {
    this.updateConsole('Testing...');
  
    // Make a one hot array for the selected category
    const oneHotArray = combineEncodings(Emotions.Guilty, Events.None, Genres.Pop);
  
    // Create a tensor from the one hot array
    const tensor = tf.tensor2d([oneHotArray]);
  
    tf.loadLayersModel('localstorage://model')
      .then((model) => {
        const prediction = model.predict(tensor) as tf.Tensor;
  
        // Add random noise to the prediction
        const noise = tf.randomNormal(prediction.shape, 0, 0.1);
        const noisyPrediction = prediction.add(noise);

        // Use array() to get the predicted values directly
        noisyPrediction
          .array()
          .then((array) => {
            if (Array.isArray(array) && Array.isArray(array[0])) {
              const features = array[0] as number[];
  
              // Denormalize each feature
              const denormalizedFeatures = [
                this.denormalize(features[0], 0, 1), // acousticness (0 to 1)
                this.denormalize(features[1], 0, 1), // danceability (0 to 1)
                this.denormalize(features[2], 0, 1), // energy (0 to 1)
                this.denormalize(features[3], 0, 1), // instrumentalness (0 to 1)
                this.denormalize(features[4], -1, 11), // key (-1 to 11)
                this.denormalize(features[5], 0, 1), // liveness (0 to 1)
                this.denormalize(features[6], -60, 0), // loudness (-60 to 0)
                this.denormalize(features[7], 0, 1), // mode (0 or 1)
                this.denormalize(features[8], 0, 1), // speechiness (0 to 1)
                this.denormalize(features[9], 35, 256), // tempo (35 to 256)
                this.denormalize(features[10], 3, 7), // time_signature (3 to 7)
                this.denormalize(features[11], 0, 1), // valence (0 to 1)
              ];
  
              // Set target key and time signature to whole numbers
              denormalizedFeatures[4] = Math.round(denormalizedFeatures[4]);
              denormalizedFeatures[10] = Math.round(denormalizedFeatures[10]);
              // Set mode to 0 or 1
              denormalizedFeatures[7] = Math.round(denormalizedFeatures[7]);
  
              // Ensure all values are positive except loudness
              denormalizedFeatures.forEach((feature, i) => {
                if (i !== 6) {
                  denormalizedFeatures[i] = Math.abs(feature);
                }
              });

              //log the features
              denormalizedFeatures.forEach((feature, i) => {
                this.updateConsole(`Feature ${i}: ${feature}`);
              });
  
              // Call the Spotify API using only the predicted target features
              fetch(
                `https://api.spotify.com/v1/recommendations?limit=1&seed_genres=pop&target_acousticness=${denormalizedFeatures[0]}&target_danceability=${denormalizedFeatures[1]}&target_energy=${denormalizedFeatures[2]}&target_instrumentalness=${denormalizedFeatures[3]}&target_key=${denormalizedFeatures[4]}&target_liveness=${denormalizedFeatures[5]}&target_loudness=${denormalizedFeatures[6]}&target_mode=${denormalizedFeatures[7]}&target_speechiness=${denormalizedFeatures[8]}&target_tempo=${denormalizedFeatures[9]}&target_time_signature=${denormalizedFeatures[10]}&target_valence=${denormalizedFeatures[11]}`,
                {
                  method: 'GET',
                  headers: {
                    Authorization: `Bearer ${this.spotifyAccessToken}`,
                  },
                }
              )
                .then((response) => response.json())
                .then((data) => {
                  if (data.tracks && data.tracks.length > 0) {
                    this.updateConsole(
                      `Song: ${data.tracks[0].name} by ${data.tracks[0].artists[0].name}`
                    );
                  } else {
                    this.updateConsole('No songs found.');
                  }
                })
                .catch((error) => {
                  this.updateConsole('Error fetching recommendations: ' + error);
                });
            } else {
              this.updateConsole('Unexpected prediction structure');
            }
          })
          .catch((err) => {
            this.updateConsole('Error getting prediction: ' + err);
          });
      })
      .catch((err) => {
        this.updateConsole('Error loading model: ' + err);
      });
  }
  

  // test() {
  //   this.updateConsole('Testing...');

  //   //make a one hot array for the happy vacation genre
  //   const oneHotArray = combineEncodings(Emotions.Angry, Events.None, Genres.HipHop);

  //   //log each item in the one hot array
  //   oneHotArray.forEach((item, i) => {
  //     this.updateConsole(`One hot array item ${i}: ${item}`);
  //   });

  //   // Create a tensor from the one hot array
  //   const tensor = tf.tensor2d([oneHotArray]);

  //   tf.loadLayersModel('localstorage://model')
  //     .then((model) => {
  //       const prediction = model.predict(tensor) as tf.Tensor;

  //       // Add random noise to the prediction
  //       const noise = tf.randomNormal(prediction.shape, 0, 0.1);
  //       const noisyPrediction = prediction.add(noise);

  //       // Use array() to get the predicted values directly
  //       noisyPrediction
  //         .array()
  //         .then((array) => {
  //           // Check if array is 2D
  //           if (Array.isArray(array) && Array.isArray(array[0])) {
  //             const features = array[0] as number[];

  //             const denormalizedFeatures = [
  //               this.denormalize(features[0], 0, 1), // acousticness (0 to 1)
  //               this.denormalize(features[1], 0, 1), // danceability (0 to 1)
  //               this.denormalize(features[2], 0, 1), // energy (0 to 1)
  //               this.denormalize(features[3], 0, 1), // instrumentalness (0 to 1)
  //               this.denormalize(features[4], -1, 11), // key (-1 to 11)
  //               this.denormalize(features[5], 0, 1), // liveness (0 to 1)
  //               this.denormalize(features[6], -60, 0), // loudness (-60 to 0)
  //               this.denormalize(features[7], 0, 1), // mode (0 or 1)
  //               this.denormalize(features[8], 0, 1), // speechiness (0 to 1)
  //               this.denormalize(features[9], 35, 256), // tempo (using the broader range 35 to 256)
  //               this.denormalize(features[10], 3, 7), // time_signature (3 to 7)
  //               this.denormalize(features[11], 0, 1), // valence (0 to 1)
  //             ];

  //             // Log the features
  //             denormalizedFeatures.forEach((feature, i) => {
  //               this.updateConsole(`Feature ${i}: ${feature}`);
  //             });

  //             // Set target key and time signature to whole numbers
  //             denormalizedFeatures[4] = Math.round(denormalizedFeatures[4]);
  //             denormalizedFeatures[10] = Math.round(denormalizedFeatures[10]);
  //             // Set mode to 0 or 1
  //             denormalizedFeatures[7] = Math.round(denormalizedFeatures[7]);

  //             // Ensure all values are positive except loudness
  //             denormalizedFeatures.forEach((feature, i) => {
  //               if (i !== 6) {
  //                 denormalizedFeatures[i] = Math.abs(feature);
  //               }
  //             });

  //             // Use the denormalized values in your min/max array or API call
  //             const minMaxArray: number[] = [];
  //             denormalizedFeatures.forEach((feature, i) => {
  //               if (i === 4 || i === 10 || i === 7) {
  //                 minMaxArray.push(feature);
  //                 minMaxArray.push(feature);
  //               } else if (i === 9) {
  //                 minMaxArray.push(feature - 10);
  //                 minMaxArray.push(feature + 10);
  //               } else {
  //                 minMaxArray.push(feature - 0.05);
  //                 minMaxArray.push(feature + 0.05);
  //               }
  //             });

  //             // Ensure all min and max values are within 2 decimal places
  //             minMaxArray.forEach((feature, i) => {
  //               minMaxArray[i] = parseFloat(feature.toFixed(2));
  //             });

  //             // Function to attempt fetching recommendations with an expanding range
  //             const fetchWithExpandingRange = async (
  //               expansionFactor = 1.5,
  //               maxAttempts = 5,
  //               attempt = 1
  //             ) => {
  //               this.updateConsole(`Attempt ${attempt}: Using min-max ranges`);

  //               const adjustedMinMaxArray = minMaxArray.map((value, index) => {
  //                 const middleValue =
  //                   denormalizedFeatures[Math.floor(index / 2)];
  //                 // Adjust min and max values based on index
  //                 //do not use absolute value for loudness as it can be negative
  //                 if (index === 12 || index === 13) {
  //                   if (index % 2 === 0) {
  //                     return parseFloat(
  //                       (
  //                         value -
  //                         (expansionFactor + 0.3) ** (attempt - 1)
  //                       ).toFixed(2)
  //                     );
  //                   } else {
  //                     return parseFloat(
  //                       (
  //                         value +
  //                         (expansionFactor + 1.2) ** (attempt - 1)
  //                       ).toFixed(2)
  //                     );
  //                   }
  //                 } else {
  //                   //check if key, if it is then move by 1
  //                   if (index === 8 || index === 9) {
  //                     if (index % 2 === 0) {
  //                       return value - 1;
  //                     } else {
  //                       return value + 1;
  //                     }
  //                   }
  //                   // For all other features
  //                   if (index % 2 === 0) {
  //                     return parseFloat(
  //                       (
  //                         middleValue -
  //                         Math.abs(middleValue - value) *
  //                           expansionFactor ** (attempt - 1)
  //                       ).toFixed(2)
  //                     );
  //                   } else {
  //                     return parseFloat(
  //                       (
  //                         middleValue +
  //                         Math.abs(middleValue - value) *
  //                           expansionFactor ** (attempt - 1)
  //                       ).toFixed(2)
  //                     );
  //                   }
  //                 }
  //               });

  //               try {
  //                 const response = await fetch(
  //                   `https://api.spotify.com/v1/recommendations?limit=1&seed_genres=hip-hop&min_acousticness=${
  //                     adjustedMinMaxArray[0]
  //                   }&max_acousticness=${
  //                     adjustedMinMaxArray[1]
  //                   }&target_acousticness=${
  //                     denormalizedFeatures[0]
  //                   }&min_danceability=${
  //                     adjustedMinMaxArray[2]
  //                   }&max_danceability=${
  //                     adjustedMinMaxArray[3]
  //                   }&target_danceability=${
  //                     denormalizedFeatures[1]
  //                   }&min_energy=${adjustedMinMaxArray[4]}&max_energy=${
  //                     adjustedMinMaxArray[5]
  //                   }&target_energy=${
  //                     denormalizedFeatures[2]
  //                   }&min_instrumentalness=${
  //                     adjustedMinMaxArray[6]
  //                   }&max_instrumentalness=${
  //                     adjustedMinMaxArray[7]
  //                   }&target_instrumentalness=${
  //                     denormalizedFeatures[3]
  //                   }&min_key=${-1}&max_key=${11}&target_key=${
  //                     denormalizedFeatures[4]
  //                   }&min_liveness=${adjustedMinMaxArray[10]}&max_liveness=${
  //                     adjustedMinMaxArray[11]
  //                   }&target_liveness=${denormalizedFeatures[5]}&min_loudness=${
  //                     adjustedMinMaxArray[12]
  //                   }&max_loudness=${adjustedMinMaxArray[13]}&target_loudness=${
  //                     denormalizedFeatures[6]
  //                   }&min_mode=${0}&max_mode=${1}&target_mode=${
  //                     denormalizedFeatures[7]
  //                   }&min_speechiness=${
  //                     adjustedMinMaxArray[16]
  //                   }&max_speechiness=${
  //                     adjustedMinMaxArray[17]
  //                   }&target_speechiness=${denormalizedFeatures[8]}&min_tempo=${
  //                     adjustedMinMaxArray[18]
  //                   }&max_tempo=${adjustedMinMaxArray[19]}&target_tempo=${
  //                     denormalizedFeatures[9]
  //                   }&min_valence=${adjustedMinMaxArray[22]}&max_valence=${
  //                     adjustedMinMaxArray[23]
  //                   }&target_valence=${denormalizedFeatures[11]}`,
  //                   {
  //                     method: 'GET',
  //                     headers: {
  //                       Authorization: `Bearer ${this.spotifyAccessToken}`,
  //                     },
  //                   }
  //                 );

  //                 const data = await response.json();

  //                 if (data.tracks && data.tracks.length > 0) {
  //                   this.updateConsole(
  //                     `Song: ${data.tracks[0].name} by ${data.tracks[0].artists[0].name}`
  //                   );
  //                   return;
  //                 } else if (attempt < maxAttempts) {
  //                   // If no tracks found, try again with an expanded range
  //                   this.updateConsole(
  //                     'No songs found, expanding the range...'
  //                   );
  //                   await fetchWithExpandingRange(
  //                     expansionFactor,
  //                     maxAttempts,
  //                     attempt + 1
  //                   );
  //                 } else {
  //                   this.updateConsole(
  //                     'No songs found after maximum attempts.'
  //                   );
  //                 }
  //               } catch (error) {
  //                 this.updateConsole(
  //                   'Error fetching recommendations: ' + error
  //                 );
  //               }
  //             };

  //             // Start fetching with expanding range
  //             fetchWithExpandingRange();
  //           } else {
  //             this.updateConsole('Unexpected prediction structure');
  //           }
  //         })
  //         .catch((err) => {
  //           this.updateConsole('Error getting prediction: ' + err);
  //         });
  //     })
  //     .catch((err) => {
  //       this.updateConsole('Error loading model: ' + err);
  //     });
  // }

  async getAllFeatures() {
    this.updateConsole('Getting all features...');

    const { data, error } = await this.supabase.storage
      .from('train')
      .download('genres_with_events.csv');

    if (error) {
      this.updateConsole('Error getting all features: ' + error.message);
      return;
    }

    const contents = await data!.text();
    type AudioFeatures = number[];

    // Process the contents to get audio features
    const allAudioFeatures: AudioFeatures[] =
      this.getAllAudioFeatures(contents);

    // Log each audio feature
    allAudioFeatures.forEach((row: AudioFeatures, i: number) => {
      this.updateConsole(`Emotion ${i}: ${row}`);
    });
  }

  parseCSV(csv: string): number[][] {
    const lines = csv.trim().split('\n');
    const headers = lines[0].split(',');

    return lines.slice(1).map((line) => {
      const values = line.split(',');
      return headers.map((header, i) => parseFloat(values[i]));
    });
  }

  getAudioFeaturesByEmotion(emotion: number, csv: string): any {
    const parsedData = this.parseCSV(csv);
    const emotionIndex = parsedData.findIndex((row) => row[0] === emotion);
    return parsedData[emotionIndex];
  }

  getAllAudioFeatures(csv: string): any {
    const parsedData = this.parseCSV(csv);
    parsedData.forEach((row) => {
      row.shift(); // Remove the 'Happy' label

      // Normalize each feature using their respective min and max values
      row[0] = this.normalize(row[0], 0, 1); // acousticness (0 to 1)
      row[1] = this.normalize(row[1], 0, 1); // danceability (0 to 1)
      row[2] = this.normalize(row[2], 0, 1); // energy (0 to 1)
      row[3] = this.normalize(row[3], 0, 1); // instrumentalness (0 to 1)
      row[4] = this.normalize(row[4], -1, 11); // key (-1 to 11)
      row[5] = this.normalize(row[5], 0, 1); // liveness (0 to 1)
      row[6] = this.normalize(row[6], -60, 0); // loudness (-60 to 0)
      row[7] = this.normalize(row[7], 0, 1); // mode (0 or 1)
      row[8] = this.normalize(row[8], 0, 1); // speechiness (0 to 1)
      row[9] = this.normalize(row[9], 35, 256); // tempo (using the broader range 35 to 256)
      row[10] = this.normalize(row[10], 3, 7); // time_signature (3 to 7)
      row[11] = this.normalize(row[11], 0, 1); // valence (0 to 1)
    });
    return parsedData;
  }

  // Normalization function
  normalize(value: number, min: number, max: number) {
    return (value - min) / (max - min);
  }

  denormalize(value: number, min: number, max: number) {
    return value * (max - min) + min;
  }
}
