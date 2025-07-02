from flask import Flask, request, jsonify
import pandas as pd
import joblib
import os
from datetime import datetime

app = Flask(__name__)

# Always use absolute paths relative to this script
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CLASSIFIED_SONGS_CSV = os.path.join(BASE_DIR, 'classified_songs.csv')
USER_MOOD_HISTORY_CSV = os.path.join(BASE_DIR, 'user_mood_history.csv')
MODEL_PATH = os.path.join(BASE_DIR, 'song_mood_xgb_model_updated.pkl')

# Load model and mood mapping
model = joblib.load(MODEL_PATH)
mood_mapping = {0: 'Sad', 1: 'Happy', 2: 'Energetic', 3: 'Calm'}

# Ensure CSVs exist with headers
def ensure_csv(file_path, headers):
    if not os.path.exists(file_path):
        pd.DataFrame({h: [] for h in headers}).to_csv(file_path, index=False)

# --- Predict mood for a single song/chunk ---
@app.route('/predict-mood', methods=['POST'])
def predict_mood():
    data = request.get_json(force=True)
    if not data or 'features' not in data:
        return jsonify({'mood': 'Unknown'}), 400
    features = data['features']
    feature_columns = ['danceability', 'energy', 'loudness', 'speechiness',
                       'acousticness', 'instrumentalness', 'liveness', 'valence', 'tempo']
    # Only use features that are present
    X = pd.DataFrame([{k: features.get(k, 0) for k in feature_columns}])
    pred = model.predict(X)[0]
    mood = mood_mapping[pred]
    # Store in classified_songs.csv
    song_name = data.get('song_name', '')
    chunk_number = data.get('chunk_number', '')
    row = {**features, 'Song_Name': song_name, 'Chunk_Number': chunk_number, 'Predicted_Mood': mood, 'Timestamp': datetime.now().isoformat()}
    ensure_csv(CLASSIFIED_SONGS_CSV, list(row.keys()))
    pd.DataFrame([row]).to_csv(CLASSIFIED_SONGS_CSV, mode='a', header=False, index=False)
    return jsonify({'mood': mood})

# --- Aggregate user mood from listening history ---
@app.route('/user-mood', methods=['POST'])
def user_mood():
    data = request.get_json(force=True)
    if not data or 'history' not in data:
        return jsonify({'user_mood': 'Unknown'}), 400
    history = data['history']
    if not history:
        return jsonify({'user_mood': 'Unknown'})
    df = pd.DataFrame(history)
    if 'Mood_Name' not in df.columns:
        return jsonify({'user_mood': 'Unknown'})
    # Use the same aggregation as in mood_aggr_class.py
    def determine_final_mood(moods):
        valence_moods = [mood for mood in moods if mood in ['Happy', 'Sad']]
        arousal_moods = [mood for mood in moods if mood in ['Calm', 'Energetic']]
        final_valence = pd.Series(valence_moods).value_counts()
        final_arousal = pd.Series(arousal_moods).value_counts()
        mood_parts = []
        if not final_valence.empty:
            mood_parts.append(final_valence.idxmax())
        if not final_arousal.empty:
            mood_parts.append(final_arousal.idxmax())
        final_mood = ' and '.join(mood_parts) if mood_parts else 'Unknown'
        if final_mood == 'Sad':
            final_mood = 'Sad and Calm'
        elif final_mood == 'Happy':
            final_mood = 'Happy and Energetic'
        return final_mood
    user_mood = determine_final_mood(df['Mood_Name'])
    # Store in user_mood_history.csv
    row = {'Timestamp': datetime.now().isoformat(), 'User_Mood': user_mood}
    ensure_csv(USER_MOOD_HISTORY_CSV, list(row.keys()))
    pd.DataFrame([row]).to_csv(USER_MOOD_HISTORY_CSV, mode='a', header=False, index=False)
    return jsonify({'user_mood': user_mood})

if __name__ == '__main__':
    app.run(port=5001) 